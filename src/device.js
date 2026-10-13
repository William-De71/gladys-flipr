// -----------------------------------------------------------------------------
// The devices of the Flipr integration, offered on the Discovery screen.
//
// One device per Flipr analyzer of the account, "Flipr <serial>":
//   - water temperature  temperature-sensor / decimal, °C
//   - pH                 ph-sensor / decimal
//   - chlorine           level-sensor / decimal, ppm (= mg/L in water): Gladys
//                        has no chlorine category; level-sensor / decimal is
//                        a plain numeric sensor (droplet icon, raw value),
//                        its feature name is shown since the device has
//                        several decimal features
//   - redox              orp-sensor / decimal, mV
//   - battery            battery / integer, %
//   - pH and chlorine status, as Flipr rates them (text / text)
// One device per Flipr Hub (the filtration pump relay), "Flipr Hub <serial>":
//   - filtration         switch / binary, on or off (switching puts the Hub
//                        in manual mode, as the Flipr app does)
//   - filtration mode    text / select: auto, manual, planning
//
// External ids are built on the serial number of the module, never on a name.
//
// Flipr has no push: the integration reads the cloud on its own timer (every
// 15 minutes by default, beyond the 60 s Gladys polls at most), so
// `should_poll` is false.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { HUB_MODES } from './flipr-api.js';
import { t } from './i18n.js';

const DEVICE_TYPES = { ANALYZER: 'analyzer', HUB: 'hub' };

const FEATURE_KEYS = {
  TEMPERATURE: 'temperature',
  PH: 'ph',
  CHLORINE: 'chlorine',
  REDOX: 'redox',
  BATTERY: 'battery',
  PH_STATUS: 'ph_status',
  CHLORINE_STATUS: 'chlorine_status',
  FILTRATION: 'filtration',
  MODE: 'mode',
};

const round = (value, digits) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10 ** digits) / 10 ** digits
    : null;

const sensor = { read_only: true, has_feedback: false, keep_history: true };
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
};

// The features of an analyzer: their Gladys shape and the state of a measure.
// `state` returns a number, `{ text }`, or null when unknown (not published).
const ANALYZER_FEATURES = [
  {
    key: FEATURE_KEYS.TEMPERATURE,
    name: 'featureTemperature',
    shape: {
      ...sensor,
      category: CATEGORIES.TEMPERATURE_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.CELSIUS,
      min: -10,
      max: 50,
    },
    state: (m) => round(m.temperature, 1),
  },
  {
    key: FEATURE_KEYS.PH,
    name: 'featurePh',
    shape: {
      ...sensor,
      category: CATEGORIES.PH_SENSOR,
      type: TYPES.PH_SENSOR.DECIMAL,
      unit: UNITS.PH,
      min: 0,
      max: 14,
    },
    state: (m) => round(m.ph, 2),
  },
  {
    key: FEATURE_KEYS.CHLORINE,
    name: 'featureChlorine',
    shape: {
      ...sensor,
      category: CATEGORIES.LEVEL_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.PPM,
      min: 0,
      max: 10,
    },
    state: (m) => round(m.chlorine, 2),
  },
  {
    key: FEATURE_KEYS.REDOX,
    name: 'featureRedox',
    shape: {
      ...sensor,
      category: CATEGORIES.ORP_SENSOR,
      type: TYPES.ORP_SENSOR.DECIMAL,
      unit: UNITS.MILLI_VOLT,
      min: 0,
      max: 1000,
    },
    state: (m) => round(m.redox, 0),
  },
  {
    key: FEATURE_KEYS.BATTERY,
    name: 'featureBattery',
    shape: {
      ...sensor,
      category: CATEGORIES.BATTERY,
      type: TYPES.BATTERY.INTEGER,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
    },
    state: (m) => round(m.battery, 0),
  },
  {
    key: FEATURE_KEYS.PH_STATUS,
    name: 'featurePhStatus',
    shape: text,
    state: (m, language) => (m.phStatus ? { text: t(`status_${m.phStatus}`, language) } : null),
  },
  {
    key: FEATURE_KEYS.CHLORINE_STATUS,
    name: 'featureChlorineStatus',
    shape: text,
    state: (m, language) =>
      m.chlorineStatus ? { text: t(`status_${m.chlorineStatus}`, language) } : null,
  },
];

/**
 * @description The external ids of a module.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} type - A DEVICE_TYPES value.
 * @param {string} serial - The serial number.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'analyzer', 'AB256C').device; // -> 'ext:flipr:analyzer:AB256C'
 */
function idsOf(gladys, type, serial) {
  return gladys.externalIds(type, serial);
}

/**
 * @description The serial number a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @param {string} type - A DEVICE_TYPES value.
 * @returns {string|null} The serial.
 * @example
 * serialFromExternalId('ext:flipr:analyzer:AB256C:ph', 'analyzer'); // -> 'AB256C'
 */
function serialFromExternalId(externalId, type) {
  const match = new RegExp(`:${type}:([A-Za-z0-9]+)(?::[a-z_]+)?$`).exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

const params = (module) => [
  { name: 'FLIPR_SERIAL', value: module.serial },
  ...(module.model ? [{ name: 'FLIPR_MODEL', value: module.model }] : []),
];

/**
 * @description The device of an analyzer.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} module - The module (readModules).
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 * @example
 * buildAnalyzerDevice(gladys, { serial: 'AB256C', kind: 'analyzer', model: 'Start' }, 'fr');
 */
function buildAnalyzerDevice(gladys, module, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.ANALYZER, module.serial);
  return {
    name: t('analyzerDeviceName', language, { serial: module.serial }),
    external_id: ids.device,
    should_poll: false,
    params: params(module),
    features: ANALYZER_FEATURES.map((spec) => ({
      name: t(spec.name, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The device of a Hub.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} module - The module (readModules).
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildHubDevice(gladys, module, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.HUB, module.serial);
  return {
    name: t('hubDeviceName', language, { serial: module.serial }),
    external_id: ids.device,
    should_poll: false,
    params: params(module),
    features: [
      {
        name: t('featureFiltration', language),
        external_id: ids.feature(FEATURE_KEYS.FILTRATION),
        category: CATEGORIES.SWITCH,
        type: TYPES.SWITCH.BINARY,
        read_only: false,
        has_feedback: true,
        keep_history: true,
        min: 0,
        max: 1,
      },
      {
        name: t('featureMode', language),
        external_id: ids.feature(FEATURE_KEYS.MODE),
        category: CATEGORIES.TEXT,
        type: TYPES.TEXT.SELECT,
        read_only: false,
        has_feedback: true,
        keep_history: false,
        min: 0,
        max: 0,
        supported_options: HUB_MODES.map((mode, index) => ({
          value: mode,
          label: t(`mode_${mode}`, language),
          sort_order: index,
        })),
      },
    ],
  };
}

/**
 * @description The states of an analyzer measure. Unknown values are left
 * out, never published as 0.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} serial - The serial number.
 * @param {object} measure - The measure (readMeasure).
 * @param {string} language - Language of the status texts.
 * @returns {Array<object>} The states.
 */
function buildAnalyzerStates(gladys, serial, measure, language) {
  const ids = idsOf(gladys, DEVICE_TYPES.ANALYZER, serial);
  return ANALYZER_FEATURES.flatMap((spec) => {
    const value = spec.state(measure, language);
    if (value === null) {
      return [];
    }
    const id = ids.feature(spec.key);
    return [
      typeof value === 'object'
        ? { device_feature_external_id: id, text: value.text }
        : { device_feature_external_id: id, state: value },
    ];
  });
}

/**
 * @description The states of a Hub.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} serial - The serial number.
 * @param {{ on: boolean|null, mode: string|null }} hub - The Hub state.
 * @returns {Array<object>} The states.
 */
function buildHubStates(gladys, serial, hub) {
  const ids = idsOf(gladys, DEVICE_TYPES.HUB, serial);
  const states = [];
  if (typeof hub.on === 'boolean') {
    states.push({
      device_feature_external_id: ids.feature(FEATURE_KEYS.FILTRATION),
      state: hub.on ? 1 : 0,
    });
  }
  if (hub.mode) {
    states.push({ device_feature_external_id: ids.feature(FEATURE_KEYS.MODE), text: hub.mode });
  }
  return states;
}

export {
  DEVICE_TYPES,
  FEATURE_KEYS,
  ANALYZER_FEATURES,
  idsOf,
  serialFromExternalId,
  buildAnalyzerDevice,
  buildHubDevice,
  buildAnalyzerStates,
  buildHubStates,
};
