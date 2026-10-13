// -----------------------------------------------------------------------------
// Configuration of the Flipr integration.
//
// Fields of the config_schema:
//   - `email`          the e-mail of the Flipr account (the one of the app);
//   - `password`       its password (a `secret`: never sent back to the UI,
//                      never logged);
//   - `poll_interval`  how often the Flipr cloud is read, in minutes;
//   - `language`       language of the texts Gladys does not ask for in a
//                      language (feature names, Hub mode labels, scene
//                      summaries): `auto` follows the language of the last
//                      widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, kept for the
//                      texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

// A Flipr analyzer sends a measure about once an hour: reading every 15
// minutes catches it without loading the Flipr cloud.
const POLL_INTERVAL = { min: 5, max: 60, default: 15 };
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('30', POLL_INTERVAL); // -> 30
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ email: string, password: string, pollInterval: number, language: string }}
 * The config (poll interval in minutes, language 'auto' or a language code).
 * @example
 * normalizeConfig({ email: 'me@example.com', password: 'secret' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    email: readString(config.email),
    // A password may start or end with a space: kept as typed.
    password: typeof config.password === 'string' ? config.password : '',
    pollInterval: readNumber(config.poll_interval, POLL_INTERVAL),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Whether the account can be read.
 * @param {object} config - A normalized config.
 * @returns {boolean} True with an e-mail and a password.
 */
const hasCredentials = (config) => Boolean(config.email && config.password);

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  POLL_INTERVAL,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  hasCredentials,
  readLanguage,
};
