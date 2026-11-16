const EPSILON = 1e-4;
const FAR = 1e9;
const FACE_VERTS = 4;
const CHANNELS = 4;
const AXES = 3;
const SEED = 1337;
const UINT32 = 4294967296;
const TWO_PI = Math.PI * 2;

/**
 * @typedef {{min: number[], max: number[], albedo: number[]}} BoxSpec
 * @typedef {{origin: number[], du: number[], dv: number[], normal: number[]}} FaceFrame
 * @typedef {{direction: number[], color: number[], intensity: number}} SunSpec
 */

/**
 * @param {number} seed
 * @returns {() => number} deterministic generator in [0, 1)
 */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

/**
 * Face frames of a three.js BoxGeometry, read from its position/uv/normal arrays.
 * @param {ArrayLike<number>} positions
 * @param {ArrayLike<number>} uvs
 * @param {ArrayLike<number>} normals
 * @returns {FaceFrame[]} one frame per face in group order
 */
export function faceFramesFromBoxArrays(positions, uvs, normals) {
  const faces = [];
  for (let base = 0; base < positions.length / AXES; base += FACE_VERTS) {
    const at = (u, v) => {
      for (let k = base; k < base + FACE_VERTS; k++) {
        if (Math.abs(uvs[k * 2] - u) < EPSILON && Math.abs(uvs[k * 2 + 1] - v) < EPSILON) {
          return [positions[k * AXES], positions[k * AXES + 1], positions[k * AXES + 2]];
        }
      }
      throw new RangeError('Face is missing a corner uv');
    };
    const p00 = at(0, 0);
    const p10 = at(1, 0);
    const p01 = at(0, 1);
    faces.push({
      origin: p00,
      du: p10.map((value, i) => value - p00[i]),
      dv: p01.map((value, i) => value - p00[i]),
      normal: [normals[base * AXES], normals[base * AXES + 1], normals[base * AXES + 2]]
    });
  }
  return faces;
}

/**
 * @param {number[]} origin
 * @param {number[]} direction unit vector
 * @param {BoxSpec[]} boxes
 * @returns {{t: number, box: BoxSpec} | null} nearest hit
 */
function intersect(origin, direction, boxes) {
  let best = null;
  let bestT = FAR;
  for (const box of boxes) {
    let tMin = 0;
    let tMax = bestT;
    for (let axis = 0; axis < AXES && tMin <= tMax; axis++) {
      const inv = 1 / direction[axis];
      let t0 = (box.min[axis] - origin[axis]) * inv;
      let t1 = (box.max[axis] - origin[axis]) * inv;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
    }
    if (tMin <= tMax && tMin > EPSILON && tMin < bestT) {
      bestT = tMin;
      best = box;
    }
  }
  return best ? { t: bestT, box: best } : null;
}

/**
 * @param {number[]} normal
 * @param {() => number} random
 * @returns {number[]} cosine-weighted unit direction around the normal
 */
function cosineSample(normal, random) {
  const r = Math.sqrt(random());
  const phi = TWO_PI * random();
  const x = r * Math.cos(phi);
  const y = r * Math.sin(phi);
  const z = Math.sqrt(Math.max(0, 1 - r * r));
  const helper = Math.abs(normal[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
  const tangent = normalize(cross(helper, normal));
  const bitangent = cross(normal, tangent);
  return [0, 1, 2].map((i) => tangent[i] * x + bitangent[i] * y + normal[i] * z);
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * @param {number[]} v
 * @returns {number[]}
 */
function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  return v.map((value) => value / length);
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Direct sun radiance leaving a diffuse surface point (Lambert, shadow ray).
 * @param {number[]} point
 * @param {number[]} normal
 * @param {number[]} albedo
 * @param {SunSpec} sun direction points from the surface towards the sun
 * @param {BoxSpec[]} boxes
 * @returns {number[]}
 */
function directSun(point, normal, albedo, sun, boxes) {
  const cosine = dot(normal, sun.direction);
  if (cosine <= 0) {
    return [0, 0, 0];
  }
  const origin = point.map((value, i) => value + normal[i] * EPSILON * 10);
  if (intersect(origin, sun.direction, boxes)) {
    return [0, 0, 0];
  }
  const scale = (sun.intensity * cosine) / Math.PI;
  return albedo.map((a, i) => a * sun.color[i] * scale);
}

/**
 * @param {BoxSpec} box
 * @param {number[]} point
 * @returns {number[]} outward normal of the box face containing the point
 */
function boxNormalAt(box, point) {
  let axisBest = 0;
  let distBest = Infinity;
  let sign = 1;
  for (let axis = 0; axis < AXES; axis++) {
    const dMin = Math.abs(point[axis] - box.min[axis]);
    const dMax = Math.abs(point[axis] - box.max[axis]);
    const d = Math.min(dMin, dMax);
    if (d < distBest) {
      distBest = d;
      axisBest = axis;
      sign = dMin < dMax ? -1 : 1;
    }
  }
  const normal = [0, 0, 0];
  normal[axisBest] = sign;
  return normal;
}

/**
 * @param {FaceFrame} frame
 * @param {number} texelsPerMeter
 * @param {number} maxTexels
 * @returns {{width: number, height: number}} lightmap size for one face
 */
export function faceTextureSize(frame, texelsPerMeter, maxTexels) {
  const size = (edge) => Math.max(1, Math.min(maxTexels, Math.ceil(Math.hypot(...edge) * texelsPerMeter)));
  return { width: size(frame.du), height: size(frame.dv) };
}

/**
 * @param {{boxes: BoxSpec[], faceFrames: FaceFrame[][], sun: SunSpec, sky: (direction: number[]) => number[], texelsPerMeter: number, maxTexels: number, samples: number}} options
 * @returns {{width: number, height: number, data: Float32Array}[][]} per box, per face, an RGBA float lightmap of outgoing radiance
 */
export function bakeBoxLightmaps({ boxes, faceFrames, sun, sky, texelsPerMeter, maxTexels, samples }) {
  if (!(texelsPerMeter > 0) || !Number.isInteger(maxTexels) || maxTexels < 1 || !Number.isInteger(samples) || samples < 1) {
    throw new RangeError('texelsPerMeter must be positive; maxTexels and samples must be positive integers');
  }
  const random = makeRandom(SEED);

  return boxes.map((box, boxIndex) =>
    faceFrames[boxIndex].map((frame) => {
      const { width, height } = faceTextureSize(frame, texelsPerMeter, maxTexels);
      const data = new Float32Array(width * height * CHANNELS);
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          const u = (i + 0.5) / width;
          const v = (j + 0.5) / height;
          const point = [0, 1, 2].map((k) => frame.origin[k] + u * frame.du[k] + v * frame.dv[k]);
          const radiance = shadePoint(point, frame.normal, box, boxes, sun, sky, samples, random);
          const offset = (j * width + i) * CHANNELS;
          data[offset] = radiance[0];
          data[offset + 1] = radiance[1];
          data[offset + 2] = radiance[2];
          data[offset + 3] = 1;
        }
      }
      return { width, height, data };
    })
  );
}

/**
 * @param {number[]} point
 * @param {number[]} normal
 * @param {BoxSpec} box
 * @param {BoxSpec[]} boxes
 * @param {SunSpec} sun
 * @param {(direction: number[]) => number[]} sky
 * @param {number} samples
 * @param {() => number} random
 * @returns {number[]} outgoing radiance: direct sun + one diffuse bounce + sky
 */
function shadePoint(point, normal, box, boxes, sun, sky, samples, random) {
  const direct = directSun(point, normal, box.albedo, sun, boxes);
  const incoming = [0, 0, 0];
  const origin = point.map((value, i) => value + normal[i] * EPSILON * 10);

  for (let s = 0; s < samples; s++) {
    const direction = cosineSample(normal, random);
    const hit = intersect(origin, direction, boxes);
    let radiance;
    if (hit) {
      const hitPoint = origin.map((value, i) => value + direction[i] * hit.t);
      radiance = directSun(hitPoint, boxNormalAt(hit.box, hitPoint), hit.box.albedo, sun, boxes);
    } else {
      radiance = sky(direction);
    }
    incoming[0] += radiance[0];
    incoming[1] += radiance[1];
    incoming[2] += radiance[2];
  }

  return [0, 1, 2].map((k) => direct[k] + box.albedo[k] * (incoming[k] / samples));
}
