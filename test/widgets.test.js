import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildPoolWidget,
  readPoolSettings,
  messageContent,
  CHART_FEATURES,
  CHART_INTERVALS,
} from '../src/widgets.js';
import { readMeasure } from '../src/read.js';
import { TEXTS, LANGUAGES } from '../src/i18n.js';
import { fakeGladys, rawMeasure, NOW, HOUR } from './helpers/fixtures.js';

const analyzer = (overrides = {}) => ({
  serial: 'AB256C',
  model: 'Start',
  measure: readMeasure(rawMeasure(overrides)),
  stale: false,
});
const hub = { serial: 'CD256C', on: true, mode: 'planning' };
const featureId = fakeGladys.externalIds('analyzer', 'AB256C').feature;
const types = (content) => content.components.map((component) => component.type);

/**
 * @description Assert a content is valid and within the budget of a card.
 * @param {object} content - The content.
 * @param {string} label - For the message.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (list) => types(content).filter((type) => list.includes(type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(count(['status']) <= 1, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
}

test('every variant of the pool widget is valid in every language, within the budget', () => {
  const variants = [
    { analyzer: analyzer(), hub, featureId },
    { analyzer: analyzer({ phSector: 'TooLow', chlorineSector: 'TooHigh' }) },
    {
      analyzer: { ...analyzer({ at: NOW - 30 * HOUR }), stale: true },
      hub: { ...hub, mode: null },
    },
    { analyzer: analyzer({ battery: 0.1 }), units: 'imperial', featureId },
    { analyzer: { ...analyzer(), measure: null } },
  ];
  for (const language of LANGUAGES) {
    for (const [i, variant] of variants.entries()) {
      for (const chart of CHART_FEATURES) {
        const content = buildPoolWidget({
          language,
          now: NOW,
          pollMinutes: 15,
          settings: readPoolSettings({ chart, interval: 'last-day' }),
          ...variant,
        });
        assertValid(content, `${language} #${i} ${chart}`);
      }
    }
  }
  for (const language of LANGUAGES) {
    assertValid(messageContent(TEXTS.noCredentials[language]), language);
  }
});

test('the most important first: caption, tiles, chart, advice, ratings', () => {
  const content = buildPoolWidget({
    analyzer: analyzer({ phSector: 'TooLow' }),
    hub,
    language: 'fr',
    now: NOW,
    pollMinutes: 15,
    featureId,
  });
  assert.deepEqual(types(content), [
    'text',
    'value',
    'value',
    'value',
    'value',
    'chart',
    'text',
    'status',
  ]);
  assert.equal(content.components[0].text, 'Mesuré il y a 1 h · Flipr AB256C');
  assert.equal(content.components[2].color, 'danger', 'pH too low');
  assert.equal(content.components[6].text, 'pH trop bas : ajoutez du pH plus.');
  assert.deepEqual(content.components[5].device_features, [
    'ext:flipr:analyzer:AB256C:temperature',
  ]);
  assert.equal(content.components[5].interval, 'last-week');
  const rows = content.components[7].items.map((item) => [item.label, item.value]);
  assert.deepEqual(rows, [
    ['pH', 'Trop bas'],
    ['Chlore', 'Idéal'],
    ['Batterie', '75 %'],
    ['Filtration', 'En marche · Programmation'],
  ]);
  assert.equal(content.ttl_seconds, 900);
});

test('no chart without the device, Fahrenheit for imperial units, stale advice', () => {
  const plain = buildPoolWidget({
    analyzer: analyzer(),
    language: 'en',
    now: NOW,
    pollMinutes: 15,
  });
  assert.ok(!types(plain).includes('chart'));
  const imperial = buildPoolWidget({
    analyzer: analyzer({ temperature: 25 }),
    language: 'en',
    units: 'imperial',
    now: NOW,
    pollMinutes: 15,
  });
  assert.deepEqual([imperial.components[1].value, imperial.components[1].unit], [77, '°F']);
  const stale = buildPoolWidget({
    analyzer: { ...analyzer({ at: NOW - 30 * HOUR }), stale: true },
    language: 'es',
    now: NOW,
    pollMinutes: 15,
  });
  assert.match(stale.components.find((c) => c.variant === 'body').text, /desde hace 30 h/);
});

test('settings: unknown values fall back to the defaults', () => {
  assert.deepEqual(readPoolSettings({ chart: 'salt', interval: 'forever' }), {
    chart: 'temperature',
    interval: 'last-week',
  });
  assert.deepEqual(readPoolSettings(), { chart: 'temperature', interval: 'last-week' });
  assert.ok(CHART_INTERVALS.includes('last-month'));
});
