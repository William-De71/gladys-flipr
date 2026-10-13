// -----------------------------------------------------------------------------
// Client of the Flipr cloud API (https://apis.goflipr.com).
//
// Flipr publishes no official documentation of this API: the calls below are
// the ones the Flipr mobile app makes, as documented and used for years by the
// flipr-api Python library behind the Home Assistant integration
// (https://github.com/cnico/flipr-api):
//   POST /OAuth2/token                 grant_type=password, the e-mail and the
//                                      password of the Flipr app -> bearer token
//   GET  /modules                      the modules of the account: analyzers
//                                      (ModuleType_Id 1) and Hubs (2)
//   GET  /modules/{serial}/NewResume   the latest measure of an analyzer
//   GET  /hub/{serial}/state           the state of a Hub: on/off, mode
//   PUT  /hub/{serial}/mode/{mode}     auto | manual | planning
//   POST /hub/{serial}/Manual/{state}  True | False (the Hub must be in manual)
//
// Every failure becomes a FliprError with a `kind` the app turns into a
// user message: auth, rate_limit, not_found, unreachable, unexpected. The
// password and the token never appear in an error message.
// -----------------------------------------------------------------------------

const BASE_URL = 'https://apis.goflipr.com';
const TIMEOUT_MS = 20000;
// The token lives for months; read a new one a little before it expires.
const TOKEN_MARGIN_MS = 60000;
const HUB_MODES = ['auto', 'manual', 'planning'];

class FliprError extends Error {
  /**
   * @description An error of the Flipr API.
   * @param {string} kind - auth, rate_limit, not_found, unreachable or unexpected.
   * @param {string} message - What failed (never a secret).
   * @param {number} [status] - The HTTP status, when there was an answer.
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'FliprError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description The error kind of an HTTP status.
 * @param {number} status - The status.
 * @returns {string} The kind.
 * @example
 * kindOfStatus(429); // -> 'rate_limit'
 */
function kindOfStatus(status) {
  if (status === 401 || status === 403) {
    return 'auth';
  }
  if (status === 404) {
    return 'not_found';
  }
  if (status === 429) {
    return 'rate_limit';
  }
  return status >= 500 ? 'unreachable' : 'unexpected';
}

/**
 * @description Create a Flipr API client.
 * @param {object} options - Options.
 * @param {Function} options.getCredentials - `() => ({ email, password })`.
 * @param {Function} [options.fetch] - fetch implementation (tests).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.userAgent] - User-Agent header.
 * @param {string} [options.baseUrl] - API root (tests).
 * @returns {object} The client.
 * @example
 * const flipr = createFliprClient({ getCredentials: () => ({ email, password }) });
 * const modules = await flipr.listModules();
 */
function createFliprClient({
  getCredentials,
  fetch = globalThis.fetch,
  now = () => Date.now(),
  userAgent = 'gladys-flipr',
  baseUrl = BASE_URL,
}) {
  // { token, expiresAt, credentials } of the last sign-in.
  let session = null;

  /**
   * @description One HTTP call, with a timeout; network failures become errors.
   * @param {string} url - The URL.
   * @param {object} init - fetch options.
   * @param {string} what - What is read, for the error message.
   * @returns {Promise<Response>} The answer.
   */
  async function call(url, init, what) {
    try {
      return await fetch(url, {
        ...init,
        headers: { 'User-Agent': userAgent, 'Cache-Control': 'no-cache', ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new FliprError(
        'unreachable',
        `${what}: ${err.name === 'TimeoutError' ? 'timeout' : err.message}`,
      );
    }
  }

  /**
   * @description A valid bearer token, signing in when needed.
   * @param {boolean} [force] - Sign in again even with a token in hand.
   * @returns {Promise<string>} The token.
   */
  async function token(force = false) {
    const { email = '', password = '' } = getCredentials() ?? {};
    if (!email || !password) {
      throw new FliprError('auth', 'No Flipr e-mail or password is configured');
    }
    const credentials = `${email}\n${password}`;
    if (
      !force &&
      session &&
      session.credentials === credentials &&
      session.expiresAt - TOKEN_MARGIN_MS > now()
    ) {
      return session.token;
    }
    session = null;
    const response = await call(
      `${baseUrl}/OAuth2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'password', username: email, password }).toString(),
      },
      'sign-in',
    );
    if (!response.ok) {
      // An OAuth2 server answers a wrong password with 400 invalid_grant.
      const kind = response.status === 400 ? 'auth' : kindOfStatus(response.status);
      throw new FliprError(kind, `sign-in: HTTP ${response.status}`, response.status);
    }
    const body = await response.json().catch(() => ({}));
    if (typeof body.access_token !== 'string' || body.access_token === '') {
      throw new FliprError('unexpected', 'sign-in: no access token in the answer');
    }
    const lifetime = Number(body.expires_in);
    session = {
      token: body.access_token,
      credentials,
      expiresAt: now() + (Number.isFinite(lifetime) && lifetime > 0 ? lifetime * 1000 : 3600000),
    };
    return session.token;
  }

  /**
   * @description An authenticated request; signs in again once on a 401.
   * @param {string} method - HTTP method.
   * @param {string} path - Path below the API root.
   * @returns {Promise<unknown>} The JSON answer (null when empty).
   */
  async function request(method, path) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const bearer = await token(attempt > 0);
      const response = await call(
        `${baseUrl}/${path}`,
        { method, headers: { Authorization: `Bearer ${bearer}` } },
        `${method} ${path}`,
      );
      if (response.status === 401 && attempt === 0) {
        continue;
      }
      if (!response.ok) {
        throw new FliprError(
          kindOfStatus(response.status),
          `${method} ${path}: HTTP ${response.status}`,
          response.status,
        );
      }
      const text = await response.text();
      if (text.trim() === '') {
        return null;
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new FliprError('unexpected', `${method} ${path}: not JSON`);
      }
    }
    throw new FliprError('auth', `${method} ${path}: refused after a new sign-in`, 401);
  }

  const serialPath = (serial) => encodeURIComponent(String(serial));

  return {
    /**
     * @description Check the credentials (sign in now).
     * @returns {Promise<void>}
     */
    signIn: async () => {
      await token(true);
    },
    /**
     * @description The modules of the account, as the API sends them.
     * @returns {Promise<object[]>} The modules.
     */
    listModules: async () => {
      const body = await request('GET', 'modules');
      if (!Array.isArray(body)) {
        throw new FliprError('unexpected', 'GET modules: not a list');
      }
      return body;
    },
    /**
     * @description The latest measure of an analyzer, as the API sends it.
     * @param {string} serial - The serial number.
     * @returns {Promise<object|null>} The answer.
     */
    getMeasure: (serial) => request('GET', `modules/${serialPath(serial)}/NewResume`),
    /**
     * @description The state of a Hub, as the API sends it.
     * @param {string} serial - The serial number.
     * @returns {Promise<object|null>} The answer.
     */
    getHubState: (serial) => request('GET', `hub/${serialPath(serial)}/state`),
    /**
     * @description Change the mode of a Hub.
     * @param {string} serial - The serial number.
     * @param {string} mode - auto, manual or planning.
     * @returns {Promise<void>}
     */
    setHubMode: async (serial, mode) => {
      if (!HUB_MODES.includes(mode)) {
        throw new FliprError('unexpected', `Unknown Hub mode: ${mode}`);
      }
      await request('PUT', `hub/${serialPath(serial)}/mode/${mode}`);
    },
    /**
     * @description Switch a Hub on or off: manual mode first, as the API
     * requires.
     * @param {string} serial - The serial number.
     * @param {boolean} on - On or off.
     * @returns {Promise<void>}
     */
    setHubPower: async (serial, on) => {
      await request('PUT', `hub/${serialPath(serial)}/mode/manual`);
      await request('POST', `hub/${serialPath(serial)}/Manual/${on ? 'True' : 'False'}`);
    },
    /** @description Forget the token (another account). */
    reset: () => {
      session = null;
    },
  };
}

export { BASE_URL, HUB_MODES, FliprError, kindOfStatus, createFliprClient };
