const MIN_KEYFRAMES = 2;
const MIN_SAMPLES = 2;
const AXES = 3;
const CATMULL_ROM_HALF = 0.5;

/**
 * @typedef {{position: number[], target: number[]}} Pose
 */

/**
 * @param {number[]} vector
 * @returns {boolean}
 */
function isFiniteVec3(vector) {
  return Array.isArray(vector) && vector.length === AXES && vector.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/**
 * @param {Pose[]} keyframes
 * @returns {{keyframes: Pose[]}}
 */
export function createCameraPath(keyframes) {
  if (keyframes.length < MIN_KEYFRAMES) {
    throw new RangeError('At least 2 keyframes required');
  }
  keyframes.forEach((keyframe, i) => {
    if (!isFiniteVec3(keyframe.position)) {
      throw new RangeError(`Keyframe ${i} position must be 3 finite numbers`);
    }
    if (!isFiniteVec3(keyframe.target)) {
      throw new RangeError(`Keyframe ${i} target must be 3 finite numbers`);
    }
  });
  return { keyframes: [...keyframes] };
}

/**
 * Uniform Catmull-Rom spline through p1..p2 at parameter t.
 * @param {number} p0
 * @param {number} p1
 * @param {number} p2
 * @param {number} p3
 * @param {number} t
 * @returns {number}
 */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    CATMULL_ROM_HALF *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * @param {number[][]} points four neighbouring vectors
 * @param {number} t
 * @returns {number[]}
 */
function splineVec3(points, t) {
  return Array.from({ length: AXES }, (_, axis) =>
    catmullRom(points[0][axis], points[1][axis], points[2][axis], points[3][axis], t)
  );
}

/**
 * @param {{keyframes: Pose[]}} path
 * @param {number} count number of poses, at least 2
 * @returns {Pose[]}
 */
export function samplePath(path, count) {
  if (!Number.isInteger(count) || count < MIN_SAMPLES) {
    throw new RangeError('Count must be an integer at least 2');
  }
  const { keyframes } = path;
  if (keyframes.length < MIN_KEYFRAMES) {
    throw new RangeError('Path must have at least 2 keyframes');
  }

  const extended = [keyframes[0], ...keyframes, keyframes[keyframes.length - 1]];
  const segments = keyframes.length - 1;

  return Array.from({ length: count }, (_, i) => {
    const scaled = (i / (count - 1)) * segments;
    const segment = Math.min(Math.floor(scaled), segments - 1);
    const neighbours = extended.slice(segment, segment + 4);
    const t = scaled - segment;
    return {
      position: splineVec3(neighbours.map((k) => k.position), t),
      target: splineVec3(neighbours.map((k) => k.target), t)
    };
  });
}
