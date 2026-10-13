// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface:
// appareil / Gerät / dispositivo, scène / Szene / escena.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  analyzerDeviceName: {
    en: 'Flipr {serial}',
    fr: 'Flipr {serial}',
    de: 'Flipr {serial}',
    es: 'Flipr {serial}',
  },
  hubDeviceName: {
    en: 'Flipr Hub {serial}',
    fr: 'Flipr Hub {serial}',
    de: 'Flipr Hub {serial}',
    es: 'Flipr Hub {serial}',
  },
  featureTemperature: {
    en: 'Water temperature',
    fr: 'Température de l’eau',
    de: 'Wassertemperatur',
    es: 'Temperatura del agua',
  },
  featurePh: { en: 'pH', fr: 'pH', de: 'pH-Wert', es: 'pH' },
  featureChlorine: { en: 'Chlorine', fr: 'Chlore', de: 'Chlor', es: 'Cloro' },
  featureRedox: { en: 'Redox (ORP)', fr: 'Redox (ORP)', de: 'Redox (ORP)', es: 'Redox (ORP)' },
  featureBattery: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  featurePhStatus: { en: 'pH status', fr: 'État du pH', de: 'pH-Zustand', es: 'Estado del pH' },
  featureChlorineStatus: {
    en: 'Chlorine status',
    fr: 'État du chlore',
    de: 'Chlor-Zustand',
    es: 'Estado del cloro',
  },
  featureFiltration: { en: 'Filtration', fr: 'Filtration', de: 'Filterung', es: 'Filtración' },
  featureMode: {
    en: 'Filtration mode',
    fr: 'Mode de filtration',
    de: 'Filtermodus',
    es: 'Modo de filtración',
  },

  // water statuses (deviation sectors of Flipr)
  status_too_low: { en: 'Too low', fr: 'Trop bas', de: 'Zu niedrig', es: 'Demasiado bajo' },
  status_low: { en: 'Slightly low', fr: 'Un peu bas', de: 'Etwas niedrig', es: 'Algo bajo' },
  status_ideal: { en: 'Ideal', fr: 'Idéal', de: 'Ideal', es: 'Ideal' },
  status_high: { en: 'Slightly high', fr: 'Un peu haut', de: 'Etwas hoch', es: 'Algo alto' },
  status_too_high: { en: 'Too high', fr: 'Trop haut', de: 'Zu hoch', es: 'Demasiado alto' },
  status_unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },

  // Hub
  mode_auto: { en: 'Automatic', fr: 'Automatique', de: 'Automatisch', es: 'Automático' },
  mode_manual: { en: 'Manual', fr: 'Manuel', de: 'Manuell', es: 'Manual' },
  mode_planning: { en: 'Schedule', fr: 'Programmation', de: 'Zeitplan', es: 'Programación' },
  stateOn: { en: 'On', fr: 'En marche', de: 'Ein', es: 'Encendida' },
  stateOff: { en: 'Off', fr: 'Arrêtée', de: 'Aus', es: 'Apagada' },
  filtrationValue: {
    en: '{state} · {mode}',
    fr: '{state} · {mode}',
    de: '{state} · {mode}',
    es: '{state} · {mode}',
  },

  // parameters, in a sentence
  param_ph: { en: 'pH', fr: 'pH', de: 'pH-Wert', es: 'pH' },
  param_chlorine: { en: 'chlorine', fr: 'chlore', de: 'Chlor', es: 'cloro' },

  // widget
  tileWater: { en: 'Water', fr: 'Eau', de: 'Wasser', es: 'Agua' },
  tilePh: { en: 'pH', fr: 'pH', de: 'pH', es: 'pH' },
  tileChlorine: { en: 'Chlorine', fr: 'Chlore', de: 'Chlor', es: 'Cloro' },
  tileRedox: { en: 'Redox', fr: 'Redox', de: 'Redox', es: 'Redox' },
  rowPh: { en: 'pH', fr: 'pH', de: 'pH-Wert', es: 'pH' },
  rowChlorine: { en: 'Chlorine', fr: 'Chlore', de: 'Chlor', es: 'Cloro' },
  rowBattery: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  rowFiltration: { en: 'Filtration', fr: 'Filtration', de: 'Filterung', es: 'Filtración' },
  measuredAgo: {
    en: 'Measured {ago} · {name}',
    fr: 'Mesuré {ago} · {name}',
    de: 'Gemessen {ago} · {name}',
    es: 'Medido {ago} · {name}',
  },
  chart_temperature: {
    en: 'Water temperature',
    fr: 'Température de l’eau',
    de: 'Wassertemperatur',
    es: 'Temperatura del agua',
  },
  chart_ph: { en: 'pH', fr: 'pH', de: 'pH-Wert', es: 'pH' },
  chart_chlorine: { en: 'Chlorine', fr: 'Chlore', de: 'Chlor', es: 'Cloro' },
  chart_redox: { en: 'Redox (ORP)', fr: 'Redox (ORP)', de: 'Redox (ORP)', es: 'Redox (ORP)' },
  adviceBalanced: {
    en: 'Water balanced: nothing to do.',
    fr: 'Eau équilibrée : rien à faire.',
    de: 'Wasser im Gleichgewicht: nichts zu tun.',
    es: 'Agua equilibrada: nada que hacer.',
  },
  advice_ph_too_low: {
    en: 'pH too low: add pH plus.',
    fr: 'pH trop bas : ajoutez du pH plus.',
    de: 'pH-Wert zu niedrig: Geben Sie pH-Plus zu.',
    es: 'pH demasiado bajo: añada pH más.',
  },
  advice_ph_low: {
    en: 'pH slightly low: keep an eye on it.',
    fr: 'pH un peu bas : surveillez-le.',
    de: 'pH-Wert etwas niedrig: Behalten Sie ihn im Auge.',
    es: 'pH algo bajo: vigílelo.',
  },
  advice_ph_high: {
    en: 'pH slightly high: keep an eye on it.',
    fr: 'pH un peu haut : surveillez-le.',
    de: 'pH-Wert etwas hoch: Behalten Sie ihn im Auge.',
    es: 'pH algo alto: vigílelo.',
  },
  advice_ph_too_high: {
    en: 'pH too high: add pH minus.',
    fr: 'pH trop haut : ajoutez du pH moins.',
    de: 'pH-Wert zu hoch: Geben Sie pH-Minus zu.',
    es: 'pH demasiado alto: añada pH menos.',
  },
  advice_chlorine_too_low: {
    en: 'Chlorine too low: add chlorine or check the chlorinator.',
    fr: 'Chlore trop bas : ajoutez du chlore ou vérifiez l’électrolyseur.',
    de: 'Chlor zu niedrig: Geben Sie Chlor zu oder prüfen Sie die Elektrolyse.',
    es: 'Cloro demasiado bajo: añada cloro o revise el clorador.',
  },
  advice_chlorine_low: {
    en: 'Chlorine slightly low: keep an eye on it.',
    fr: 'Chlore un peu bas : surveillez-le.',
    de: 'Chlor etwas niedrig: Behalten Sie es im Auge.',
    es: 'Cloro algo bajo: vigílelo.',
  },
  advice_chlorine_high: {
    en: 'Chlorine slightly high: keep an eye on it.',
    fr: 'Chlore un peu haut : surveillez-le.',
    de: 'Chlor etwas hoch: Behalten Sie es im Auge.',
    es: 'Cloro algo alto: vigílelo.',
  },
  advice_chlorine_too_high: {
    en: 'Chlorine too high: pause the treatment until it drops.',
    fr: 'Chlore trop haut : suspendez le traitement le temps qu’il baisse.',
    de: 'Chlor zu hoch: Setzen Sie die Behandlung aus, bis der Wert sinkt.',
    es: 'Cloro demasiado alto: pause el tratamiento hasta que baje.',
  },
  adviceStale: {
    en: 'No measure for {hours} h: check the Flipr (battery, winter mode, network).',
    fr: 'Aucune mesure depuis {hours} h : vérifiez le Flipr (pile, mode hiver, réseau).',
    de: 'Seit {hours} h keine Messung: Prüfen Sie den Flipr (Batterie, Wintermodus, Netz).',
    es: 'Sin medida desde hace {hours} h: revise el Flipr (pila, modo invierno, red).',
  },
  noCredentials: {
    en: 'Enter the e-mail and the password of your Flipr account in the configuration.',
    fr: 'Saisissez l’e-mail et le mot de passe de votre compte Flipr dans la configuration.',
    de: 'Geben Sie E-Mail und Passwort Ihres Flipr-Kontos in der Konfiguration ein.',
    es: 'Introduzca el correo y la contraseña de su cuenta Flipr en la configuración.',
  },
  notReadYet: {
    en: 'Reading Flipr…',
    fr: 'Lecture de Flipr…',
    de: 'Flipr wird gelesen…',
    es: 'Leyendo Flipr…',
  },
  noAnalyzer: {
    en: 'No Flipr analyzer in this account.',
    fr: 'Aucun analyseur Flipr dans ce compte.',
    de: 'Kein Flipr-Analysator in diesem Konto.',
    es: 'Ningún analizador Flipr en esta cuenta.',
  },
  noMeasure: {
    en: 'No measure yet: the Flipr may be in winter mode or not calibrated.',
    fr: 'Pas encore de mesure : le Flipr est peut-être en mode hiver ou pas calibré.',
    de: 'Noch keine Messung: Der Flipr ist vielleicht im Wintermodus oder nicht kalibriert.',
    es: 'Aún sin medida: el Flipr puede estar en modo invierno o sin calibrar.',
  },

  // relative times
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },

  // scene summaries
  summaryMeasure: {
    en: '{name}: water {temperature} °C, pH {ph}, chlorine {chlorine} mg/L.',
    fr: '{name} : eau {temperature} °C, pH {ph}, chlore {chlorine} mg/L.',
    de: '{name}: Wasser {temperature} °C, pH {ph}, Chlor {chlorine} mg/L.',
    es: '{name}: agua {temperature} °C, pH {ph}, cloro {chlorine} mg/L.',
  },
  summaryStatus: {
    en: '{name}: {parameter} {status} ({value}).',
    fr: '{name} : {parameter} {status} ({value}).',
    de: '{name}: {parameter} {status} ({value}).',
    es: '{name}: {parameter} {status} ({value}).',
  },
  summaryFiltrationOn: {
    en: '{name}: filtration started ({mode}).',
    fr: '{name} : filtration en marche ({mode}).',
    de: '{name}: Filterung gestartet ({mode}).',
    es: '{name}: filtración en marcha ({mode}).',
  },
  summaryFiltrationOff: {
    en: '{name}: filtration stopped ({mode}).',
    fr: '{name} : filtration arrêtée ({mode}).',
    de: '{name}: Filterung gestoppt ({mode}).',
    es: '{name}: filtración detenida ({mode}).',
  },
  summaryStopped: {
    en: '{name}: no measure for {hours} h.',
    fr: '{name} : aucune mesure depuis {hours} h.',
    de: '{name}: seit {hours} h keine Messung.',
    es: '{name}: sin medida desde hace {hours} h.',
  },

  // connection status and Configuration screen
  statusConnected: {
    en: 'Connected to Flipr: {analyzers} analyzer(s), {hubs} Hub(s).',
    fr: 'Connecté à Flipr : {analyzers} analyseur(s), {hubs} Hub(s).',
    de: 'Mit Flipr verbunden: {analyzers} Analysator(en), {hubs} Hub(s).',
    es: 'Conectado a Flipr: {analyzers} analizador(es), {hubs} Hub(s).',
  },
  statusNoModule: {
    en: 'Connected, but this Flipr account has no analyzer nor Hub.',
    fr: 'Connecté, mais ce compte Flipr n’a ni analyseur ni Hub.',
    de: 'Verbunden, aber dieses Flipr-Konto hat weder Analysator noch Hub.',
    es: 'Conectado, pero esta cuenta Flipr no tiene analizador ni Hub.',
  },
  statusInvalidCredentials: {
    en: 'Flipr refused the e-mail or the password: check them in the configuration.',
    fr: 'Flipr a refusé l’e-mail ou le mot de passe : vérifiez-les dans la configuration.',
    de: 'Flipr hat E-Mail oder Passwort abgelehnt: Prüfen Sie sie in der Konfiguration.',
    es: 'Flipr rechazó el correo o la contraseña: revíselos en la configuración.',
  },
  statusRateLimited: {
    en: 'Flipr limits the requests for now: new try at the next reading.',
    fr: 'Flipr limite les requêtes pour le moment : nouvel essai à la prochaine lecture.',
    de: 'Flipr begrenzt die Anfragen gerade: neuer Versuch beim nächsten Lesen.',
    es: 'Flipr limita las peticiones por ahora: nuevo intento en la próxima lectura.',
  },
  statusUnreachable: {
    en: 'The Flipr cloud does not answer: new try at the next reading.',
    fr: 'Le cloud Flipr ne répond pas : nouvel essai à la prochaine lecture.',
    de: 'Die Flipr-Cloud antwortet nicht: neuer Versuch beim nächsten Lesen.',
    es: 'La nube de Flipr no responde: nuevo intento en la próxima lectura.',
  },
  testOk: {
    en: 'Signed in to Flipr: {analyzers} analyzer(s) and {hubs} Hub(s) found.',
    fr: 'Connexion à Flipr réussie : {analyzers} analyseur(s) et {hubs} Hub(s) trouvés.',
    de: 'Bei Flipr angemeldet: {analyzers} Analysator(en) und {hubs} Hub(s) gefunden.',
    es: 'Sesión iniciada en Flipr: {analyzers} analizador(es) y {hubs} Hub(s) encontrados.',
  },
};

/**
 * @description Whether a value is one of the supported languages.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de or es.
 * @example
 * isLanguage('fr'); // -> true
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('analyzerDeviceName', 'fr', { serial: 'AB256C' }); // -> 'Flipr AB256C'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusConnected', { analyzers: 1, hubs: 0 });
 */
function all(key, values = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, t(key, language, values)]));
}

/**
 * @description A number written the way a language does, with at most
 * `digits` decimals ("7,2" in French).
 * @param {number|null} value - The number.
 * @param {string} language - The language.
 * @param {number} digits - The decimals.
 * @returns {string} The text, "?" when unknown.
 * @example
 * formatNumber(7.25, 'fr', 1); // -> '7,3'
 */
function formatNumber(value, language, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '?';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 * @example
 * ago(Date.now() - 600000, Date.now(), 'en'); // -> '10 min ago'
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, isLanguage, t, all, formatNumber, ago };
