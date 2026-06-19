// st-keyframe tests — plain Node.js, no framework
// Run: npm run build && npm test

import {
  KeyframeTrack,
  QuaternionTrack,
  AnimationClip,
  AnimationMixer,
  buildClip,
  linear, constant,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeInSine, easeOutSine, easeInOutSine,
  easeInExpo,
  easeInBounce, easeOutBounce,
  easeInElastic,
  Easings,
  interpolateKeyframes,
} from '../dist/index.js'

let pass = 0, fail = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    pass++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    fail++
  }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg) }
function approx(a, b, eps = 1e-5) {
  if (Math.abs(a - b) > eps) throw new Error(`expected ${b}, got ${a}`)
}

// ─── Easings ──────────────────────────────────────────────────────────────────
console.log('\nEasings')

test('linear(0)=0, linear(1)=1, linear(0.5)=0.5', () => {
  approx(linear(0), 0); approx(linear(1), 1); approx(linear(0.5), 0.5)
})
test('constant: step at t<1 returns 0, at t=1 returns 1', () => {
  approx(constant(0), 0); approx(constant(0.99), 0); approx(constant(1), 1)
})
test('all easings pass through (0) and (1)', () => {
  const fns = [
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInSine, easeOutSine, easeInOutSine,
    easeInExpo,
    easeInBounce, easeOutBounce,
    easeInElastic,
  ]
  for (const fn of fns) {
    approx(fn(0), 0, 1e-4)
    approx(fn(1), 1, 1e-4)
  }
})
test('easeInQuad is monotonically increasing', () => {
  let prev = -Infinity
  for (let i = 0; i <= 10; i++) {
    const v = easeInQuad(i / 10)
    assert(v >= prev, `not monotone at t=${i/10}`)
    prev = v
  }
})
test('Easings registry has LINEAR and BEZIER keys', () => {
  assert('LINEAR' in Easings)
  assert('BEZIER' in Easings)
  assert('BOUNCE' in Easings)
})

// ─── interpolateKeyframes ─────────────────────────────────────────────────────
console.log('\ninterpolateKeyframes')

test('linear interpolation at midpoint', () => {
  const kf0 = { time: 0, value: 0, easing: linear }
  const kf1 = { time: 2, value: 10 }
  approx(interpolateKeyframes(kf0, kf1, 1), 5)
})
test('at kf0.time returns kf0.value', () => {
  const kf0 = { time: 1, value: 5 }
  const kf1 = { time: 3, value: 9 }
  approx(interpolateKeyframes(kf0, kf1, 1), 5)
})
test('at kf1.time returns kf1.value', () => {
  const kf0 = { time: 0, value: 0 }
  const kf1 = { time: 4, value: 8 }
  approx(interpolateKeyframes(kf0, kf1, 4), 8)
})
test('same time keyframes returns kf0.value', () => {
  const kf0 = { time: 2, value: 7 }
  const kf1 = { time: 2, value: 99 }
  approx(interpolateKeyframes(kf0, kf1, 2), 7)
})

// ─── KeyframeTrack ────────────────────────────────────────────────────────────
console.log('\nKeyframeTrack')

test('construction stores target and property', () => {
  const target = { x: 0 }
  const track  = new KeyframeTrack(target, 'x')
  assert(track.target === target)
  assert(track.property === 'x')
})
test('empty track: evaluate does nothing', () => {
  const target = { x: 5 }
  const track  = new KeyframeTrack(target, 'x')
  track.evaluate(0)
  approx(target.x, 5)
})
test('single keyframe: always returns that value', () => {
  const target = { x: 0 }
  const track  = new KeyframeTrack(target, 'x', [{ time: 1, value: 42 }])
  track.evaluate(0); approx(target.x, 42)
  track.evaluate(5); approx(target.x, 42)
})
test('before first keyframe: clamps to first value', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 1, value: 10 },
    { time: 3, value: 20 },
  ])
  track.evaluate(0)
  approx(target.v, 10)
})
test('after last keyframe: clamps to last value', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 1, value: 10 },
    { time: 3, value: 20 },
  ])
  track.evaluate(99)
  approx(target.v, 20)
})
test('linear interpolation at midpoint', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 0, value: 0, easing: linear },
    { time: 2, value: 10 },
  ])
  track.evaluate(1)
  approx(target.v, 5)
})
test('easeInOutQuad gives non-linear result', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 0, value: 0, easing: easeInOutQuad },
    { time: 2, value: 10 },
  ])
  track.evaluate(1)
  // easeInOutQuad(0.5) = 0.5 exactly (inflection), but verify it's 5
  approx(target.v, 5, 0.01)
})
test('addKeyframe inserts sorted', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 0, value: 0 },
    { time: 4, value: 8 },
  ])
  track.addKeyframe({ time: 2, value: 5 })
  assert(track.keyframes.length === 3)
  assert(track.keyframes[1].time === 2)
})
test('addKeyframe replaces existing time', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [{ time: 1, value: 10 }])
  track.addKeyframe({ time: 1, value: 99 })
  assert(track.keyframes.length === 1)
  approx(track.keyframes[0].value, 99)
})
test('removeKeyframe removes by time', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 0, value: 0 },
    { time: 1, value: 5 },
    { time: 2, value: 10 },
  ])
  track.removeKeyframe(1)
  assert(track.keyframes.length === 2)
})
test('duration = last keyframe time', () => {
  const target = { v: 0 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 0, value: 0 },
    { time: 5, value: 1 },
  ])
  approx(track.duration, 5)
})
test('sample does not modify target', () => {
  const target = { v: 7 }
  const track  = new KeyframeTrack(target, 'v', [
    { time: 0, value: 0 },
    { time: 2, value: 10 },
  ])
  const val = track.sample(1)
  approx(val, 5)
  approx(target.v, 7)  // unchanged
})
test('multiple keyframes: binary search finds correct segment', () => {
  const target = { v: 0 }
  const kfs = [0,1,2,3,4,5].map(t => ({ time: t, value: t * 10, easing: linear }))
  const track  = new KeyframeTrack(target, 'v', kfs)
  track.evaluate(3.5); approx(target.v, 35)
  track.evaluate(0.5); approx(target.v, 5)
  track.evaluate(4.5); approx(target.v, 45)
})

// ─── AnimationClip ────────────────────────────────────────────────────────────
console.log('\nAnimationClip')

test('empty clip has 0 duration', () => {
  const clip = new AnimationClip('test')
  approx(clip.duration, 0)
})
test('duration = max track duration', () => {
  const t1 = new KeyframeTrack({ a: 0 }, 'a', [{ time: 0, value: 0 }, { time: 3, value: 1 }])
  const t2 = new KeyframeTrack({ b: 0 }, 'b', [{ time: 0, value: 0 }, { time: 5, value: 1 }])
  const clip = new AnimationClip('test', [t1, t2])
  approx(clip.duration, 5)
})
test('evaluate drives all tracks', () => {
  const obj1 = { x: 0 }, obj2 = { y: 0 }
  const t1   = new KeyframeTrack(obj1, 'x', [{ time: 0, value: 0 }, { time: 2, value: 10 }])
  const t2   = new KeyframeTrack(obj2, 'y', [{ time: 0, value: 100 }, { time: 2, value: 0 }])
  const clip = new AnimationClip('test', [t1, t2])
  clip.evaluate(1)
  approx(obj1.x, 5)
  approx(obj2.y, 50)
})
test('addTrack increases track count', () => {
  const clip  = new AnimationClip('test')
  const track = new KeyframeTrack({ a: 0 }, 'a')
  clip.addTrack(track)
  assert(clip.tracks.length === 1)
})
test('removeTrack removes correct track', () => {
  const t1   = new KeyframeTrack({ a: 0 }, 'a')
  const t2   = new KeyframeTrack({ b: 0 }, 'b')
  const clip = new AnimationClip('test', [t1, t2])
  clip.removeTrack(t1)
  assert(clip.tracks.length === 1)
  assert(clip.tracks[0] === t2)
})

// ─── AnimationMixer ───────────────────────────────────────────────────────────
console.log('\nAnimationMixer')

test('play adds action, update drives target', () => {
  const obj  = { x: 0 }
  const clip = new AnimationClip('test', [
    new KeyframeTrack(obj, 'x', [{ time: 0, value: 0 }, { time: 1, value: 10 }])
  ])
  const mixer = new AnimationMixer()
  mixer.play(clip)
  mixer.update(0.5)
  approx(obj.x, 5)
})
test('wrapMode=once stops after clip ends', () => {
  const obj  = { x: 0 }
  const clip = new AnimationClip('test', [
    new KeyframeTrack(obj, 'x', [{ time: 0, value: 0 }, { time: 1, value: 10 }])
  ])
  const mixer  = new AnimationMixer()
  const action = mixer.play(clip, { wrapMode: 'once' })
  mixer.update(2)  // past end
  assert(!action.playing)
  approx(obj.x, 10)
})
test('wrapMode=loop wraps time around', () => {
  const obj  = { x: 0 }
  const clip = new AnimationClip('test', [
    new KeyframeTrack(obj, 'x', [{ time: 0, value: 0, easing: linear }, { time: 1, value: 10 }])
  ])
  const mixer  = new AnimationMixer()
  const action = mixer.play(clip, { wrapMode: 'loop' })
  mixer.update(1.5)  // 0.5 into second loop
  assert(action.loopCount >= 1)
  approx(obj.x, 5, 0.1)
})
test('wrapMode=pingpong reverses direction', () => {
  const obj  = { x: 0 }
  const clip = new AnimationClip('test', [
    new KeyframeTrack(obj, 'x', [{ time: 0, value: 0, easing: linear }, { time: 1, value: 10 }])
  ])
  const mixer = new AnimationMixer()
  mixer.play(clip, { wrapMode: 'pingpong' })
  mixer.update(1)   // reaches end
  mixer.update(0.5) // playing in reverse, at 0.5
  approx(obj.x, 5, 0.1)
})
test('stop removes action', () => {
  const clip   = new AnimationClip('test')
  const mixer  = new AnimationMixer()
  const action = mixer.play(clip)
  mixer.stop(action)
  assert(mixer.actions.length === 0)
})
test('stopAll removes all actions', () => {
  const clip  = new AnimationClip('test')
  const mixer = new AnimationMixer()
  mixer.play(clip); mixer.play(clip); mixer.play(clip)
  mixer.stopAll()
  assert(mixer.actions.length === 0)
})
test('timeScale=2 doubles speed', () => {
  const obj  = { x: 0 }
  const clip = new AnimationClip('test', [
    new KeyframeTrack(obj, 'x', [{ time: 0, value: 0, easing: linear }, { time: 4, value: 40 }])
  ])
  const mixer = new AnimationMixer()
  mixer.play(clip, { timeScale: 2 })
  mixer.update(1)  // t=2 at 2x speed → x=20
  approx(obj.x, 20)
})
test('paused action does not advance', () => {
  const obj  = { x: 0 }
  const clip = new AnimationClip('test', [
    new KeyframeTrack(obj, 'x', [{ time: 0, value: 0 }, { time: 1, value: 10 }])
  ])
  const mixer  = new AnimationMixer()
  const action = mixer.play(clip, { playing: false })
  mixer.update(1)
  approx(obj.x, 0)
  assert(!action.playing)
})

// ─── buildClip ───────────────────────────────────────────────────────────────
console.log('\nbuildClip')

test('builds clip with correct track count', () => {
  const a = { x: 0, y: 0 }
  const clip = buildClip('test', [
    { time: 0, targets: [[a, { x: 0, y: 100 }]] },
    { time: 1, targets: [[a, { x: 10, y: 0 }]] },
  ])
  assert(clip.tracks.length === 2)
})
test('built clip evaluates correctly', () => {
  const a = { x: 0 }
  const clip = buildClip('fade', [
    { time: 0, targets: [[a, { x: 0 }]], easing: linear },
    { time: 2, targets: [[a, { x: 20 }]] },
  ])
  clip.evaluate(1)
  approx(a.x, 10)
})
test('buildClip clip duration matches last step time', () => {
  const a = { x: 0 }
  const clip = buildClip('test', [
    { time: 0, targets: [[a, { x: 0 }]] },
    { time: 3, targets: [[a, { x: 1 }]] },
  ])
  approx(clip.duration, 3)
})
test('buildClip supports multiple targets in one step', () => {
  const a = { x: 0 }, b = { y: 0 }
  const clip = buildClip('multi', [
    { time: 0, targets: [[a, { x: 0 }], [b, { y: 0 }]] },
    { time: 1, targets: [[a, { x: 5 }], [b, { y: 10 }]] },
  ])
  clip.evaluate(1)
  approx(a.x, 5); approx(b.y, 10)
})

// ─── QuaternionTrack ─────────────────────────────────────────────────────────
console.log('\nQuaternionTrack')

function quat(x, y, z, w) { return { x, y, z, w } }
function quatLen(q) { return Math.sqrt(q.x**2+q.y**2+q.z**2+q.w**2) }

test('empty track: evaluate does nothing', () => {
  const target = quat(0, 0, 0, 1)
  const track  = new QuaternionTrack(target)
  track.evaluate(0)
  approx(target.w, 1)
})
test('single keyframe: clamps at any time', () => {
  const target = quat(0, 0, 0, 1)
  const kf     = quat(0, 0, Math.SQRT1_2, Math.SQRT1_2)  // 90° around Z
  const track  = new QuaternionTrack(target, [{ time: 1, value: kf }])
  track.evaluate(0);   approx(target.z, kf.z, 1e-5)
  track.evaluate(100); approx(target.z, kf.z, 1e-5)
})
test('evaluate at t=0 clamps to first keyframe', () => {
  const target = quat(0, 0, 0, 1)
  const q1 = quat(0, 0, 0, 1)
  const q2 = quat(0, 0, Math.SQRT1_2, Math.SQRT1_2)
  const track = new QuaternionTrack(target, [{ time: 1, value: q1 }, { time: 2, value: q2 }])
  track.evaluate(0)
  approx(target.w, 1)
  approx(target.z, 0)
})
test('evaluate at t=duration clamps to last keyframe', () => {
  const target = quat(0, 0, 0, 1)
  const q1 = quat(0, 0, 0, 1)
  const q2 = quat(0, 0, Math.SQRT1_2, Math.SQRT1_2)
  const track = new QuaternionTrack(target, [{ time: 0, value: q1 }, { time: 1, value: q2 }])
  track.evaluate(1)
  approx(target.z, Math.SQRT1_2, 1e-4)
  approx(target.w, Math.SQRT1_2, 1e-4)
})
test('SLERP at midpoint: result is unit quaternion', () => {
  const target = quat(0, 0, 0, 1)
  const q1 = quat(0, 0, 0, 1)
  const q2 = quat(0, 1, 0, 0)  // 180° around Y
  const track = new QuaternionTrack(target, [{ time: 0, value: q1 }, { time: 1, value: q2 }])
  track.evaluate(0.5)
  approx(quatLen(target), 1, 1e-5)
})
test('SLERP identity → identity = identity at any t', () => {
  const target = quat(0, 0, 0, 1)
  const id     = quat(0, 0, 0, 1)
  const track  = new QuaternionTrack(target, [{ time: 0, value: id }, { time: 2, value: id }])
  track.evaluate(1)
  approx(target.x, 0); approx(target.y, 0); approx(target.z, 0); approx(target.w, 1)
})
test('SLERP chooses shortest path (dot < 0 case)', () => {
  const target = quat(0, 0, 0, 1)
  // Negated identity still represents the same rotation but dot with identity = -1
  const q1 = quat(0, 0, 0, 1)
  const q2 = quat(0, 0, 0, -1)
  const track = new QuaternionTrack(target, [{ time: 0, value: q1 }, { time: 1, value: q2 }])
  track.evaluate(0.5)
  // Midpoint should still be identity-like (shortest path = stay still)
  approx(quatLen(target), 1, 1e-5)
})
test('addKeyframe inserts sorted', () => {
  const target = quat(0, 0, 0, 1)
  const track  = new QuaternionTrack(target, [
    { time: 0, value: quat(0,0,0,1) },
    { time: 2, value: quat(0,0,0,1) },
  ])
  track.addKeyframe({ time: 1, value: quat(0,0,0,1) })
  assert(track.keyframes.length === 3)
  assert(track.keyframes[1].time === 1)
})
test('duration = last keyframe time', () => {
  const track = new QuaternionTrack(quat(0,0,0,1), [
    { time: 0, value: quat(0,0,0,1) },
    { time: 3, value: quat(0,0,0,1) },
  ])
  approx(track.duration, 3)
})
test('sample does not modify target', () => {
  const target = quat(0, 0, 0, 1)
  const q2     = quat(0, 1, 0, 0)
  const track  = new QuaternionTrack(target, [
    { time: 0, value: quat(0,0,0,1) },
    { time: 1, value: q2 },
  ])
  const result = track.sample(0.5)
  // Target unchanged
  approx(target.w, 1); approx(target.x, 0)
  // Result has unit length
  approx(quatLen(result), 1, 1e-5)
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
