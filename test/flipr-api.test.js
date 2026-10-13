import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createFliprClient, kindOfStatus } from '../src/flipr-api.js';
import { fliprCloud, NOW, ANALYZER_SERIAL, HUB_SERIAL } from './helpers/fixtures.js';

const client = (fetch, credentials = { email: 'me+pool@example.com', password: 'secret' }) =>
  createFliprClient({ getCredentials: () => credentials, fetch, now: () => NOW });

test('signs in with the password grant, then reuses the token', async () => {
  const fetch = fliprCloud();
  const flipr = client(fetch);
  await flipr.listModules();
  await flipr.getMeasure(ANALYZER_SERIAL);
  const [signIn, ...rest] = fetch.calls;
  assert.equal(signIn.method, 'POST');
  assert.equal(signIn.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const form = new URLSearchParams(signIn.body);
  assert.deepEqual(Object.fromEntries(form), {
    grant_type: 'password',
    username: 'me+pool@example.com',
    password: 'secret',
  });
  assert.deepEqual(
    rest.map((call) => call.path),
    ['modules', `modules/${ANALYZER_SERIAL}/NewResume`],
  );
  assert.ok(rest.every((call) => call.headers.Authorization === 'Bearer token-1'));
});

test('signs in again once when the token is refused', async () => {
  const fetch = fliprCloud();
  const flipr = client(fetch);
  await flipr.listModules();
  // The cloud revoked token-1: the next request is answered 401.
  fetch.state.tokens = 5;
  const modules = await flipr.listModules();
  assert.equal(modules.length, 2);
  assert.deepEqual(
    fetch.calls.slice(-3).map((call) => call.path),
    ['modules', 'OAuth2/token', 'modules'],
  );
});

test('every failure has a kind, and never carries the password', async () => {
  const wrong = client(fliprCloud({ password: 'other' }));
  await assert.rejects(
    wrong.listModules(),
    (err) => err.kind === 'auth' && !/secret/.test(err.message),
  );

  const none = client(fliprCloud(), { email: '', password: '' });
  await assert.rejects(none.listModules(), { kind: 'auth' });

  const limited = client(fliprCloud({ failures: { modules: 429 } }));
  await assert.rejects(limited.listModules(), { kind: 'rate_limit' });

  const down = client(fliprCloud({ failures: { modules: 'network' } }));
  await assert.rejects(down.listModules(), { kind: 'unreachable' });

  const missing = client(fliprCloud());
  await assert.rejects(missing.getMeasure('ZZ999'), { kind: 'not_found' });

  assert.equal(kindOfStatus(502), 'unreachable');
  assert.equal(kindOfStatus(418), 'unexpected');
});

test('switching the Hub puts it in manual mode first; unknown modes are refused', async () => {
  const fetch = fliprCloud();
  const flipr = client(fetch);
  await flipr.setHubPower(HUB_SERIAL, true);
  assert.deepEqual(
    fetch.calls.slice(1).map((call) => `${call.method} ${call.path}`),
    [`PUT hub/${HUB_SERIAL}/mode/manual`, `POST hub/${HUB_SERIAL}/Manual/True`],
  );
  assert.equal(fetch.state.hubs[HUB_SERIAL].stateEquipment, 1);
  await assert.rejects(flipr.setHubMode(HUB_SERIAL, 'turbo'), /Unknown Hub mode/);
  await flipr.setHubMode(HUB_SERIAL, 'planning');
  assert.equal(fetch.state.hubs[HUB_SERIAL].behavior, 'planning');
});

test('a new password signs in again', async () => {
  const fetch = fliprCloud();
  const credentials = { email: 'me@example.com', password: 'secret' };
  const flipr = createFliprClient({ getCredentials: () => credentials, fetch, now: () => NOW });
  await flipr.listModules();
  credentials.password = 'changed';
  fetch.state.password = 'changed';
  await flipr.listModules();
  assert.equal(fetch.calls.filter((call) => call.path === 'OAuth2/token').length, 2);
});
