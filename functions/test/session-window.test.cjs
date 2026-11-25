const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getSessionTimeFailure } = require('../lib/src/sessionWindow.js');

const startsAt = Date.parse('2026-10-28T08:00:00.000Z');
const endsAt = Date.parse('2026-10-28T09:00:00.000Z');

test('rejects before the session starts', () => {
  assert.equal(getSessionTimeFailure(startsAt, endsAt, startsAt - 1), 'SESSION_NOT_STARTED');
});

test('allows attendance exactly when the session starts', () => {
  assert.equal(getSessionTimeFailure(startsAt, endsAt, startsAt), null);
});

test('allows attendance while the session is in progress', () => {
  assert.equal(getSessionTimeFailure(startsAt, endsAt, startsAt + 1), null);
});

test('rejects attendance exactly when the session ends', () => {
  assert.equal(getSessionTimeFailure(startsAt, endsAt, endsAt), 'SESSION_ENDED');
});

test('rejects attendance after the session ends', () => {
  assert.equal(getSessionTimeFailure(startsAt, endsAt, endsAt + 1), 'SESSION_ENDED');
});

test('rejects invalid or reversed timestamp ranges', () => {
  assert.equal(getSessionTimeFailure(null, endsAt, startsAt), 'SESSION_TIME_INVALID');
  assert.equal(getSessionTimeFailure(endsAt, startsAt, startsAt), 'SESSION_TIME_INVALID');
});
