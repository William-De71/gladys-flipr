// -----------------------------------------------------------------------------
// The reading loop: every `poll_interval` minutes, the modules of the account,
// the latest measure of each analyzer and the state of each Hub.
//
// It keeps the snapshots the devices, widgets, scene actions and triggers
// read, and hands each round to the app with its transitions (tracker.js).
// A round never overlaps another one; a failing module keeps its last
// snapshot, a failing account read fails the round (onError).
// -----------------------------------------------------------------------------

import { readModules, readMeasure, readHubState } from './read.js';
import { isStale, diffAnalyzer, diffHub } from './tracker.js';

/**
 * @description Create the watcher.
 * @param {object} options - Options.
 * @param {object} options.flipr - The Flipr client.
 * @param {Function} options.isEnabled - `() => boolean`: credentials known.
 * @param {Function} options.getIntervalMs - `() => number`.
 * @param {Function} options.onRound - `async (round) => void`.
 * @param {Function} options.onError - `async (err) => void`.
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {object} options.logger - Logger.
 * @returns {object} The watcher.
 * @example
 * const watcher = createWatcher({ flipr, isEnabled, getIntervalMs, onRound, onError, logger });
 * watcher.start();
 */
function createWatcher({
  flipr,
  isEnabled,
  getIntervalMs,
  onRound,
  onError,
  now = () => Date.now(),
  logger,
}) {
  let modules = [];
  // serial -> { serial, model, measure, stale }
  let analyzers = new Map();
  // serial -> { serial, model, on, mode }
  let hubs = new Map();
  let fetchedAt = null;
  let timer = null;
  let running = null;
  let started = false;

  /**
   * @description Read one module; a failure keeps the previous snapshot.
   * @param {Function} read - The read.
   * @param {string} serial - The serial, for the log.
   * @returns {Promise<unknown>} The answer, undefined on failure.
   */
  async function readOne(read, serial) {
    try {
      return await read();
    } catch (err) {
      if (err.kind === 'auth' || err.kind === 'rate_limit') {
        throw err;
      }
      logger.warn(`Flipr ${serial}: ${err.message}`);
      return undefined;
    }
  }

  /**
   * @description One reading of the whole account.
   * @returns {Promise<void>}
   */
  async function readAll() {
    const listed = readModules(await flipr.listModules());
    const at = now();
    const nextAnalyzers = new Map();
    const nextHubs = new Map();
    const round = { analyzers: [], hubs: [], modules: listed };

    for (const module of listed.filter((m) => m.kind === 'analyzer')) {
      const previous = analyzers.get(module.serial);
      const raw = await readOne(() => flipr.getMeasure(module.serial), module.serial);
      // No measure (winter mode, a failed read): the last one stays the latest.
      const measure = (raw === undefined ? null : readMeasure(raw)) ?? previous?.measure ?? null;
      const snapshot = {
        serial: module.serial,
        model: module.model,
        measure,
        stale: isStale(measure, at),
      };
      nextAnalyzers.set(module.serial, snapshot);
      round.analyzers.push({
        snapshot,
        events: diffAnalyzer(previous, snapshot),
        changed: !previous || previous.measure?.measuredAt !== measure?.measuredAt,
      });
    }

    for (const module of listed.filter((m) => m.kind === 'hub')) {
      const previous = hubs.get(module.serial);
      const raw = await readOne(() => flipr.getHubState(module.serial), module.serial);
      const state = raw === undefined ? null : readHubState(raw);
      const snapshot = {
        serial: module.serial,
        model: module.model,
        on: state?.on ?? previous?.on ?? null,
        mode: state?.mode ?? previous?.mode ?? null,
      };
      nextHubs.set(module.serial, snapshot);
      round.hubs.push({
        snapshot,
        events: diffHub(previous, snapshot),
        changed: !previous || previous.on !== snapshot.on || previous.mode !== snapshot.mode,
      });
    }

    modules = listed;
    analyzers = nextAnalyzers;
    hubs = nextHubs;
    fetchedAt = at;
    await onRound(round);
  }

  /**
   * @description Plan the next round.
   */
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (started) {
      timer = setTimeout(() => {
        round().finally(schedule);
      }, getIntervalMs());
      timer.unref?.();
    }
  }

  /**
   * @description Read the account now; joins a round already running.
   * @returns {Promise<void>} Never rejects: failures go to onError.
   */
  function round() {
    if (running) {
      return running;
    }
    if (!isEnabled()) {
      return Promise.resolve();
    }
    running = readAll()
      .catch(async (err) => {
        logger.warn(`Flipr reading failed: ${err.message}`);
        await onError(err);
      })
      .catch((err) => logger.error('Unable to report a reading failure', err))
      .finally(() => {
        running = null;
      });
    return running;
  }

  return {
    round,
    start: () => {
      started = true;
      schedule();
    },
    stop: () => {
      started = false;
      clearTimeout(timer);
      timer = null;
    },
    reschedule: schedule,
    /** @description Forget everything: the next round is a new baseline. */
    reset: () => {
      modules = [];
      analyzers = new Map();
      hubs = new Map();
      fetchedAt = null;
    },
    modules: () => modules,
    analyzers: () => [...analyzers.values()],
    hubs: () => [...hubs.values()],
    analyzer: (serial) => analyzers.get(serial) ?? null,
    hub: (serial) => hubs.get(serial) ?? null,
    fetchedAt: () => fetchedAt,
    /**
     * @description Apply a change the integration made itself: no event.
     * @param {string} serial - The Hub serial.
     * @param {object} patch - `{ on?, mode? }`.
     * @returns {object|null} The new snapshot.
     */
    patchHub: (serial, patch) => {
      const current = hubs.get(serial);
      if (!current) {
        return null;
      }
      const next = { ...current, ...patch };
      hubs.set(serial, next);
      return next;
    },
  };
}

export { createWatcher };
