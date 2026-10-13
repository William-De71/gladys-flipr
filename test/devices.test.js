// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import {
  buildAnalyzerDevice,
  buildHubDevice,
  buildAnalyzerStates,
  buildHubStates,
  serialFromExternalId,
} from '../src/device.js';
import { readMeasure } from '../src/read.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, rawMeasure } from './helpers/fixtures.js';

const analyzer = { serial: 'AB256C', kind: 'analyzer', model: 'Start' };
const hub = { serial: 'CD256C', kind: 'hub', model: null };

// DEVICE_FEATURE_UNITS_BY_CATEGORY of the Gladys core (server/utils/constants.js,
// master of 2026-10-13), for the categories used here. Chlorine is the one
// documented exception: Gladys has no chlorine category, level-sensor /
// decimal is a plain numeric sensor and ppm (= mg/L in water) its unit.
const UNITS = {
  'temperature-sensor': ['celsius', 'fahrenheit', 'kelvin'],
  'ph-sensor': ['ph'],
  'orp-sensor': ['millivolt'],
  battery: ['percent'],
};
const UNIT_EXCEPTIONS = { 'level-sensor': ['ppm'] };

/**
 * @description The SDK key of a category value ('ph-sensor' -> 'PH_SENSOR').
 * @param {string} category - The category value.
 * @returns {string} The key.
 */
const categoryKey = (category) =>
  Object.keys(DEVICE_FEATURE_CATEGORIES).find((key) => DEVICE_FEATURE_CATEGORIES[key] === category);

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of [
    buildAnalyzerDevice(fakeGladys, analyzer),
    buildHubDevice(fakeGladys, hub),
  ]) {
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of [
      buildAnalyzerDevice(fakeGladys, analyzer, language),
      buildHubDevice(fakeGladys, hub, language),
    ]) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        for (const key of ['read_only', 'has_feedback', 'keep_history']) {
          assert.equal(typeof feature[key], 'boolean', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.name.length > 0 && feature.name.length <= 80, feature.external_id);
      }
    }
  }
});

test('category / type pairs come from the SDK constants, units from the core table', () => {
  const units = Object.values(DEVICE_FEATURE_UNITS);
  const features = [
    ...buildAnalyzerDevice(fakeGladys, analyzer).features,
    ...buildHubDevice(fakeGladys, hub).features,
  ];
  for (const feature of features) {
    const key = categoryKey(feature.category);
    assert.ok(key, `${feature.external_id}: unknown category ${feature.category}`);
    const types = { ...DEVICE_FEATURE_TYPES.SENSOR, ...DEVICE_FEATURE_TYPES[key] };
    assert.ok(
      Object.values(types).includes(feature.type),
      `${feature.external_id}: ${feature.type}`,
    );
    if (feature.unit !== undefined) {
      assert.ok(units.includes(feature.unit), `${feature.external_id}: ${feature.unit}`);
      const allowed = UNITS[feature.category] ?? UNIT_EXCEPTIONS[feature.category];
      assert.ok(allowed?.includes(feature.unit), `${feature.external_id}: ${feature.unit}`);
    }
  }
  // Several decimal features: the dashboard shows their names, not a generic label.
  const decimals = features.filter(
    (feature) => feature.type === DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
  );
  assert.ok(decimals.length >= 2);
});

test('the Hub mode is a select of the three Flipr modes; commands are writable', () => {
  const [filtration, mode] = buildHubDevice(fakeGladys, hub, 'fr').features;
  assert.equal(filtration.read_only, false);
  assert.equal(filtration.has_feedback, true);
  assert.equal(mode.category, DEVICE_FEATURE_CATEGORIES.TEXT);
  assert.equal(mode.type, DEVICE_FEATURE_TYPES.TEXT.SELECT);
  assert.deepEqual(
    mode.supported_options.map((option) => [option.value, option.label]),
    [
      ['auto', 'Automatique'],
      ['manual', 'Manuel'],
      ['planning', 'Programmation'],
    ],
  );
});

test('states: rounded numbers, rating texts, nothing for unknown values', () => {
  const states = buildAnalyzerStates(fakeGladys, 'AB256C', readMeasure(rawMeasure()), 'de');
  const byKey = Object.fromEntries(
    states.map((state) => [
      state.device_feature_external_id.split(':').pop(),
      state.state ?? state.text,
    ]),
  );
  assert.deepEqual(byKey, {
    temperature: 26.4,
    ph: 7.21,
    chlorine: 1.23,
    redox: 702,
    battery: 75,
    ph_status: 'Ideal',
    chlorine_status: 'Ideal',
  });
  const partial = { measuredAt: 1, temperature: 20, ph: null, chlorine: null, redox: null };
  assert.equal(buildAnalyzerStates(fakeGladys, 'AB256C', partial, 'en').length, 1);
  assert.deepEqual(buildHubStates(fakeGladys, 'CD256C', { on: null, mode: null }), []);
  assert.deepEqual(
    buildHubStates(fakeGladys, 'CD256C', { on: true, mode: 'auto' }).map((s) => s.state ?? s.text),
    [1, 'auto'],
  );
});

test('external ids are built on the serial and read back', () => {
  const device = buildAnalyzerDevice(fakeGladys, analyzer);
  assert.equal(device.external_id, 'ext:flipr:analyzer:AB256C');
  assert.equal(serialFromExternalId(device.features[0].external_id, 'analyzer'), 'AB256C');
  assert.equal(serialFromExternalId('ext:flipr:hub:CD256C', 'analyzer'), null);
  assert.equal(serialFromExternalId(undefined, 'hub'), null);
});
