const BYTE_MAX = 255;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_OFFSET_SCALE = 1.055;
const SRGB_GAMMA = 2.4;

const RGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041]
];
const D65_WHITE = [0.95047, 1.0, 1.08883];

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;
const LAB_OFFSET = 16;
const LAB_L_SCALE = 116;
const LAB_A_SCALE = 500;
const LAB_B_SCALE = 200;

const DEG_TO_RAD = Math.PI / 180;
const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;
const POW25_7 = 25 ** 7;
const SL_MID_L = 50;
const SL_SLOPE = 0.015;
const SL_OFFSET = 20;
const SC_SLOPE = 0.045;
const SH_SLOPE = 0.015;
const DTHETA_PEAK_DEG = 30;
const DTHETA_CENTER_DEG = 275;
const DTHETA_WIDTH_DEG = 25;
const T_TERMS = [
  { weight: -0.17, harmonic: 1, phaseDeg: -30 },
  { weight: 0.24, harmonic: 2, phaseDeg: 0 },
  { weight: 0.32, harmonic: 3, phaseDeg: 6 },
  { weight: -0.2, harmonic: 4, phaseDeg: -63 }
];

/**
 * @param {number[]} lab
 * @param {number[]} other
 */
function assertLabPair(lab, other) {
  if (!Array.isArray(lab) || !Array.isArray(other)) {
    throw new RangeError('Inputs must be arrays');
  }
  if (lab.length !== 3 || other.length !== 3) {
    throw new RangeError('Arrays must have exactly 3 elements');
  }
  if (!lab.every(Number.isFinite) || !other.every(Number.isFinite)) {
    throw new RangeError('All inputs must be finite numbers');
  }
}

/**
 * @param {number} c sRGB channel in [0, 1]
 * @returns {number} linear-light channel
 */
function srgbGammaDecode(c) {
  if (c <= SRGB_LINEAR_THRESHOLD) {
    return c / SRGB_LINEAR_SLOPE;
  }
  return ((c + SRGB_OFFSET) / SRGB_OFFSET_SCALE) ** SRGB_GAMMA;
}

/**
 * @param {number} t normalised XYZ component
 * @returns {number}
 */
function labF(t) {
  return t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + LAB_OFFSET) / LAB_L_SCALE;
}

/**
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {number[]} [L, a, b] under D65
 */
export function srgbToLab(r, g, b) {
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    throw new RangeError('All inputs must be finite numbers');
  }

  const linear = [r, g, b].map((channel) => srgbGammaDecode(channel / BYTE_MAX));
  const [fx, fy, fz] = RGB_TO_XYZ.map((row, i) =>
    labF((row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]) / D65_WHITE[i])
  );

  return [LAB_L_SCALE * fy - LAB_OFFSET, LAB_A_SCALE * (fx - fy), LAB_B_SCALE * (fy - fz)];
}

/**
 * @param {number[]} lab1
 * @param {number[]} lab2
 * @returns {number}
 */
export function deltaE76(lab1, lab2) {
  assertLabPair(lab1, lab2);
  return Math.hypot(lab2[0] - lab1[0], lab2[1] - lab1[1], lab2[2] - lab1[2]);
}

/**
 * @param {number} b
 * @param {number} a
 * @returns {number} hue angle in degrees, 0-360
 */
function hueDegrees(b, a) {
  if (a === 0 && b === 0) {
    return 0;
  }
  const hue = Math.atan2(b, a) / DEG_TO_RAD;
  return hue < 0 ? hue + FULL_TURN_DEG : hue;
}

/**
 * @param {number} h1 degrees
 * @param {number} h2 degrees
 * @returns {number} shortest signed hue difference in degrees
 */
function hueDifference(h1, h2) {
  const diff = h2 - h1;
  if (diff > HALF_TURN_DEG) {
    return diff - FULL_TURN_DEG;
  }
  if (diff < -HALF_TURN_DEG) {
    return diff + FULL_TURN_DEG;
  }
  return diff;
}

/**
 * @param {number} h1 degrees
 * @param {number} h2 degrees
 * @returns {number} mean hue in degrees, wrapping across 0/360
 */
function hueMean(h1, h2) {
  const sum = h1 + h2;
  if (Math.abs(h1 - h2) <= HALF_TURN_DEG) {
    return sum / 2;
  }
  return (sum < FULL_TURN_DEG ? sum + FULL_TURN_DEG : sum - FULL_TURN_DEG) / 2;
}

/**
 * CIEDE2000 colour difference (Sharma, Wu, Dalal 2005).
 * @param {number[]} lab1
 * @param {number[]} lab2
 * @returns {number}
 */
export function deltaE2000(lab1, lab2) {
  assertLabPair(lab1, lab2);
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const barC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(barC ** 7 / (barC ** 7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDegrees(b1, a1p);
  const h2p = hueDegrees(b2, a2p);

  const achromatic = C1p * C2p === 0;
  const dhp = achromatic ? 0 : hueDifference(h1p, h2p);
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * DEG_TO_RAD) / 2);
  const barHp = achromatic ? h1p + h2p : hueMean(h1p, h2p);
  const barCp = (C1p + C2p) / 2;
  const barL = (L1 + L2) / 2;

  const T = 1 + T_TERMS.reduce((acc, term) => acc + term.weight * Math.cos((term.harmonic * barHp + term.phaseDeg) * DEG_TO_RAD), 0);
  const dTheta = DTHETA_PEAK_DEG * Math.exp(-(((barHp - DTHETA_CENTER_DEG) / DTHETA_WIDTH_DEG) ** 2));
  const RC = 2 * Math.sqrt(barCp ** 7 / (barCp ** 7 + POW25_7));
  const lightnessOffset = (barL - SL_MID_L) ** 2;
  const SL = 1 + (SL_SLOPE * lightnessOffset) / Math.sqrt(SL_OFFSET + lightnessOffset);
  const SC = 1 + SC_SLOPE * barCp;
  const SH = 1 + SH_SLOPE * barCp * T;
  const RT = -Math.sin(2 * dTheta * DEG_TO_RAD) * RC;

  const tL = (L2 - L1) / SL;
  const tC = (C2p - C1p) / SC;
  const tH = dHp / SH;
  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}
