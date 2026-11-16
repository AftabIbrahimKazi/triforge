const CHANNELS = 4;
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;
const MAX_WINDOW_SIZE = 11;
const GAUSSIAN_SIGMA = 1.5;
const DYNAMIC_RANGE = 255;
const K1 = 0.01;
const K2 = 0.03;
const C1 = (K1 * DYNAMIC_RANGE) ** 2;
const C2 = (K2 * DYNAMIC_RANGE) ** 2;
const SSIM_MIN = -1;
const SSIM_MAX = 1;

/**
 * @param {Uint8Array | Uint8ClampedArray} pixels RGBA
 * @param {number} offset
 * @returns {number}
 */
function toLuminance(pixels, offset) {
  return LUMA_R * pixels[offset] + LUMA_G * pixels[offset + 1] + LUMA_B * pixels[offset + 2];
}

/**
 * @param {number} size odd window length
 * @param {number} sigma
 * @returns {number[]} normalised 1D weights
 */
function gaussianWindow(size, sigma) {
  const center = Math.floor(size / 2);
  const weights = Array.from({ length: size }, (_, i) => Math.exp(-((i - center) ** 2) / (2 * sigma * sigma)));
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return weights.map((w) => w / sum);
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {number} odd window size no larger than the image
 */
function pickWindowSize(width, height) {
  const smallest = Math.min(width, height);
  if (smallest >= MAX_WINDOW_SIZE) {
    return MAX_WINDOW_SIZE;
  }
  return smallest % 2 === 0 ? smallest - 1 : smallest;
}

/**
 * @param {Uint8Array | Uint8ClampedArray} a RGBA pixels
 * @param {Uint8Array | Uint8ClampedArray} b RGBA pixels
 * @param {number} width
 * @param {number} height
 * @returns {number} mean SSIM over the luminance channel
 */
export function ssim(a, b, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Width and height must be positive integers');
  }
  if (a.length !== width * height * CHANNELS || b.length !== width * height * CHANNELS) {
    throw new RangeError('Array lengths must equal width * height * 4');
  }

  const windowSize = pickWindowSize(width, height);
  const weights = gaussianWindow(windowSize, GAUSSIAN_SIGMA);
  const half = Math.floor(windowSize / 2);

  let ssimSum = 0;
  let count = 0;
  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      ssimSum += windowSsim(a, b, width, x, y, weights, half);
      count++;
    }
  }

  if (count === 0) {
    return 0;
  }
  return Math.max(SSIM_MIN, Math.min(SSIM_MAX, ssimSum / count));
}

/**
 * @param {Uint8Array | Uint8ClampedArray} a
 * @param {Uint8Array | Uint8ClampedArray} b
 * @param {number} width
 * @param {number} x window centre x
 * @param {number} y window centre y
 * @param {number[]} weights
 * @param {number} half
 * @returns {number}
 */
function windowSsim(a, b, width, x, y, weights, half) {
  let sum1 = 0;
  let sum2 = 0;
  let sum11 = 0;
  let sum22 = 0;
  let sum12 = 0;

  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const weight = weights[half + dy] * weights[half + dx];
      const offset = ((y + dy) * width + (x + dx)) * CHANNELS;
      const l1 = toLuminance(a, offset);
      const l2 = toLuminance(b, offset);
      sum1 += l1 * weight;
      sum2 += l2 * weight;
      sum11 += l1 * l1 * weight;
      sum22 += l2 * l2 * weight;
      sum12 += l1 * l2 * weight;
    }
  }

  const var1 = sum11 - sum1 * sum1;
  const var2 = sum22 - sum2 * sum2;
  const cov = sum12 - sum1 * sum2;
  return ((2 * sum1 * sum2 + C1) * (2 * cov + C2)) / ((sum1 * sum1 + sum2 * sum2 + C1) * (var1 + var2 + C2));
}
