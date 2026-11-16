import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ssim } from '../src/ssim.js';

function lcg(seed) {
  return function() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function generateRandomImage(width, height, seed = 12345) {
  const rand = lcg(seed);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height * 4; i += 4) {
    data[i + 0] = Math.floor(rand() * 256); // R
    data[i + 1] = Math.floor(rand() * 256); // G
    data[i + 2] = Math.floor(rand() * 256); // B
    data[i + 3] = 255; // A
  }
  return data;
}

test('identical images give ssim of 1', () => {
  const width = 32;
  const height = 32;
  const img = generateRandomImage(width, height);
  const result = ssim(img, img, width, height);
  assert.ok(Math.abs(result - 1) < 1e-9);
});

test('black vs white images give low ssim', () => {
  const width = 32;
  const height = 32;
  const black = new Uint8ClampedArray(width * height * 4).fill(0);
  const white = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let i = 3; i < width * height * 4; i += 4) {
    white[i] = 255;
  }
  const result = ssim(black, white, width, height);
  assert.ok(result < 0.01);
});

test('gradient images with small brightness difference give high ssim', () => {
  const width = 32;
  const height = 32;
  const img1 = new Uint8ClampedArray(width * height * 4);
  const img2 = new Uint8ClampedArray(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset1 = (y * width + x) * 4;
      const offset2 = offset1;
      
      const intensity = Math.floor((x / width) * 255);
      img1[offset1 + 0] = intensity;
      img1[offset1 + 1] = intensity;
      img1[offset1 + 2] = intensity;
      img1[offset1 + 3] = 255;
      
      img2[offset2 + 0] = Math.min(255, intensity + 10);
      img2[offset2 + 1] = Math.min(255, intensity + 10);
      img2[offset2 + 2] = Math.min(255, intensity + 10);
      img2[offset2 + 3] = 255;
    }
  }
  
  const result = ssim(img1, img2, width, height);
  assert.ok(result > 0.9);
  assert.ok(result < 1);
});

test('wrong array length throws RangeError', () => {
  const width = 32;
  const height = 32;
  const img = generateRandomImage(width, height);
  
  assert.throws(() => ssim(img.slice(0, -4), img, width, height), RangeError);
  assert.throws(() => ssim(img, img.slice(0, -4), width, height), RangeError);
});

test('invalid dimensions throw RangeError', () => {
  const img = new Uint8ClampedArray(32 * 32 * 4);
  
  assert.throws(() => ssim(img, img, 0, 32), RangeError);
  assert.throws(() => ssim(img, img, 32, 0), RangeError);
  assert.throws(() => ssim(img, img, -1, 32), RangeError);
  assert.throws(() => ssim(img, img, 32, -1), RangeError);
  assert.throws(() => ssim(img, img, 32.5, 32), RangeError);
  assert.throws(() => ssim(img, img, 32, 32.5), RangeError);
});
