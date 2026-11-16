import { srgbToLab, deltaE2000 } from './color.js';
import { ssim } from './ssim.js';
import { percentile } from './stats.js';

const CHANNELS = 4;
const P95 = 95;
const OPAQUE = 255;

/**
 * @typedef {{width: number, height: number, data: Uint8Array | Uint8ClampedArray}} Image
 * @typedef {{x: number, y: number, width: number, height: number}} Region
 * @typedef {{meanDeltaE: number, p95DeltaE: number, ssim: number}} Metrics
 */

/**
 * @param {Image} ref
 * @param {Image} test
 * @returns {number[]} per-pixel CIEDE2000
 */
function perPixelDeltaE(ref, test) {
  const pixels = ref.width * ref.height;
  const values = new Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const o = i * CHANNELS;
    const labRef = srgbToLab(ref.data[o], ref.data[o + 1], ref.data[o + 2]);
    const labTest = srgbToLab(test.data[o], test.data[o + 1], test.data[o + 2]);
    values[i] = deltaE2000(labRef, labTest);
  }
  return values;
}

/**
 * @param {Image} image
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {Uint8ClampedArray} opaque RGBA crop
 */
function cropOpaque(image, x, y, w, h) {
  const out = new Uint8ClampedArray(w * h * CHANNELS);
  let o = 0;
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const src = (row * image.width + col) * CHANNELS;
      out[o] = image.data[src];
      out[o + 1] = image.data[src + 1];
      out[o + 2] = image.data[src + 2];
      out[o + 3] = OPAQUE;
      o += CHANNELS;
    }
  }
  return out;
}

/**
 * @param {number[]} deltaE per-pixel values for the whole image
 * @param {number} width image width
 * @param {Region} rect clipped rectangle
 * @returns {number[]}
 */
function gatherDeltaE(deltaE, width, rect) {
  const values = [];
  for (let row = rect.y; row < rect.y + rect.height; row++) {
    for (let col = rect.x; col < rect.x + rect.width; col++) {
      values.push(deltaE[row * width + col]);
    }
  }
  return values;
}

/**
 * @param {Region} region
 * @param {number} width
 * @param {number} height
 * @returns {Region | null} region clipped to the image, null when nothing remains
 */
function clipRegion(region, width, height) {
  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  const w = Math.min(width, region.x + region.width) - x;
  const h = Math.min(height, region.y + region.height) - y;
  return w > 0 && h > 0 ? { x, y, width: w, height: h } : null;
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function mean(values) {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/**
 * @param {Image} ref
 * @param {Image} test
 * @param {Record<string, Region>} [regions]
 * @returns {{overall: Metrics, regions: Record<string, Metrics | null>}}
 */
export function compareImages(ref, test, regions = {}) {
  if (ref.width !== test.width || ref.height !== test.height) {
    throw new RangeError('Image dimensions must match');
  }

  const { width, height } = ref;
  const deltaE = perPixelDeltaE(ref, test);
  const whole = { x: 0, y: 0, width, height };

  const metricsFor = (rect) => ({
    meanDeltaE: mean(gatherDeltaE(deltaE, width, rect)),
    p95DeltaE: percentile(gatherDeltaE(deltaE, width, rect), P95),
    ssim: ssim(
      cropOpaque(ref, rect.x, rect.y, rect.width, rect.height),
      cropOpaque(test, rect.x, rect.y, rect.width, rect.height),
      rect.width,
      rect.height
    )
  });

  const resultRegions = Object.create(null);
  for (const key of Object.keys(regions)) {
    const rect = clipRegion(regions[key], width, height);
    resultRegions[key] = rect ? metricsFor(rect) : null;
  }

  return { overall: metricsFor(whole), regions: resultRegions };
}
