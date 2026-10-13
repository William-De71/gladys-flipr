// Scene event payloads and scene action outputs against the limits of the
// core and the declarations of the manifest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildAnalyzerEvent,
  buildHubEvent,
  buildMeasureOutputs,
  buildHubOutputs,
} from '../src/events.js';
import { readMeasure } from '../src/read.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, rawMeasure, NOW, HOUR } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const triggers = byKey(manifest.scene_triggers);
const actions = byKey(manifest.scene_actions);

const analyzer = {
  serial: 'AB256C',
  measure: readMeasure(rawMeasure({ phSector: 'TooHigh', ph: 7.9 })),
  stale: false,
};
const hub = { serial: 'CD256C', on: true, mode: 'auto' };

/**
 * @description Assert an event respects the core limits and its declaration.
 * @param {{ key: string, data: object }} event - The event.
 */
function assertEvent({ key, data }) {
  const trigger = triggers.get(key);
  assert.ok(trigger, key);
  const keys = Object.keys(data);
  assert.ok(keys.length <= 30, key);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(
      value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.length <= 1000),
      `${key}.${name}`,
    );
  }
  // Every filter has its value in the event, every declared variable too.
  for (const field of trigger.fields) {
    assert.ok(keys.includes(field.key), `${key}: filter ${field.key}`);
  }
  for (const variable of trigger.variables) {
    assert.ok(keys.includes(variable.key), `${key}: variable ${variable.key}`);
    const value = data[variable.key];
    if (value !== null) {
      assert.equal(typeof value, variable.type, `${key}.${variable.key}`);
    }
  }
  // Filter values are among the declared options.
  for (const field of trigger.fields.filter((f) => f.options)) {
    const values = field.options.map((option) => option.value);
    assert.ok(values.includes(data[field.key]), `${key}.${field.key}: ${data[field.key]}`);
  }
}

test('every event matches its trigger, in every language', () => {
  for (const language of LANGUAGES) {
    for (const event of [
      { key: 'new_measure' },
      { key: 'water_status_changed', parameter: 'ph', status: 'too_high', previous: 'ideal' },
      { key: 'measures_stopped' },
    ]) {
      const built = buildAnalyzerEvent(fakeGladys, analyzer, event, language, NOW + 30 * HOUR);
      assertEvent(built);
      assert.equal(built.data.device, 'ext:flipr:analyzer:AB256C');
    }
    assertEvent(buildHubEvent(fakeGladys, hub, language));
    assertEvent(buildHubEvent(fakeGladys, { ...hub, on: false }, language));
  }
});

test('summaries are ready for a message', () => {
  const { data } = buildAnalyzerEvent(fakeGladys, analyzer, { key: 'new_measure' }, 'fr', NOW);
  assert.equal(data.summary, 'Flipr AB256C : eau 26,4 °C, pH 7,9, chlore 1,23 mg/L.');
  const status = buildAnalyzerEvent(
    fakeGladys,
    analyzer,
    { key: 'water_status_changed', parameter: 'ph', status: 'too_high', previous: 'ideal' },
    'en',
    NOW,
  );
  assert.equal(status.data.summary, 'Flipr AB256C: pH too high (7.9).');
  assert.equal(
    buildHubEvent(fakeGladys, hub, 'de').data.summary,
    'Flipr Hub CD256C: Filterung gestartet (automatisch).',
  );
});

test('actions return exactly their declared outputs, typed', () => {
  const cases = [
    ['get_measure', buildMeasureOutputs(analyzer, 'en')],
    ['get_measure', buildMeasureOutputs({ ...analyzer, measure: null }, 'es')],
    ['set_filtration_mode', buildHubOutputs(hub)],
    ['set_filtration_mode', buildHubOutputs({ serial: 'X', on: null, mode: null })],
  ];
  for (const [key, outputs] of cases) {
    const declared = actions.get(key).outputs;
    assert.deepEqual(Object.keys(outputs).sort(), declared.map((output) => output.key).sort(), key);
    for (const output of declared) {
      assert.equal(typeof outputs[output.key], output.type, `${key}.${output.key}`);
    }
    for (const value of Object.values(outputs)) {
      assert.ok(typeof value !== 'string' || value.length <= 10000);
    }
  }
  assert.equal(buildMeasureOutputs({ ...analyzer, measure: null }, 'en').temperature, -1);
});
