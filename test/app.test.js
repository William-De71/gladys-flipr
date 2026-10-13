// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices and the states like the host API does, and a fake Flipr cloud.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import {
  fliprCloud,
  rawMeasure,
  rawHubState,
  silent,
  NOW,
  HOUR,
  ANALYZER_SERIAL,
  HUB_SERIAL,
} from './helpers/fixtures.js';

const CONFIG = { email: 'me@example.com', password: 'secret' };
const ANALYZER = `ext:test-integration:analyzer:${ANALYZER_SERIAL}`;
const HUB = `ext:test-integration:hub:${HUB_SERIAL}`;

/**
 * @description The integration, connected to a fake Gladys and a fake Flipr cloud.
 * @param {object} [options] - `{ config, cloud }`.
 * @returns {Promise<object>} `{ gladys, app, fetch, clock }`.
 */
async function startApp({ config = CONFIG, cloud = {} } = {}) {
  const fetch = fliprCloud(cloud);
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetchImpl: fetch,
    now: () => clock.now,
    logger: silent,
    verifyDelayMs: 5,
  });
  await gladys.connect();
  return { gladys, app, fetch, clock };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('the analyzer and the Hub are offered, accepted by the host API checks', async (t) => {
  const { gladys, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    fetch.calls.map((call) => call.path),
    ['OAuth2/token', 'modules', `modules/${ANALYZER_SERIAL}/NewResume`, `hub/${HUB_SERIAL}/state`],
  );
  const devices = gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => device.external_id),
    [ANALYZER, HUB],
  );
  assert.ok(devices.every((device) => device.should_poll === false));
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /1 analyseur\(s\), 1 Hub/);
  assert.equal(gladys.fake.states.length, 0, 'nothing before a device exists');
});

test('creating a device publishes all its states, then only what changed', async (t) => {
  const { gladys, app, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, ANALYZER);
  assert.equal(gladys.fake.lastState(`${ANALYZER}:temperature`), 26.4);
  assert.equal(gladys.fake.lastState(`${ANALYZER}:ph`), 7.21);
  assert.equal(gladys.fake.lastState(`${ANALYZER}:chlorine`), 1.23);
  assert.equal(gladys.fake.lastState(`${ANALYZER}:redox`), 702);
  assert.equal(gladys.fake.lastState(`${ANALYZER}:battery`), 75);
  assert.equal(gladys.fake.lastState(`${ANALYZER}:ph_status`), 'Ideal');
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.POOL));

  await created(gladys, HUB);
  assert.equal(gladys.fake.lastState(`${HUB}:filtration`), 0);
  assert.equal(gladys.fake.lastState(`${HUB}:mode`), 'planning');

  const before = gladys.fake.states.length;
  await app.watcher.round();
  assert.equal(gladys.fake.states.length, before, 'same measure: nothing sent');

  fetch.state.measures[ANALYZER_SERIAL] = rawMeasure({ at: NOW, temperature: 26.9 });
  await app.watcher.round();
  const sent = gladys.fake.states.slice(before);
  assert.deepEqual(
    sent.map((state) => [state.device_feature_external_id, state.state]),
    [[`${ANALYZER}:temperature`, 26.9]],
  );
});

test('a new measure fires new_measure, a new rating fires water_status_changed', async (t) => {
  const { gladys, app, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first reading is a baseline');

  fetch.state.measures[ANALYZER_SERIAL] = rawMeasure({ at: NOW, ph: 7.9, phSector: 'TooHigh' });
  await app.watcher.round();
  const [measure] = eventsOf(gladys, 'new_measure');
  assert.ok(measure);
  assert.match(JSON.stringify(measure), new RegExp(ANALYZER));
  const [status] = eventsOf(gladys, 'water_status_changed');
  const json = JSON.stringify(status);
  assert.match(json, /"parameter":"ph"/);
  assert.match(json, /"status":"too_high"/);
  assert.match(json, /"previous_status":"ideal"/);
  assert.match(json, /"value":7.9/);

  await app.watcher.round();
  assert.equal(eventsOf(gladys, 'new_measure').length, 1, 'once per measure');
});

test('measures_stopped fires once after 24 hours without a measure', async (t) => {
  const { gladys, app, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  clock.now = NOW + 24 * HOUR;
  await app.watcher.round();
  clock.now = NOW + 26 * HOUR;
  await app.watcher.round();
  const stopped = eventsOf(gladys, 'measures_stopped');
  assert.equal(stopped.length, 1);
  assert.match(JSON.stringify(stopped[0]), /"hours":25/);
});

test('the Hub switching by itself fires filtration_changed; a Gladys command does not', async (t) => {
  const { gladys, app, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  fetch.state.hubs[HUB_SERIAL] = rawHubState(1, 'planning');
  await app.watcher.round();
  const [event] = eventsOf(gladys, 'filtration_changed');
  assert.match(JSON.stringify(event), /"state":"on"/);
  assert.match(JSON.stringify(event), new RegExp(HUB));

  const hub = await created(gladys, HUB);
  const filtration = hub.features.find((f) => f.external_id === `${HUB}:filtration`);
  await gladys.fake.setValue(hub, filtration, 0);
  assert.deepEqual(
    fetch.calls.slice(-2).map((call) => `${call.method} ${call.path}`),
    [`PUT hub/${HUB_SERIAL}/mode/manual`, `POST hub/${HUB_SERIAL}/Manual/False`],
  );
  assert.equal(gladys.fake.lastState(`${HUB}:filtration`), 0);
  assert.equal(gladys.fake.lastState(`${HUB}:mode`), 'manual');
  await wait(30);
  await app.watcher.round();
  assert.equal(eventsOf(gladys, 'filtration_changed').length, 1, 'no event for our own command');

  const mode = hub.features.find((f) => f.external_id === `${HUB}:mode`);
  await gladys.fake.setValue(hub, mode, 'auto');
  assert.equal(fetch.state.hubs[HUB_SERIAL].behavior, 'auto');
  assert.equal(gladys.fake.lastState(`${HUB}:mode`), 'auto');
});

test('the widget, the scene actions and the test action answer', async (t) => {
  const { gladys, fetch, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await gladys.fake.widgetGet(WIDGETS.POOL, { language });
    const { content } = ack.data;
    assert.deepEqual(validateWidgetContent(content), [], language);
    assert.ok(!content.components.some((c) => c.type === 'chart'), 'no chart before the device');
  }
  await created(gladys, ANALYZER);
  const ack = await gladys.fake.widgetGet(WIDGETS.POOL, {
    settings: { chart: 'ph', interval: 'last-day' },
  });
  const chart = ack.data.content.components.find((c) => c.type === 'chart');
  assert.deepEqual(chart.device_features, [`${ANALYZER}:ph`]);

  clock.now = NOW + 10 * 60000;
  fetch.state.measures[ANALYZER_SERIAL] = rawMeasure({ at: NOW + 5 * 60000, ph: 7.0 });
  const measure = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MEASURE, { device: ANALYZER });
  const { outputs } = measure.data;
  assert.equal(outputs.ph, 7);
  assert.equal(outputs.ph_status, 'ideal');
  assert.match(outputs.summary, /Flipr AB256C/);
  assert.equal(eventsOf(gladys, 'new_measure').length, 0, 'a scene action fires no trigger');

  const mode = await gladys.fake.sceneAction(SCENE_ACTIONS.SET_FILTRATION_MODE, { mode: 'auto' });
  assert.deepEqual(mode.data.outputs, { state: 'off', mode: 'auto' });
  assert.equal(fetch.state.hubs[HUB_SERIAL].behavior, 'auto');

  const result = await gladys.fake.action('test_connection');
  assert.match(JSON.stringify(result), /1 analyzer\(s\) and 1 Hub\(s\)/);
});

test('a wrong password and a missing account are reported to the user', async (t) => {
  const { gladys } = await startApp({ cloud: { password: 'other' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refused the e-mail or the password/);
  assert.equal(gladys.fake.discoveredDevices.length, 0);

  const empty = await startApp({ config: {} });
  t.after(() => empty.gladys.fake.shutdown());
  assert.equal(empty.gladys.fake.connectionStatus.connected, false);
  assert.match(empty.gladys.fake.connectionStatus.message.fr, /Saisissez l’e-mail/);
  assert.equal(empty.fetch.calls.length, 0, 'Flipr is not called without an account');
  const ack = await empty.gladys.fake.widgetGet(WIDGETS.POOL, { language: 'de' });
  assert.match(JSON.stringify(ack), /Flipr-Kontos/);
});

test('a failing Flipr cloud keeps the last snapshot and reports it', async (t) => {
  const { gladys, app, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  fetch.state.failures.modules = 503;
  await app.watcher.round();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /does not answer/);
  delete fetch.state.failures.modules;
  fetch.state.failures[`modules/${ANALYZER_SERIAL}/NewResume`] = 500;
  await app.watcher.round();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(app.watcher.analyzer(ANALYZER_SERIAL).measure.ph, 7.21, 'last measure kept');
});

test('the password never reaches the logs', async (t) => {
  const lines = [];
  const logger = Object.fromEntries(
    ['info', 'warn', 'error', 'debug'].map((level) => [
      level,
      (...args) => lines.push(args.join(' ')),
    ]),
  );
  const fetch = fliprCloud({ failures: { modules: 'network' } });
  const gladys = createFakeGladys({ config: { email: 'me@example.com', password: 'secret' } });
  createApp(gladys, { fetchImpl: fetch, now: () => NOW, logger });
  await gladys.connect();
  t.after(() => gladys.fake.shutdown());
  assert.ok(lines.length > 0);
  assert.ok(lines.every((line) => !line.includes('secret')));
});
