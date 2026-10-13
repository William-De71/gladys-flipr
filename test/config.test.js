import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, hasCredentials, readLanguage, POLL_INTERVAL } from '../src/config.js';

test('defaults, bounds and the e-mail trimmed', () => {
  assert.deepEqual(normalizeConfig(), {
    email: '',
    password: '',
    pollInterval: POLL_INTERVAL.default,
    language: 'auto',
  });
  const config = normalizeConfig({
    email: ' me@example.com\n',
    password: ' spaced ',
    poll_interval: '2',
    language: 'de',
  });
  assert.equal(config.email, 'me@example.com');
  assert.equal(config.password, ' spaced ', 'a password is kept as typed');
  assert.equal(config.pollInterval, POLL_INTERVAL.min);
  assert.equal(config.language, 'de');
  assert.equal(normalizeConfig({ poll_interval: 600 }).pollInterval, POLL_INTERVAL.max);
  assert.equal(normalizeConfig({ poll_interval: '' }).pollInterval, POLL_INTERVAL.default);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
  assert.equal(normalizeConfig(null).email, '');
});

test('credentials and the stored language', () => {
  assert.ok(hasCredentials(normalizeConfig({ email: 'a@b.c', password: 'x' })));
  assert.ok(!hasCredentials(normalizeConfig({ email: 'a@b.c' })));
  assert.equal(readLanguage({ last_language: 'es' }, 'en'), 'es');
  assert.equal(readLanguage({ last_language: 'español' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, 'fr'), 'fr');
});
