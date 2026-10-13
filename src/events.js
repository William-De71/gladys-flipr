// -----------------------------------------------------------------------------
// Scene events and scene action outputs of the integration.
//
// The tracker says what happened; this module writes the flat `data` of the
// event the core matches against the scene triggers. Every event carries:
//   - `device`       the device external id: the value of the "Device"
//                    filter (a `source: "devices"` select);
//   - `device_name`  "Flipr AB256C", readable by the actions;
//   - `summary`      a sentence ready to put in a message;
// plus the fields of its kind. Values are scalars (null when Flipr did not
// say), texts cut at 1,000 characters.
// -----------------------------------------------------------------------------

import { SCENE_TRIGGERS, STALE_HOURS } from './tracker.js';
import { DEVICE_TYPES, idsOf } from './device.js';
import { t, formatNumber } from './i18n.js';

const MAX_TEXT = 1000;
const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);
const iso = (instant) => (Number.isFinite(instant) ? new Date(instant).toISOString() : null);
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * @description The values of a measure, shared by the new_measure event and
 * the get_measure action.
 * @param {object|null} measure - The measure.
 * @returns {object} Flat values.
 */
function measureValues(measure) {
  return {
    temperature: finite(measure?.temperature),
    ph: finite(measure?.ph),
    chlorine: finite(measure?.chlorine),
    redox: finite(measure?.redox),
    battery: finite(measure?.battery),
    ph_status: measure?.phStatus ?? null,
    chlorine_status: measure?.chlorineStatus ?? null,
    measured_at: iso(measure?.measuredAt),
  };
}

/**
 * @description "Flipr AB256C: water 26.4 °C, pH 7.2, chlorine 1.1 mg/L."
 * @param {string} name - The device name.
 * @param {object} measure - The measure.
 * @param {string} language - The language.
 * @returns {string} The sentence.
 */
function measureSummary(name, measure, language) {
  return t('summaryMeasure', language, {
    name,
    temperature: formatNumber(measure.temperature, language, 1),
    ph: formatNumber(measure.ph, language, 2),
    chlorine: formatNumber(measure.chlorine, language, 2),
  });
}

/**
 * @description The event of an analyzer transition.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The analyzer snapshot.
 * @param {object} event - From diffAnalyzer.
 * @param {string} language - Language of the summary.
 * @param {number} now - Now, in ms.
 * @returns {{ key: string, data: object }} The event.
 * @example
 * const { key, data } = buildAnalyzerEvent(gladys, snapshot, { key: 'new_measure' }, 'fr', Date.now());
 * await gladys.publishSceneEvent(key, data);
 */
function buildAnalyzerEvent(gladys, snapshot, event, language, now) {
  const name = t('analyzerDeviceName', language, { serial: snapshot.serial });
  const { measure } = snapshot;
  const data = {
    device: idsOf(gladys, DEVICE_TYPES.ANALYZER, snapshot.serial).device,
    device_name: clip(name),
  };
  switch (event.key) {
    case SCENE_TRIGGERS.NEW_MEASURE:
      Object.assign(data, measureValues(measure), {
        summary: clip(measureSummary(name, measure, language)),
      });
      break;
    case SCENE_TRIGGERS.WATER_STATUS_CHANGED: {
      const value = finite(measure?.[event.parameter]);
      Object.assign(data, {
        parameter: event.parameter,
        status: event.status,
        previous_status: event.previous,
        value,
        summary: clip(
          t('summaryStatus', language, {
            name,
            parameter: t(`param_${event.parameter}`, language),
            status: t(`status_${event.status}`, language).toLowerCase(),
            value: formatNumber(value, language, 2),
          }),
        ),
      });
      break;
    }
    case SCENE_TRIGGERS.MEASURES_STOPPED: {
      const hours = measure ? Math.floor((now - measure.measuredAt) / 3600000) : STALE_HOURS;
      Object.assign(data, {
        last_measure_at: iso(measure?.measuredAt),
        hours,
        summary: clip(t('summaryStopped', language, { name, hours })),
      });
      break;
    }
    default:
      throw new Error(`Unknown analyzer event: ${event.key}`);
  }
  return { key: event.key, data };
}

/**
 * @description The event of a Hub transition (filtration_changed).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The Hub snapshot.
 * @param {string} language - Language of the summary.
 * @returns {{ key: string, data: object }} The event.
 */
function buildHubEvent(gladys, snapshot, language) {
  const name = t('hubDeviceName', language, { serial: snapshot.serial });
  const mode = snapshot.mode ? t(`mode_${snapshot.mode}`, language).toLowerCase() : '?';
  return {
    key: SCENE_TRIGGERS.FILTRATION_CHANGED,
    data: {
      device: idsOf(gladys, DEVICE_TYPES.HUB, snapshot.serial).device,
      device_name: clip(name),
      state: snapshot.on ? 'on' : 'off',
      mode: snapshot.mode,
      summary: clip(
        t(snapshot.on ? 'summaryFiltrationOn' : 'summaryFiltrationOff', language, { name, mode }),
      ),
    },
  };
}

/**
 * @description The outputs of the get_measure scene action. Numbers the
 * analyzer did not send are -1 (outputs are typed), texts are empty.
 * @param {object} snapshot - The analyzer snapshot.
 * @param {string} language - Language of the summary.
 * @returns {object} The outputs.
 */
function buildMeasureOutputs(snapshot, language) {
  const name = t('analyzerDeviceName', language, { serial: snapshot.serial });
  const values = measureValues(snapshot.measure);
  const number = (value) => value ?? -1;
  return {
    temperature: number(values.temperature),
    ph: number(values.ph),
    chlorine: number(values.chlorine),
    redox: number(values.redox),
    battery: number(values.battery),
    ph_status: values.ph_status ?? '',
    chlorine_status: values.chlorine_status ?? '',
    measured_at: values.measured_at ?? '',
    summary: snapshot.measure
      ? clip(measureSummary(name, snapshot.measure, language))
      : clip(`${name}: ${t('noMeasure', language)}`),
  };
}

/**
 * @description The outputs of the set_filtration_mode scene action.
 * @param {object} snapshot - The Hub snapshot.
 * @returns {{ state: string, mode: string }} The outputs.
 */
function buildHubOutputs(snapshot) {
  return {
    state: typeof snapshot.on === 'boolean' ? (snapshot.on ? 'on' : 'off') : '',
    mode: snapshot.mode ?? '',
  };
}

export { measureValues, buildAnalyzerEvent, buildHubEvent, buildMeasureOutputs, buildHubOutputs };
