// Shapes of the Flipr API answers (as recorded in the tests of the flipr-api
// Python library, https://github.com/cnico/flipr-api), a fake Flipr cloud and
// a stand-in for the SDK external ids.

export const NOW = Date.parse('2026-07-14T10:00:00Z');
export const HOUR = 3600000;
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');

export const ANALYZER_SERIAL = 'AB256C';
export const HUB_SERIAL = 'CD256C';

/**
 * @description A raw module of GET /modules.
 * @param {string} serial - The serial.
 * @param {number} type - 1 analyzer, 2 Hub.
 * @param {string} [model] - CommercialType.Value.
 * @returns {object} The module.
 */
export function rawModule(serial, type, model = 'Start') {
  return {
    ActivationKey: '12345',
    IsSuspended: false,
    Status: { Comment: null, DateTime: '2020-04-13T14:26:53.563', Status: 'Activated' },
    BatteryPlugDate: '2019-07-01T00:00:00',
    Comments: null,
    Serial: serial,
    PAC: '123456B',
    SigfoxStatus: 'Activated',
    IsForSpa: false,
    Version: 3,
    LastMeasureDateTime: '2021-02-01T07:40:23.663',
    CommercialType: { Id: 1, Value: model },
    ModuleType_Id: type,
    IsSubscriptionValid: true,
  };
}

/**
 * @description A raw answer of GET /modules/{serial}/NewResume.
 * @param {object} [options] - Overrides.
 * @returns {object} The answer.
 */
export function rawMeasure({
  at = NOW - HOUR,
  temperature = 26.4,
  ph = 7.21,
  phSector = 'Medium',
  chlorine = 1.2345,
  chlorineSector = 'Medium',
  redox = 702,
  battery = 0.75,
} = {}) {
  return {
    Current: {
      MeasureId: 405698,
      DateTime: iso(at),
      Temperature: temperature,
      PH: {
        Label: 'PH',
        Message: 'Parfait',
        Deviation: -0.47,
        Value: ph,
        DeviationSector: phSector,
      },
      OxydoReductionPotentiel: { Label: 'Potentiel Redox.', Value: redox },
      Conductivity: { Label: 'Conductivité', Level: 'Low' },
      UvIndex: 0.0,
      Battery: { Label: 'Batterie', Deviation: battery },
      Desinfectant: {
        Label: 'Chlore',
        Message: 'Parfait',
        Deviation: 0.2,
        Value: chlorine,
        DeviationSector: chlorineSector,
      },
    },
  };
}

/**
 * @description A raw answer of GET /hub/{serial}/state.
 * @param {number} on - stateEquipment.
 * @param {string} mode - behavior.
 * @returns {object} The answer.
 */
export function rawHubState(on = 0, mode = 'planning') {
  return {
    stateEquipment: on,
    behavior: mode,
    planning: '',
    internalKeepAlive: null,
    messageModeAutoFiltration: null,
    ErrorCode: null,
    ErrorMessage: null,
  };
}

/**
 * @description A fake Flipr cloud: a fetch answering like apis.goflipr.com
 * from an editable state. Records every call in `fetch.calls`.
 * @param {object} [state] - `{ password, modules, measures, hubs, failures }`.
 * @returns {Function} The fetch, with `.state` and `.calls`.
 */
export function fliprCloud(state = {}) {
  const cloud = {
    password: 'secret',
    modules: [rawModule(ANALYZER_SERIAL, 1), rawModule(HUB_SERIAL, 2)],
    measures: { [ANALYZER_SERIAL]: rawMeasure() },
    hubs: { [HUB_SERIAL]: rawHubState() },
    // path -> HTTP status to answer instead
    failures: {},
    tokens: 0,
    ...state,
  };
  const json = (body, status = 200) =>
    new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const fetch = async (url, init = {}) => {
    const { pathname } = new URL(url);
    const path = pathname.slice(1);
    const method = init.method ?? 'GET';
    fetch.calls.push({ method, path, body: init.body, headers: init.headers });
    if (cloud.failures[path] === 'network') {
      throw new TypeError('fetch failed');
    }
    if (cloud.failures[path]) {
      return json({ error: 'failure' }, cloud.failures[path]);
    }
    if (path === 'OAuth2/token') {
      const form = new URLSearchParams(init.body);
      if (form.get('grant_type') !== 'password' || form.get('password') !== cloud.password) {
        return json({ error: 'invalid_grant' }, 400);
      }
      cloud.tokens += 1;
      return json({
        access_token: `token-${cloud.tokens}`,
        token_type: 'bearer',
        expires_in: 23327999,
      });
    }
    if (init.headers?.Authorization !== `Bearer token-${cloud.tokens}`) {
      return json({ Message: 'Authorization has been denied for this request.' }, 401);
    }
    let match;
    if (path === 'modules') {
      return json(cloud.modules);
    }
    if ((match = /^modules\/(\w+)\/NewResume$/.exec(path))) {
      return cloud.measures[match[1]] ? json(cloud.measures[match[1]]) : json({}, 404);
    }
    if ((match = /^hub\/(\w+)\/state$/.exec(path))) {
      return cloud.hubs[match[1]] ? json(cloud.hubs[match[1]]) : json({}, 404);
    }
    if ((match = /^hub\/(\w+)\/mode\/(\w+)$/.exec(path)) && method === 'PUT') {
      cloud.hubs[match[1]].behavior = match[2];
      return json(cloud.hubs[match[1]]);
    }
    if ((match = /^hub\/(\w+)\/Manual\/(True|False)$/.exec(path)) && method === 'POST') {
      cloud.hubs[match[1]].stateEquipment = match[2] === 'True' ? 1 : 0;
      return json(undefined);
    }
    return json({}, 404);
  };
  fetch.calls = [];
  fetch.state = cloud;
  return fetch;
}

// The SDK external ids, without a client (selector `flipr`).
export const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:flipr:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

export const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
