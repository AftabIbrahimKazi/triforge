import { Vector3 } from 'three'
import { BezierCurve, CatmullRomCurve, NURBSCurve, CurveTube, CurveLine, computeRMFrames } from '../dist/index.js'

function bench(label, fn, iters = 10_000) {
  fn()
  const t0 = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const ms = performance.now() - t0
  console.log(`  ${label}: ${(ms / iters * 1000).toFixed(1)} µs/op  (${iters} iters)`)
}

const v = (x,y,z) => new Vector3(x,y,z)

console.log('\n── st-curve-core benchmark ──\n')

// 1. BezierCurve.getPoint
const bezier = new BezierCurve([v(0,0,0),v(1,1,0),v(2,1,0),v(3,0,0)])
bench('BezierCurve.getPoint     (1 segment)', () => bezier.getPoint(Math.random()))

// 2. CatmullRomCurve.getPoint
const catmull = new CatmullRomCurve([v(0,0,0),v(1,2,0),v(2,-1,0),v(3,1,0),v(4,0,0)])
bench('CatmullRomCurve.getPoint (5 points)',  () => catmull.getPoint(Math.random()))

// 3. getLength
bench('CatmullRomCurve.getLength (200 div)', () => catmull.getLength(200))

// 4. getSpacedPoints — 64 points
bench('CatmullRomCurve.getSpacedPoints 64', () => catmull.getSpacedPoints(64))

// 5. RMF frames — 64 frames
bench('computeRMFrames          (64 frames)', () => computeRMFrames(catmull, 64))

// 6. CurveTube
const tube = new CurveTube({ tubularSegments: 64, radialSegments: 12 })
bench('CurveTube.apply          (64×12)',     () => tube.apply(catmull))

// 7. CurveLine
const line = new CurveLine({ points: 128 })
bench('CurveLine.apply          (128 pts)',   () => line.apply(catmull))

console.log()
