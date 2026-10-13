// -----------------------------------------------------------------------------
// Flipr API answers -> plain snapshots.
//
// Every value the API may leave out becomes null: a module in winter mode or
// not calibrated yet answers a measure without temperature, an older analyzer
// may have no disinfectant probe. Nothing unknown is ever turned into 0.
// -----------------------------------------------------------------------------

import { HUB_MODES } from './flipr-api.js';

const MODULE_KINDS = { 1: 'analyzer', 2: 'hub' };

// The deviation sectors of the API, in the vocabulary of the integration.
const SECTORS = {
  toolow: 'too_low',
  mediumlow: 'low',
  medium: 'ideal',
  mediumhigh: 'high',
  toohigh: 'too_high',
};
const STATUSES = ['too_low', 'low', 'ideal', 'high', 'too_high'];

/**
 * @description A finite number, or null.
 * @param {unknown} value - The raw value.
 * @returns {number|null} The number.
 * @example
 * numberOrNull('7.2'); // -> 7.2
 */
function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * @description An instant of the API, in ms. The API writes some dates
 * without a zone: they are UTC.
 * @param {unknown} value - The raw date.
 * @returns {number|null} The instant.
 * @example
 * readInstant('2026-07-01T07:40:21Z'); // -> 1782891621000
 */
function readInstant(value) {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const instant = Date.parse(zoned);
  return Number.isFinite(instant) ? instant : null;
}

/**
 * @description The status of a deviation sector.
 * @param {unknown} sector - TooLow, MediumLow, Medium, MediumHigh or TooHigh.
 * @returns {string|null} too_low, low, ideal, high or too_high.
 * @example
 * readSector('MediumHigh'); // -> 'high'
 */
function readSector(sector) {
  return typeof sector === 'string' ? (SECTORS[sector.toLowerCase()] ?? null) : null;
}

/**
 * @description The modules of the account: analyzers and Hubs, others left out.
 * @param {unknown} raw - The answer of GET /modules.
 * @returns {Array<{ serial: string, kind: string, model: string|null, suspended: boolean }>}
 * The modules, sorted by kind then serial.
 * @example
 * readModules([{ Serial: 'AB256C', ModuleType_Id: 1 }]);
 */
function readModules(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set();
  return raw
    .map((module) => ({
      serial:
        typeof module?.Serial === 'string' ? module.Serial.trim() : String(module?.Serial ?? ''),
      kind: MODULE_KINDS[module?.ModuleType_Id] ?? null,
      model: typeof module?.CommercialType?.Value === 'string' ? module.CommercialType.Value : null,
      suspended: module?.IsSuspended === true,
    }))
    .filter((module) => {
      // A serial is the eternal external id: letters and digits only.
      if (!module.kind || !/^[A-Za-z0-9]{1,40}$/.test(module.serial) || seen.has(module.serial)) {
        return false;
      }
      seen.add(module.serial);
      return true;
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.serial.localeCompare(b.serial));
}

/**
 * @description The latest measure of an analyzer.
 * @param {unknown} raw - The answer of GET /modules/{serial}/NewResume.
 * @returns {object|null} `{ measuredAt, temperature, ph, phStatus, chlorine,
 * chlorineStatus, redox, battery }`, null when the module has no measure
 * (winter mode, not calibrated, just installed).
 * @example
 * readMeasure({ Current: { DateTime: '2026-07-01T07:40:21Z', Temperature: 26.4 } });
 */
function readMeasure(raw) {
  const current = raw?.Current;
  if (!current || typeof current !== 'object') {
    return null;
  }
  const measuredAt = readInstant(current.DateTime);
  const temperature = numberOrNull(current.Temperature);
  const ph = numberOrNull(current.PH?.Value);
  if (measuredAt === null || (temperature === null && ph === null)) {
    return null;
  }
  const deviation = numberOrNull(current.Battery?.Deviation);
  return {
    measuredAt,
    temperature,
    ph,
    phStatus: readSector(current.PH?.DeviationSector),
    chlorine: numberOrNull(current.Desinfectant?.Value),
    chlorineStatus: readSector(current.Desinfectant?.DeviationSector),
    redox: numberOrNull(current.OxydoReductionPotentiel?.Value),
    // The API gives the battery as a 0..1 ratio.
    battery: deviation === null ? null : Math.max(0, Math.min(100, Math.round(deviation * 100))),
  };
}

/**
 * @description The state of a Hub.
 * @param {unknown} raw - The answer of GET /hub/{serial}/state.
 * @returns {{ on: boolean|null, mode: string|null }} The state.
 * @example
 * readHubState({ stateEquipment: 1, behavior: 'auto' }); // -> { on: true, mode: 'auto' }
 */
function readHubState(raw) {
  const state = raw?.stateEquipment;
  const mode = typeof raw?.behavior === 'string' ? raw.behavior.toLowerCase() : null;
  return {
    on: state === null || state === undefined ? null : Boolean(Number(state)),
    mode: HUB_MODES.includes(mode) ? mode : null,
  };
}

export { STATUSES, numberOrNull, readInstant, readSector, readModules, readMeasure, readHubState };
