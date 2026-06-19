import { KeyframeTrack, AnimationClip, AnimationMixer, buildClip, linear, easeInOutSine } from '../dist/index.js'

function bench(label, fn, iters = 100_000) {
  fn() // warmup
  const t0 = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const ms = performance.now() - t0
  console.log(`  ${label}: ${(ms / iters * 1000).toFixed(2)} µs/op  (${iters} iters, ${ms.toFixed(1)} ms total)`)
}

console.log('\n── st-keyframe benchmark ──\n')

// 1. KeyframeTrack.evaluate (small track, linear)
const obj1  = { x: 0 }
const track1 = new KeyframeTrack(obj1, 'x', [
  { time: 0, value: 0, easing: linear },
  { time: 1, value: 10 },
])
bench('KeyframeTrack.evaluate  (2 keyframes, linear)', () => track1.evaluate(Math.random()))

// 2. KeyframeTrack.evaluate (large track)
const obj2  = { x: 0 }
const kfs50  = Array.from({ length: 50 }, (_, i) => ({
  time: i, value: Math.random() * 100, easing: easeInOutSine
}))
const track2 = new KeyframeTrack(obj2, 'x', kfs50)
bench('KeyframeTrack.evaluate  (50 keyframes, binary search)', () => track2.evaluate(Math.random() * 49))

// 3. AnimationMixer.update — 10 tracks
const objs   = Array.from({ length: 10 }, () => ({ v: 0 }))
const tracks = objs.map((o, i) => new KeyframeTrack(o, 'v', [
  { time: 0, value: 0, easing: easeInOutSine },
  { time: 2, value: i * 10 },
]))
const clip1  = new AnimationClip('stress', tracks)
const mixer  = new AnimationMixer()
mixer.play(clip1, { wrapMode: 'loop' })
bench('AnimationMixer.update   (10-track clip, loop)', () => mixer.update(1/60), 10_000)

// 4. buildClip
const targets = Array.from({ length: 5 }, () => ({ a: 0, b: 0 }))
bench('buildClip               (5 objects × 2 props, 3 steps)', () => {
  buildClip('test', [
    { time: 0, targets: targets.map(t => [t, { a: 0, b: 0 }]) },
    { time: 1, targets: targets.map(t => [t, { a: 5, b: 5 }]), easing: easeInOutSine },
    { time: 2, targets: targets.map(t => [t, { a: 0, b: 10 }]) },
  ])
}, 10_000)

console.log()
