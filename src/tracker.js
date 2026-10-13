// -----------------------------------------------------------------------------
// Snapshots -> scene trigger transitions (pure logic, no I/O).
//
// One event per transition, never a periodic snapshot:
//   - new_measure           the analyzer sent a measure newer than the last one;
//   - water_status_changed  with a new measure, the pH or the chlorine moved to
//                           another rating (too low, slightly low, ideal,
//                           slightly high, too high);
//   - measures_stopped      no new measure for STALE_HOURS (fired once, again
//                           only after measures came back);
//   - filtration_changed    the Hub switched the pump on or off by itself
//                           (its schedule, its automatic mode, the Flipr app).
//
// A module seen for the first time (start, restart, new account) is a
// baseline: nothing that happened before is replayed. The changes the
// integration makes itself (a command from Gladys) are applied to the
// snapshot without an event, so a scene action never triggers a scene.
// -----------------------------------------------------------------------------

const SCENE_TRIGGERS = {
  NEW_MEASURE: 'new_measure',
  WATER_STATUS_CHANGED: 'water_status_changed',
  MEASURES_STOPPED: 'measures_stopped',
  FILTRATION_CHANGED: 'filtration_changed',
};

const PARAMETERS = ['ph', 'chlorine'];
const STALE_HOURS = 24;
const HOUR = 3600000;

/**
 * @description Whether the measures of an analyzer stopped coming.
 * @param {object|null} measure - The latest measure.
 * @param {number} now - Now, in ms.
 * @returns {boolean} True when the latest one is older than STALE_HOURS.
 * @example
 * isStale({ measuredAt: Date.now() - 25 * 3600000 }, Date.now()); // -> true
 */
function isStale(measure, now) {
  return Boolean(measure) && now - measure.measuredAt > STALE_HOURS * HOUR;
}

/**
 * @description The transitions between two snapshots of an analyzer.
 * @param {object|undefined} previous - `{ measure, stale }`, undefined the first time.
 * @param {object} next - `{ measure, stale }`.
 * @returns {Array<object>} `{ key, parameter?, status?, previous? }` events.
 * @example
 * diffAnalyzer(before, after); // -> [{ key: 'new_measure' }]
 */
function diffAnalyzer(previous, next) {
  if (!previous) {
    return [];
  }
  const events = [];
  const before = previous.measure;
  const after = next.measure;
  if (after && (!before || after.measuredAt > before.measuredAt)) {
    events.push({ key: SCENE_TRIGGERS.NEW_MEASURE });
    for (const parameter of PARAMETERS) {
      const was = before?.[`${parameter}Status`] ?? null;
      const is = after[`${parameter}Status`] ?? null;
      if (was && is && was !== is) {
        events.push({
          key: SCENE_TRIGGERS.WATER_STATUS_CHANGED,
          parameter,
          status: is,
          previous: was,
        });
      }
    }
  }
  if (next.stale && !previous.stale) {
    events.push({ key: SCENE_TRIGGERS.MEASURES_STOPPED });
  }
  return events;
}

/**
 * @description The transitions between two states of a Hub.
 * @param {object|undefined} previous - `{ on, mode }`, undefined the first time.
 * @param {object} next - `{ on, mode }`.
 * @returns {Array<object>} `{ key }` events.
 * @example
 * diffHub({ on: false }, { on: true, mode: 'planning' }); // -> [{ key: 'filtration_changed' }]
 */
function diffHub(previous, next) {
  if (!previous || typeof previous.on !== 'boolean' || typeof next.on !== 'boolean') {
    return [];
  }
  return previous.on === next.on ? [] : [{ key: SCENE_TRIGGERS.FILTRATION_CHANGED }];
}

export { SCENE_TRIGGERS, PARAMETERS, STALE_HOURS, isStale, diffAnalyzer, diffHub };
