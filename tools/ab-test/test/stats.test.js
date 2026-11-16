import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { percentile, summarizeFrameTimes, budgetVerdict } from '../src/stats.js';

test('percentile of 1..100 at 95', () => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const result = percentile(values, 95);
  assert.ok(Math.abs(result - 95.05) < 1e-9);
});

test('percentile at 0 and 100', () => {
  const values = [1, 2, 3, 4, 5];
  assert.strictEqual(percentile(values, 0), 1);
  assert.strictEqual(percentile(values, 100), 5);
});

test('summarizeFrameTimes with constant values', () => {
  const result = summarizeFrameTimes([10, 10, 10, 10]);
  assert.strictEqual(result.mean, 10);
  assert.strictEqual(result.fps, 100);
  assert.strictEqual(result.p95, 10);
});

test('budgetVerdict within budget', () => {
  const summary = { p95: 12 };
  const result = budgetVerdict(summary, 16.7);
  assert.strictEqual(result.withinBudget, true);
  assert.ok(Math.abs(result.headroomMs - 4.7) < 1e-9);
});

test('empty array throws RangeError', () => {
  assert.throws(() => percentile([], 50), RangeError);
  assert.throws(() => summarizeFrameTimes([]), RangeError);
});

test('NaN value throws RangeError', () => {
  assert.throws(() => percentile([1, NaN, 3], 50), RangeError);
  assert.throws(() => summarizeFrameTimes([1, NaN, 3]), RangeError);
});
