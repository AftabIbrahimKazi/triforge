import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { createCameraPath, samplePath } from '../src/camera-path.js';

test('createCameraPath validates keyframes', () => {
  assert.throws(() => createCameraPath([]), RangeError);
  assert.throws(() => createCameraPath([{ position: [0, 0, 0], target: [1, 1, 1] }]), RangeError);
  
  assert.throws(() => createCameraPath([
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [NaN, 0, 0], target: [1, 1, 1] }
  ]), RangeError);
  
  assert.throws(() => createCameraPath([
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [0, 0, 0], target: [1, 1, NaN] }
  ]), RangeError);
  
  assert.throws(() => createCameraPath([
    { position: [0, 0], target: [1, 1, 1] },
    { position: [0, 0, 0], target: [1, 1, 1] }
  ]), RangeError);
  
  const path = createCameraPath([
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [2, 2, 2], target: [3, 3, 3] }
  ]);
  
  assert.deepStrictEqual(path.keyframes, [
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [2, 2, 2], target: [3, 3, 3] }
  ]);
});

test('samplePath with 3 keyframes and count 5', () => {
  const path = createCameraPath([
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [2, 2, 2], target: [3, 3, 3] },
    { position: [4, 4, 4], target: [5, 5, 5] }
  ]);
  
  const poses = samplePath(path, 5);
  
  // First pose should equal first keyframe
  assert.deepStrictEqual(poses[0].position, [0, 0, 0]);
  assert.deepStrictEqual(poses[0].target, [1, 1, 1]);
  
  // Last pose should equal last keyframe
  assert.deepStrictEqual(poses[4].position, [4, 4, 4]);
  assert.deepStrictEqual(poses[4].target, [5, 5, 5]);
  
  // Middle pose (index 2) should equal second keyframe position
  assert.ok(
    Math.abs(poses[2].position[0] - 2) < 1e-9 &&
    Math.abs(poses[2].position[1] - 2) < 1e-9 &&
    Math.abs(poses[2].position[2] - 2) < 1e-9
  );
});

test('samplePath returns deterministic results', () => {
  const path = createCameraPath([
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [2, 2, 2], target: [3, 3, 3] },
    { position: [4, 4, 4], target: [5, 5, 5] }
  ]);
  
  const poses1 = samplePath(path, 5);
  const poses2 = samplePath(path, 5);
  
  assert.deepStrictEqual(poses1, poses2);
});

test('samplePath validates count', () => {
  const path = createCameraPath([
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [2, 2, 2], target: [3, 3, 3] }
  ]);
  
  assert.throws(() => samplePath(path, 1), RangeError);
  assert.throws(() => samplePath(path, 1.5), RangeError);
});

test('samplePath with NaN keyframe throws', () => {
  assert.throws(() => createCameraPath([
    { position: [0, 0, 0], target: [1, 1, 1] },
    { position: [2, NaN, 2], target: [3, 3, 3] }
  ]), RangeError);
});
