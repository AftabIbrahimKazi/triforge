import { test } from 'node:test';
import { strict as assert } from 'node:assert/strict';
import { renderReport } from '../src/report.js';

test('renderReport with one scene and two rows', () => {
  const rows = [
    {
      variant: 'A',
      scene: 'Scene1',
      meanDeltaE: 1.23,
      p95DeltaE: 2.34,
      ssim: 0.987,
      frameP50: 10.12,
      frameP95: 15.67,
      fps: 30.00,
      downloadMB: 5.12
    },
    {
      variant: 'B',
      scene: 'Scene1',
      meanDeltaE: 1.45,
      p95DeltaE: 2.56,
      ssim: 0.985,
      frameP50: 11.23,
      frameP95: 16.78,
      fps: 29.50,
      downloadMB: 5.45
    }
  ];
  
  const result = renderReport('Test Report', rows, 20);
  
  assert.ok(result.includes('# Test Report'));
  assert.ok(result.includes('Frame budget: 20.0 ms (p95)'));
  assert.ok(result.includes('## Scene1'));
  assert.ok(result.includes('| A | 1.23 | 2.34 | 0.987 | 10.12 | 15.67 | 30.00 | 5.12 | ok |'));
  assert.ok(result.includes('| B | 1.45 | 2.56 | 0.985 | 11.23 | 16.78 | 29.50 | 5.45 | ok |'));
});

test('renderReport with frameP95 over budget', () => {
  const rows = [
    {
      variant: 'A',
      scene: 'Scene1',
      meanDeltaE: 1.23,
      p95DeltaE: 2.34,
      ssim: 0.987,
      frameP50: 10.12,
      frameP95: 20.0,
      fps: 30.00,
      downloadMB: 5.12
    }
  ];
  
  const result = renderReport('Test Report', rows, 16.7);
  
  assert.ok(result.includes('| A | 1.23 | 2.34 | 0.987 | 10.12 | 20.00 | 30.00 | 5.12 | over |'));
});

test('renderReport with variant containing pipe character', () => {
  const rows = [
    {
      variant: 'A|B',
      scene: 'Scene1',
      meanDeltaE: 1.23,
      p95DeltaE: 2.34,
      ssim: 0.987,
      frameP50: 10.12,
      frameP95: 15.67,
      fps: 30.00,
      downloadMB: 5.12
    }
  ];
  
  const result = renderReport('Test Report', rows, 20);
  
  assert.ok(result.includes('## Scene1'));
  assert.ok(result.includes('| A\\|B | 1.23 | 2.34 | 0.987 | 10.12 | 15.67 | 30.00 | 5.12 | ok |'));
});

test('renderReport with empty rows throws RangeError', () => {
  assert.throws(() => {
    renderReport('Test Report', [], 20);
  }, RangeError);
});

test('renderReport with non-finite budget throws RangeError', () => {
  const rows = [
    {
      variant: 'A',
      scene: 'Scene1',
      meanDeltaE: 1.23,
      p95DeltaE: 2.34,
      ssim: 0.987,
      frameP50: 10.12,
      frameP95: 15.67,
      fps: 30.00,
      downloadMB: 5.12
    }
  ];
  
  assert.throws(() => {
    renderReport('Test Report', rows, Infinity);
  }, RangeError);
  
  assert.throws(() => {
    renderReport('Test Report', rows, NaN);
  }, RangeError);
});
