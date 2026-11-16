import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { compareImages } from '../src/compare.js';

test('identical images give zero deltaE and high SSIM', () => {
  const width = 16;
  const height = 16;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;     // R
    data[i + 1] = 128; // G
    data[i + 2] = 128; // B
    data[i + 3] = 255; // A
  }

  const ref = { width, height, data };
  const test = { width, height, data };

  const result = compareImages(ref, test);
  assert.strictEqual(result.overall.meanDeltaE, 0);
  assert.strictEqual(result.overall.p95DeltaE, 0);
  assert.ok(Math.abs(result.overall.ssim - 1) < 1e-9);
});

test('black vs white image gives high deltaE', () => {
  const width = 16;
  const height = 16;
  const dataRef = new Uint8ClampedArray(width * height * 4);
  const dataTest = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < dataRef.length; i += 4) {
    dataRef[i] = 0;     // R
    dataRef[i + 1] = 0; // G
    dataRef[i + 2] = 0; // B
    dataRef[i + 3] = 255; // A

    dataTest[i] = 255;     // R
    dataTest[i + 1] = 255; // G
    dataTest[i + 2] = 255; // B
    dataTest[i + 3] = 255; // A
  }

  const ref = { width, height, data: dataRef };
  const test = { width, height, data: dataTest };

  const result = compareImages(ref, test);
  assert.ok(result.overall.meanDeltaE > 90);
});

test('different dimensions throw RangeError', () => {
  const width = 16;
  const height = 16;
  const dataRef = new Uint8ClampedArray(width * height * 4);
  const dataTest = new Uint8ClampedArray((width + 1) * height * 4);

  for (let i = 0; i < dataRef.length; i += 4) {
    dataRef[i] = 128;
    dataRef[i + 1] = 128;
    dataRef[i + 2] = 128;
    dataRef[i + 3] = 255;
  }

  for (let i = 0; i < dataTest.length; i += 4) {
    dataTest[i] = 128;
    dataTest[i + 1] = 128;
    dataTest[i + 2] = 128;
    dataTest[i + 3] = 255;
  }

  const ref = { width, height, data: dataRef };
  const test = { width: width + 1, height, data: dataTest };

  assert.throws(() => compareImages(ref, test), RangeError);
});

test('region metrics computed correctly', () => {
  const width = 16;
  const height = 16;
  const dataRef = new Uint8ClampedArray(width * height * 4);
  const dataTest = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < dataRef.length; i += 4) {
    dataRef[i] = 128;
    dataRef[i + 1] = 128;
    dataRef[i + 2] = 128;
    dataRef[i + 3] = 255;

    dataTest[i] = 128;
    dataTest[i + 1] = 128;
    dataTest[i + 2] = 128;
    dataTest[i + 3] = 255;
  }

  const ref = { width, height, data: dataRef };
  const test = { width, height, data: dataTest };

  const regions = {
    face: { x: 0, y: 0, width: 8, height: 8 }
  };

  const result = compareImages(ref, test, regions);
  assert.ok(result.regions.face !== null);
  assert.strictEqual(result.regions.face.meanDeltaE, 0);
  assert.strictEqual(result.regions.face.p95DeltaE, 0);
  assert.ok(Math.abs(result.regions.face.ssim - 1) < 1e-9);
});

test('region fully outside image returns null', () => {
  const width = 16;
  const height = 16;
  const dataRef = new Uint8ClampedArray(width * height * 4);
  const dataTest = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < dataRef.length; i += 4) {
    dataRef[i] = 128;
    dataRef[i + 1] = 128;
    dataRef[i + 2] = 128;
    dataRef[i + 3] = 255;

    dataTest[i] = 128;
    dataTest[i + 1] = 128;
    dataTest[i + 2] = 128;
    dataTest[i + 3] = 255;
  }

  const ref = { width, height, data: dataRef };
  const test = { width, height, data: dataTest };

  const regions = {
    outside: { x: 20, y: 20, width: 8, height: 8 }
  };

  const result = compareImages(ref, test, regions);
  assert.strictEqual(result.regions.outside, null);
});
