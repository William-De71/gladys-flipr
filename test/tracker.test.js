import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffAnalyzer, diffHub, isStale, STALE_HOURS } from '../src/tracker.js';
import { NOW, HOUR } from './helpers/fixtures.js';

const measure = (overrides = {}) => ({
  measuredAt: NOW,
  ph: 7.2,
  phStatus: 'ideal',
  chlorine: 1,
  chlorineStatus: 'ideal',
  ...overrides,
});
const keys = (events) => events.map((event) => event.key);

test('the first snapshot is a baseline', () => {
  assert.deepEqual(diffAnalyzer(undefined, { measure: measure(), stale: true }), []);
  assert.deepEqual(diffHub(undefined, { on: true }), []);
});

test('a newer measure, and a rating that moved', () => {
  const before = { measure: measure({ measuredAt: NOW - HOUR }), stale: false };
  assert.deepEqual(keys(diffAnalyzer(before, { measure: measure(), stale: false })), [
    'new_measure',
  ]);
  const events = diffAnalyzer(before, {
    measure: measure({ phStatus: 'too_low', chlorineStatus: 'high' }),
    stale: false,
  });
  assert.deepEqual(events, [
    { key: 'new_measure' },
    { key: 'water_status_changed', parameter: 'ph', status: 'too_low', previous: 'ideal' },
    { key: 'water_status_changed', parameter: 'chlorine', status: 'high', previous: 'ideal' },
  ]);
  assert.deepEqual(diffAnalyzer(before, before), [], 'same measure, nothing');
  assert.deepEqual(
    keys(diffAnalyzer({ measure: null, stale: false }, { measure: measure(), stale: false })),
    ['new_measure'],
    'first measure after the winter',
  );
});

test('measures stopped: once, then again only after they came back', () => {
  const old = measure({ measuredAt: NOW - (STALE_HOURS + 1) * HOUR });
  assert.ok(isStale(old, NOW));
  assert.ok(!isStale(null, NOW));
  const fresh = { measure: measure({ measuredAt: NOW - 2 * HOUR }), stale: false };
  const stale = { measure: old, stale: true };
  assert.deepEqual(keys(diffAnalyzer(fresh, stale)), ['measures_stopped']);
  assert.deepEqual(diffAnalyzer(stale, stale), []);
});

test('the Hub: on/off transitions only', () => {
  assert.deepEqual(keys(diffHub({ on: false, mode: 'planning' }, { on: true, mode: 'planning' })), [
    'filtration_changed',
  ]);
  assert.deepEqual(diffHub({ on: true, mode: 'auto' }, { on: true, mode: 'manual' }), []);
  assert.deepEqual(diffHub({ on: null }, { on: true }), []);
});
