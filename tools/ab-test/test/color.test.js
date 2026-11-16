import { test } from 'node:test';
import assert from 'node:assert/strict';
import { srgbToLab, deltaE76, deltaE2000 } from '../src/color.js';

test('srgbToLab converts white correctly', () => {
  const lab = srgbToLab(255, 255, 255);
  assert.ok(Math.abs(lab[0] - 100) < 0.01);
  assert.ok(Math.abs(lab[1] - 0) < 0.01);
  assert.ok(Math.abs(lab[2] - 0) < 0.01);
});

test('srgbToLab converts black correctly', () => {
  const lab = srgbToLab(0, 0, 0);
  assert.ok(Math.abs(lab[0] - 0) < 0.01);
  assert.ok(Math.abs(lab[1] - 0) < 0.01);
  assert.ok(Math.abs(lab[2] - 0) < 0.01);
});

test('deltaE76 of identical colors is 0', () => {
  const lab = [50, 10, 20];
  const de = deltaE76(lab, lab);
  assert.strictEqual(de, 0);
});

test('deltaE76 of white and black is 100', () => {
  const de = deltaE76([100, 0, 0], [0, 0, 0]);
  assert.strictEqual(de, 100);
});

test('deltaE2000 matches Sharma pair 1', () => {
  const lab1 = [50.0000, 2.6772, -79.7751];
  const lab2 = [50.0000, 0.0000, -82.7485];
  const de = deltaE2000(lab1, lab2);
  assert.ok(Math.abs(de - 2.0425) < 0.0001);
});

test('deltaE2000 of identical colors is 0', () => {
  const lab = [50, 10, 20];
  const de = deltaE2000(lab, lab);
  assert.strictEqual(de, 0);
});

test('NaN input throws RangeError', () => {
  assert.throws(() => srgbToLab(NaN, 0, 0), RangeError);
  assert.throws(() => deltaE76([NaN, 0, 0], [0, 0, 0]), RangeError);
  assert.throws(() => deltaE2000([NaN, 0, 0], [0, 0, 0]), RangeError);
});
