// -----------------------------------------------------------------------------
// Dashboard widget of the Flipr integration.
//
//   - `pool`  the water of a pool at a glance: temperature, pH, chlorine and
//             redox tiles (colored by the Flipr rating), the history of one
//             of them (the chart reads the states Gladys already keeps), what
//             to do, and the pH / chlorine ratings, the battery and the
//             filtration of a Hub.
//
// The contents come from the snapshots of the last reading: a widget never
// costs a Flipr call. Every text exists in the four languages (the content
// is cached per language and units).
// -----------------------------------------------------------------------------

import { t, formatNumber, ago } from './i18n.js';
import { FEATURE_KEYS } from './device.js';

const WIDGETS = { POOL: 'pool' };

const CHART_FEATURES = ['temperature', 'ph', 'chlorine', 'redox', 'none'];
const CHART_INTERVALS = ['last-day', 'last-three-days', 'last-week', 'last-month'];
const DEFAULT_CHART = 'temperature';
const DEFAULT_INTERVAL = 'last-week';
const TTL = { min: 60, max: 3600, message: 300 };
const LOW_BATTERY = 20;

const STATUS_COLORS = {
  too_low: 'danger',
  low: 'warning',
  ideal: 'success',
  high: 'warning',
  too_high: 'danger',
};
const CHART_UNITS = { temperature: '°C', ph: 'pH', chlorine: 'mg/L', redox: 'mV' };

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('A very long title', 10); // -> 'A very lo…'
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 * @example
 * messageContent('No analyzer');
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The settings of the widget, unknown values replaced by the defaults.
 * @param {object} [settings] - The raw settings.
 * @returns {{ chart: string, interval: string }} The settings.
 * @example
 * readPoolSettings({ chart: 'ph' }); // -> { chart: 'ph', interval: 'last-week' }
 */
function readPoolSettings(settings = {}) {
  return {
    chart: CHART_FEATURES.includes(settings.chart) ? settings.chart : DEFAULT_CHART,
    interval: CHART_INTERVALS.includes(settings.interval) ? settings.interval : DEFAULT_INTERVAL,
  };
}

const round = (value, digits) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10 ** digits) / 10 ** digits
    : '–';

/**
 * @description What to do about the water, one or two sentences.
 * @param {object} snapshot - The analyzer snapshot.
 * @param {string} language - The language.
 * @param {number} now - Now, in ms.
 * @returns {string} The advice.
 */
function advice(snapshot, language, now) {
  const { measure } = snapshot;
  if (snapshot.stale) {
    return t('adviceStale', language, {
      hours: Math.floor((now - measure.measuredAt) / 3600000),
    });
  }
  const parts = [];
  if (measure.phStatus && measure.phStatus !== 'ideal') {
    parts.push(t(`advice_ph_${measure.phStatus}`, language));
  }
  if (measure.chlorineStatus && measure.chlorineStatus !== 'ideal') {
    parts.push(t(`advice_chlorine_${measure.chlorineStatus}`, language));
  }
  return parts.length > 0 ? parts.join(' ') : t('adviceBalanced', language);
}

/**
 * @description A status row of a rating.
 * @param {string} label - The TEXTS key of the label.
 * @param {string|null} status - The rating.
 * @param {string} language - The language.
 * @returns {object} The row.
 */
function ratingRow(label, status, language) {
  return {
    label: t(label, language),
    value: t(`status_${status ?? 'unknown'}`, language),
    color: STATUS_COLORS[status] ?? 'neutral',
  };
}

/**
 * @description The `pool` widget.
 * @param {object} options - Options.
 * @param {object} options.analyzer - The analyzer snapshot (with a measure).
 * @param {object|null} [options.hub] - The Hub snapshot, if any.
 * @param {string} options.language - The user language.
 * @param {string} [options.units] - `metric` or `imperial`.
 * @param {number} options.now - Now, in ms.
 * @param {number} options.pollMinutes - The reading interval.
 * @param {object} [options.settings] - The widget settings (readPoolSettings).
 * @param {Function|null} [options.featureId] - `(key) => external id` of the
 * analyzer features, null when the device is not created (no chart then: the
 * core has no history of it).
 * @returns {object} The content.
 * @example
 * buildPoolWidget({ analyzer, language: 'fr', now: Date.now(), pollMinutes: 15 });
 */
function buildPoolWidget({
  analyzer,
  hub = null,
  language,
  units = 'metric',
  now,
  pollMinutes,
  settings = readPoolSettings(),
  featureId = null,
}) {
  const { measure } = analyzer;
  const name = t('analyzerDeviceName', language, { serial: analyzer.serial });
  const ttl = Math.min(TTL.max, Math.max(TTL.min, Math.round(pollMinutes * 60)));
  if (!measure) {
    return messageContent(`${name} · ${t('noMeasure', language)}`, ttl);
  }
  const imperial = units === 'imperial';
  const temperature =
    typeof measure.temperature === 'number' && imperial
      ? (measure.temperature * 9) / 5 + 32
      : measure.temperature;

  const components = [
    {
      type: 'text',
      variant: 'caption',
      text: clip(
        t('measuredAgo', language, { ago: ago(measure.measuredAt, now, language), name }),
        80,
      ),
    },
    {
      type: 'value',
      value: round(temperature, 1),
      unit: imperial ? '°F' : '°C',
      label: t('tileWater', language),
      icon: 'thermometer',
      color: 'info',
    },
    {
      type: 'value',
      value: round(measure.ph, 2),
      label: t('tilePh', language),
      icon: 'droplet',
      color: STATUS_COLORS[measure.phStatus] ?? 'neutral',
    },
    {
      type: 'value',
      value: round(measure.chlorine, 2),
      unit: 'mg/L',
      label: t('tileChlorine', language),
      icon: 'shield',
      color: STATUS_COLORS[measure.chlorineStatus] ?? 'neutral',
    },
    {
      type: 'value',
      value: round(measure.redox, 0),
      unit: 'mV',
      label: t('tileRedox', language),
      icon: 'zap',
    },
  ];

  if (featureId && settings.chart !== 'none') {
    components.push({
      type: 'chart',
      device_features: [featureId(FEATURE_KEYS[settings.chart.toUpperCase()])],
      interval: settings.interval,
      chart_type: 'line',
      title: t(`chart_${settings.chart}`, language),
      unit: CHART_UNITS[settings.chart],
    });
  }

  components.push({
    type: 'text',
    variant: 'body',
    text: clip(advice(analyzer, language, now), 300),
  });

  const rows = [
    ratingRow('rowPh', measure.phStatus, language),
    ratingRow('rowChlorine', measure.chlorineStatus, language),
  ];
  if (typeof measure.battery === 'number') {
    rows.push({
      label: t('rowBattery', language),
      value: `${formatNumber(measure.battery, language, 0)} %`,
      icon: 'battery',
      color: measure.battery < LOW_BATTERY ? 'danger' : 'success',
    });
  }
  if (hub && typeof hub.on === 'boolean') {
    const state = t(hub.on ? 'stateOn' : 'stateOff', language);
    rows.push({
      label: t('rowFiltration', language),
      value: clip(
        hub.mode
          ? t('filtrationValue', language, { state, mode: t(`mode_${hub.mode}`, language) })
          : state,
        40,
      ),
      color: hub.on ? 'success' : 'neutral',
    });
  }
  components.push({ type: 'status', items: rows });

  return { ttl_seconds: ttl, components };
}

export {
  WIDGETS,
  CHART_FEATURES,
  CHART_INTERVALS,
  DEFAULT_CHART,
  DEFAULT_INTERVAL,
  STATUS_COLORS,
  clip,
  messageContent,
  readPoolSettings,
  advice,
  buildPoolWidget,
};
