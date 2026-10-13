// -----------------------------------------------------------------------------
// The Flipr integration: every handler, registered on a Gladys client.
//
// Brings Flipr pool analyzers and the Flipr Hub into Gladys:
//   - a device per analyzer (water temperature, pH, chlorine, redox, battery,
//     pH and chlorine ratings) and per Hub (filtration on/off, mode), offered
//     on the Discovery screen (see device.js);
//   - scene triggers: new measure, water rating changed, measures stopped,
//     filtration switched by the Hub (see tracker.js, events.js);
//   - scene actions: read the latest measure, change the filtration mode;
//   - a dashboard widget: the pool water at a glance (see widgets.js).
//
// Flipr has no push and no local API: the integration reads the Flipr cloud
// (the API of the Flipr app) on its own timer, with the e-mail and password
// of the Flipr account (see flipr-api.js). Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  hasCredentials,
  readLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createFliprClient, HUB_MODES } from './flipr-api.js';
import { readModules, readMeasure, readHubState } from './read.js';
import { createWatcher } from './watcher.js';
import {
  DEVICE_TYPES,
  FEATURE_KEYS,
  idsOf,
  serialFromExternalId,
  buildAnalyzerDevice,
  buildHubDevice,
  buildAnalyzerStates,
  buildHubStates,
} from './device.js';
import {
  buildAnalyzerEvent,
  buildHubEvent,
  buildMeasureOutputs,
  buildHubOutputs,
} from './events.js';
import { isStale } from './tracker.js';
import { WIDGETS, messageContent, readPoolSettings, buildPoolWidget } from './widgets.js';
import { t, all } from './i18n.js';

const { name, version, homepage } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const ACTIONS = { TEST_CONNECTION: 'test_connection' };
const SCENE_ACTIONS = { GET_MEASURE: 'get_measure', SET_FILTRATION_MODE: 'set_filtration_mode' };
// The Hub applies a command within seconds: read it again after this delay to
// show its real state.
const VERIFY_DELAY_MS = 15000;
// A scene action reuses the last reading while it is this fresh.
const SNAPSHOT_MAX_AGE_MS = 60000;

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetchImpl] - fetch implementation (tests).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {object} [options.logger] - Logger.
 * @param {number} [options.verifyDelayMs] - Delay of the read after a Hub command.
 * @returns {{ watcher: object, verifyHub: Function, getConfig: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    logger = sdkLogger,
    verifyDelayMs = VERIFY_DELAY_MS,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`.
  let language = 'en';
  // Device external ids the user created (states are only published for them).
  let createdDevices = new Set();
  // Last connection status sent, to send it again only when it changes.
  let lastStatus = null;
  const verifyTimers = new Set();

  const flipr = createFliprClient({
    getCredentials: () => ({ email: config.email, password: config.password }),
    fetch: fetchImpl,
    now,
    userAgent: `${name}/${version} (+${homepage})`,
  });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language
   * (feature names, rating texts, scene summaries and outputs).
   * @returns {string} The language.
   */
  function textLanguage() {
    return config.language === AUTO_LANGUAGE ? language : config.language;
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The multi-language message of a failed reading.
   * @param {Error} err - A FliprError.
   * @returns {object} The message.
   */
  function errorMessage(err) {
    switch (err.kind) {
      case 'auth':
        return all(hasCredentials(config) ? 'statusInvalidCredentials' : 'noCredentials');
      case 'rate_limit':
        return all('statusRateLimited');
      default:
        return all('statusUnreachable');
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  const isCreated = (type, serial) => createdDevices.has(idsOf(gladys, type, serial).device);

  /**
   * @description Publish the states of the created devices that changed. The
   * SDK remembers what it sent (publishChangedStates) and forgets a device when
   * the user creates it: its states then go out again in full.
   * @param {object[]} analyzers - Analyzer snapshots.
   * @param {object[]} hubs - Hub snapshots.
   * @returns {Promise<void>}
   */
  async function publishStates(analyzers, hubs) {
    const states = [];
    analyzers.forEach((snapshot) => {
      if (snapshot.measure && isCreated(DEVICE_TYPES.ANALYZER, snapshot.serial)) {
        states.push(
          ...buildAnalyzerStates(gladys, snapshot.serial, snapshot.measure, textLanguage()),
        );
      }
    });
    hubs.forEach((snapshot) => {
      if (isCreated(DEVICE_TYPES.HUB, snapshot.serial)) {
        states.push(...buildHubStates(gladys, snapshot.serial, snapshot));
      }
    });
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  const publishQuietly = (analyzers, hubs) =>
    publishStates(analyzers, hubs).catch((err) =>
      logger.warn(`Unable to publish the states: ${err.message}`),
    );

  /**
   * @description Ask the dashboards to read the widget again.
   */
  function refreshWidgets() {
    Object.values(WIDGETS).forEach((key) => gladys.requestWidgetRefresh(key));
  }

  /**
   * @description Publish a scene event; a failure is only logged.
   * @param {{ key: string, data: object }} event - The event.
   * @returns {Promise<void>}
   */
  async function publishEvent({ key, data }) {
    logger.info(`${data.device_name}: ${key}`);
    try {
      await gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.warn(`Unable to publish the scene event ${key}: ${err.message}`);
    }
  }

  // --- The watcher -----------------------------------------------------------------
  const watcher = createWatcher({
    flipr,
    isEnabled: () => hasCredentials(config),
    getIntervalMs: () => config.pollInterval * 60000,
    onRound: async ({ analyzers, hubs, modules }) => {
      for (const { snapshot, events } of analyzers) {
        for (const event of events) {
          await publishEvent(buildAnalyzerEvent(gladys, snapshot, event, textLanguage(), now()));
        }
      }
      for (const { snapshot, events } of hubs) {
        // diffHub has one kind of event: filtration_changed.
        if (events.length > 0) {
          await publishEvent(buildHubEvent(gladys, snapshot, textLanguage()));
        }
      }
      const changedAnalyzers = analyzers.filter((a) => a.changed).map((a) => a.snapshot);
      const changedHubs = hubs.filter((h) => h.changed).map((h) => h.snapshot);
      if (changedAnalyzers.length > 0 || changedHubs.length > 0) {
        await publishQuietly(changedAnalyzers, changedHubs);
        refreshWidgets();
      }
      if (modules.length === 0) {
        await reportStatus(true, all('statusNoModule'));
      } else {
        await reportStatus(
          true,
          all('statusConnected', { analyzers: analyzers.length, hubs: hubs.length }),
        );
      }
    },
    onError: async (err) => {
      await reportStatus(false, errorMessage(err));
    },
    now,
    logger,
  });

  /**
   * @description Offer every module read on the Discovery screen.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices() {
    const devices = hasCredentials(config)
      ? watcher
          .modules()
          .map((module) =>
            module.kind === 'hub'
              ? buildHubDevice(gladys, module, textLanguage())
              : buildAnalyzerDevice(gladys, module, textLanguage()),
          )
      : [];
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  // --- Modules of the widgets and scene actions ------------------------------------

  /**
   * @description The analyzer a widget or a scene action targets: the chosen
   * device, or the first analyzer of the account.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The snapshot, null when none is known.
   */
  function resolveAnalyzer(deviceExternalId) {
    const serial = serialFromExternalId(deviceExternalId, DEVICE_TYPES.ANALYZER);
    return (serial && watcher.analyzer(serial)) || watcher.analyzers()[0] || null;
  }

  /**
   * @description The Hub a widget or a scene action targets: the chosen
   * device, or the first Hub of the account.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The snapshot, null when none is known.
   */
  function resolveHub(deviceExternalId) {
    const serial = serialFromExternalId(deviceExternalId, DEVICE_TYPES.HUB);
    return (serial && watcher.hub(serial)) || watcher.hubs()[0] || null;
  }

  /**
   * @description Read a Hub again and publish its real state, without event.
   * @param {string} serial - The Hub serial.
   * @returns {Promise<object|null>} The snapshot.
   */
  async function verifyHub(serial) {
    try {
      const state = readHubState(await flipr.getHubState(serial));
      const patch = Object.fromEntries(Object.entries(state).filter(([, value]) => value !== null));
      const snapshot = watcher.patchHub(serial, patch);
      if (snapshot) {
        await publishQuietly([], [snapshot]);
        refreshWidgets();
      }
      return snapshot;
    } catch (err) {
      logger.warn(`Flipr Hub ${serial}: ${err.message}`);
      return watcher.hub(serial);
    }
  }

  /**
   * @description Apply a Hub command to the snapshot at once, then check it later.
   * @param {string} serial - The Hub serial.
   * @param {object} patch - `{ on?, mode? }`.
   * @returns {Promise<void>}
   */
  async function afterHubCommand(serial, patch) {
    const snapshot = watcher.patchHub(serial, patch);
    if (snapshot) {
      await publishQuietly([], [snapshot]);
      refreshWidgets();
    }
    const timer = setTimeout(() => {
      verifyTimers.delete(timer);
      verifyHub(serial);
    }, verifyDelayMs);
    timer.unref?.();
    verifyTimers.add(timer);
  }

  // --- Dashboard widget --------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.POOL, async ({ settings = {}, language: lang, units }) => {
    rememberLanguage(lang);
    if (!hasCredentials(config)) {
      return messageContent(t('noCredentials', lang));
    }
    if (watcher.fetchedAt() === null) {
      return messageContent(t('notReadYet', lang), 30);
    }
    const analyzer = resolveAnalyzer(settings.device);
    if (!analyzer) {
      return messageContent(t('noAnalyzer', lang));
    }
    const created = isCreated(DEVICE_TYPES.ANALYZER, analyzer.serial);
    return buildPoolWidget({
      analyzer,
      hub: resolveHub(settings.hub),
      language: lang,
      units,
      now: now(),
      pollMinutes: config.pollInterval,
      settings: readPoolSettings(settings),
      featureId: created ? idsOf(gladys, DEVICE_TYPES.ANALYZER, analyzer.serial).feature : null,
    });
  });

  // --- Scene actions -----------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_MEASURE, async (fields) => {
    if (!hasCredentials(config)) {
      throw new Error('No Flipr account is configured');
    }
    if (watcher.fetchedAt() === null) {
      await watcher.round();
    }
    const target = resolveAnalyzer(fields.device);
    if (!target) {
      throw new Error('No Flipr analyzer in this account, or Flipr has not been read yet');
    }
    let { measure } = target;
    if (now() - watcher.fetchedAt() > SNAPSHOT_MAX_AGE_MS) {
      // Read for this answer only: the next round fires the events, if any.
      measure = readMeasure(await flipr.getMeasure(target.serial)) ?? measure;
    }
    return buildMeasureOutputs(
      { ...target, measure, stale: isStale(measure, now()) },
      textLanguage(),
    );
  });

  gladys.onSceneAction(SCENE_ACTIONS.SET_FILTRATION_MODE, async (fields) => {
    if (!hasCredentials(config)) {
      throw new Error('No Flipr account is configured');
    }
    if (!HUB_MODES.includes(fields.mode)) {
      throw new Error(`Unknown filtration mode: ${fields.mode}`);
    }
    if (watcher.fetchedAt() === null) {
      await watcher.round();
    }
    const target = resolveHub(fields.device);
    if (!target) {
      throw new Error('No Flipr Hub in this account, or Flipr has not been read yet');
    }
    await flipr.setHubMode(target.serial, fields.mode);
    // Idempotent: the same mode twice changes nothing on the Hub.
    const state = readHubState(await flipr.getHubState(target.serial));
    await afterHubCommand(target.serial, {
      on: state.on ?? target.on,
      mode: state.mode ?? fields.mode,
    });
    return buildHubOutputs(watcher.hub(target.serial));
  });

  // --- Device commands (the Hub) -----------------------------------------------------
  gladys.onSetValue(async (device, deviceFeature, value) => {
    const serial = serialFromExternalId(device.external_id, DEVICE_TYPES.HUB);
    if (!serial) {
      throw new Error(`Not a Flipr Hub: ${device.external_id}`);
    }
    const ids = idsOf(gladys, DEVICE_TYPES.HUB, serial);
    if (deviceFeature.external_id === ids.feature(FEATURE_KEYS.FILTRATION)) {
      const on = Number(value) === 1;
      await flipr.setHubPower(serial, on);
      await afterHubCommand(serial, { on, mode: 'manual' });
      return;
    }
    if (deviceFeature.external_id === ids.feature(FEATURE_KEYS.MODE)) {
      const mode = String(value);
      if (!HUB_MODES.includes(mode)) {
        throw new Error(`Unknown filtration mode: ${mode}`);
      }
      await flipr.setHubMode(serial, mode);
      await afterHubCommand(serial, { mode });
      return;
    }
    throw new Error(`Read-only feature: ${deviceFeature.external_id}`);
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    if (!hasCredentials(config)) {
      return all('noCredentials');
    }
    try {
      await flipr.signIn();
      const modules = readModules(await flipr.listModules());
      return all('testOk', {
        analyzers: modules.filter((module) => module.kind === 'analyzer').length,
        hubs: modules.filter((module) => module.kind === 'hub').length,
      });
    } catch (err) {
      return errorMessage(err);
    }
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await watcher.round();
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} Flipr device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly(watcher.analyzers(), watcher.hubs());
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  /**
   * @description Read Flipr now and offer the devices; report missing credentials.
   * @returns {Promise<void>}
   */
  async function refreshAll() {
    if (!hasCredentials(config)) {
      await reportStatus(false, all('noCredentials'));
    }
    await watcher.round();
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const previousEmail = config.email;
    await loadConfig(rawConfig);
    logger.info(`Configuration updated: Flipr read every ${config.pollInterval} min`);
    flipr.reset();
    if (config.email !== previousEmail) {
      // Maybe another account: start again from a fresh baseline.
      watcher.reset();
    }
    watcher.reschedule();
    await refreshAll();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each step on its own: a failing one must not keep the watcher from starting.
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshCreatedDevices();
    lastStatus = null;
    await refreshAll();
    watcher.start();
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    watcher.stop();
    verifyTimers.forEach((timer) => clearTimeout(timer));
    verifyTimers.clear();
  });

  return { watcher, verifyHub, getConfig: () => config };
}

export { createApp, ACTIONS, SCENE_ACTIONS };
