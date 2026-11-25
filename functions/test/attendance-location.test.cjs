const assert = require('node:assert/strict');
const { test } = require('node:test');
const { haversineMeters } = require('../lib/index.js');

test('distance is zero for identical coordinates', () => {
  assert.equal(haversineMeters(-7.05, 110.44, -7.05, 110.44), 0);
});

test('distance uses meters for a one-degree latitude delta', () => {
  assert.ok(Math.abs(haversineMeters(0, 0, 1, 0) - 111_195) < 100);
});

test('distance is symmetric', () => {
  assert.equal(
    haversineMeters(-7.05, 110.44, -7.06, 110.45),
    haversineMeters(-7.06, 110.45, -7.05, 110.44),
  );
});

test('distance crosses the antimeridian by the shorter route', () => {
  assert.ok(haversineMeters(0, 179.9, 0, -179.9) < 23_000);
});
