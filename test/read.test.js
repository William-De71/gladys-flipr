import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readModules, readMeasure, readHubState, readSector, readInstant } from '../src/read.js';
import { rawModule, rawMeasure, rawHubState, NOW, HOUR } from './helpers/fixtures.js';

test('modules: analyzers and Hubs, sorted, duplicates and odd serials left out', () => {
  const modules = readModules([
    rawModule('CD256C', 2, 'Hub'),
    rawModule('AB256C', 1, 'Pro'),
    rawModule('AB256C', 1),
    rawModule('../x', 1),
    rawModule('EF1', 3),
  ]);
  assert.deepEqual(modules, [
    { serial: 'AB256C', kind: 'analyzer', model: 'Pro', suspended: false },
    { serial: 'CD256C', kind: 'hub', model: 'Hub', suspended: false },
  ]);
  assert.deepEqual(readModules(null), []);
});

test('a measure: values, ratings and the battery ratio', () => {
  assert.deepEqual(readMeasure(rawMeasure({ phSector: 'MediumLow', chlorineSector: 'TooHigh' })), {
    measuredAt: NOW - HOUR,
    temperature: 26.4,
    ph: 7.21,
    phStatus: 'low',
    chlorine: 1.2345,
    chlorineStatus: 'too_high',
    redox: 702,
    battery: 75,
  });
});

test('no measure in winter mode or before calibration: null, never zeros', () => {
  assert.equal(readMeasure({ Current: '' }), null);
  assert.equal(readMeasure({}), null);
  assert.equal(readMeasure(null), null);
  const winter = rawMeasure();
  winter.Current.Temperature = null;
  winter.Current.PH.Value = null;
  assert.equal(readMeasure(winter), null);
  const partial = rawMeasure();
  delete partial.Current.Desinfectant;
  delete partial.Current.Battery;
  const measure = readMeasure(partial);
  assert.equal(measure.chlorine, null);
  assert.equal(measure.chlorineStatus, null);
  assert.equal(measure.battery, null);
});

test('sectors, dates without a zone and Hub states', () => {
  assert.equal(readSector('TooLow'), 'too_low');
  assert.equal(readSector('Medium'), 'ideal');
  assert.equal(readSector('Unknown'), null);
  assert.equal(readInstant('2021-02-01T07:40:23.663'), Date.parse('2021-02-01T07:40:23.663Z'));
  assert.equal(readInstant('2021-02-01T07:40:21Z'), Date.parse('2021-02-01T07:40:21Z'));
  assert.equal(readInstant('nope'), null);
  assert.deepEqual(readHubState(rawHubState(1, 'Auto')), { on: true, mode: 'auto' });
  assert.deepEqual(readHubState(rawHubState(0, 'weird')), { on: false, mode: null });
  assert.deepEqual(readHubState({}), { on: null, mode: null });
});
