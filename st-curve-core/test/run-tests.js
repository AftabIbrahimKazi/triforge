// st-curve-core tests — plain Node.js, no framework
// Run: npm run build && npm test

import {
  BezierCurve, buildAutoHandles, buildAlignedHandles, buildVectorHandles, buildFreeHandles,
  NURBSCurve, buildOpenUniformKnots, buildNURBSCircle,
  CatmullRomCurve,
  CurveTube, CurveBevel, CurveLine,
  PathFollow,
  computeRMFrames, frameToMatrix,
} from '../dist/index.js'

// Three.js Vector3 polyfill (lightweight)
class V3 {
  constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z }
  clone(){ return new V3(this.x,this.y,this.z) }
  copy(v){ this.x=v.x;this.y=v.y;this.z=v.z;return this }
  set(x,y,z){ this.x=x;this.y=y;this.z=z;return this }
  distanceTo(v){ return Math.sqrt((this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2) }
  dot(v){ return this.x*v.x+this.y*v.y+this.z*v.z }
  sub(v){ this.x-=v.x;this.y-=v.y;this.z-=v.z;return this }
  add(v){ this.x+=v.x;this.y+=v.y;this.z+=v.z;return this }
  multiplyScalar(s){ this.x*=s;this.y*=s;this.z*=s;return this }
  subVectors(a,b){ this.x=a.x-b.x;this.y=a.y-b.y;this.z=a.z-b.z;return this }
  addVectors(a,b){ this.x=a.x+b.x;this.y=a.y+b.y;this.z=a.z+b.z;return this }
  lerpVectors(a,b,t){ this.x=a.x+(b.x-a.x)*t;this.y=a.y+(b.y-a.y)*t;this.z=a.z+(b.z-a.z)*t;return this }
  crossVectors(a,b){
    const ax=a.x,ay=a.y,az=a.z,bx=b.x,by=b.y,bz=b.z
    this.x=ay*bz-az*by;this.y=az*bx-ax*bz;this.z=ax*by-ay*bx;return this
  }
  normalize(){ const l=Math.sqrt(this.x**2+this.y**2+this.z**2)||1;this.x/=l;this.y/=l;this.z/=l;return this }
  length(){ return Math.sqrt(this.x**2+this.y**2+this.z**2) }
}

class M4 {
  constructor(){ this.elements=new Float32Array(16) }
  set(...args){ args.forEach((v,i)=>this.elements[i]=v);return this }
  setFromRotationMatrix(){ return this }
  premultiply(){ return this }
  setPosition(p){ this.elements[12]=p.x;this.elements[13]=p.y;this.elements[14]=p.z;return this }
  makeRotationAxis(){ return this }
}

class Q4 {
  constructor(){ this.x=0;this.y=0;this.z=0;this.w=1 }
  setFromRotationMatrix(){ return this }
}

class O3D {
  constructor(){ this.position=new V3();this.quaternion=new Q4() }
  rotateOnAxis(){}
}

// Inject mocks before loading dist — not possible with ESM.
// Instead: tests use the real three.js stubs via dynamic import patching.
// We'll test at the mathematical level using the public API.

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Monkey-patch global THREE classes the dist imports
import * as THREE from 'three'
// dist/index.js imports three — so as long as three is installed it works.

let pass = 0, fail = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++ }
  catch(e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail++ }
}
function assert(c, m='assertion failed'){ if(!c) throw new Error(m) }
function approx(a,b,eps=1e-4){ if(Math.abs(a-b)>eps) throw new Error(`expected ~${b}, got ${a}`) }
function v3(x,y,z){ return new THREE.Vector3(x,y,z) }

// ─── BezierCurve ─────────────────────────────────────────────────────────────
console.log('\nBezierCurve')

test('single segment: t=0 returns p0', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,1,0),v3(2,1,0),v3(3,0,0)])
  const p = c.getPoint(0)
  approx(p.x,0); approx(p.y,0); approx(p.z,0)
})
test('single segment: t=1 returns p3', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,1,0),v3(2,1,0),v3(3,0,0)])
  const p = c.getPoint(1)
  approx(p.x,3); approx(p.y,0); approx(p.z,0)
})
test('single segment: t=0.5 is midpoint', () => {
  // Symmetric bezier: endpoints at 0 and 2, handles at 1 each side
  const c = new BezierCurve([v3(0,0,0),v3(0,1,0),v3(2,1,0),v3(2,0,0)])
  const p = c.getPoint(0.5)
  approx(p.x, 1, 0.01)  // midpoint x ≈ 1
})
test('curveType is BezierCurve', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0),v3(3,0,0)])
  assert(c.curveType === 'BezierCurve')
})
test('segmentCount = 1 for 4 points', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0),v3(3,0,0)])
  assert(c.segmentCount === 1)
})
test('segmentCount = 2 for 7 points', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0),v3(3,0,0),v3(4,0,0),v3(5,0,0),v3(6,0,0)])
  assert(c.segmentCount === 2)
})
test('straight line bezier matches linear interpolation', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0),v3(3,0,0)])
  const p = c.getPoint(0.5)
  approx(p.x, 1.5, 0.01)
})
test('getTangent at t=0 on straight line points along X', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0),v3(3,0,0)])
  const t = c.getTangent(0)
  approx(t.x, 1, 0.01); approx(t.y, 0, 0.01)
})
test('throws for < 4 points', () => {
  let threw = false
  try { new BezierCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0)]) } catch { threw = true }
  assert(threw)
})
test('getLength returns positive value', () => {
  const c = new BezierCurve([v3(0,0,0),v3(1,1,0),v3(2,1,0),v3(3,0,0)])
  const l = c.getLength()
  assert(l > 0)
})

test('buildAutoHandles produces 2(n-1)+2 = 2n-2... check count for 3 anchors', () => {
  const pts = buildAutoHandles([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  // 3 anchors: [p0,hr0, hl1,p1,hr1, hl2,p2] = 7 points
  assert(pts.length === 7, `expected 7 got ${pts.length}`)
})
test('buildAutoHandles: curve through first and last anchor', () => {
  const anchors = [v3(0,0,0), v3(1,2,0), v3(3,1,0), v3(4,0,0)]
  const pts     = buildAutoHandles(anchors)
  const curve   = new BezierCurve(pts)
  const p0 = curve.getPoint(0), p1 = curve.getPoint(1)
  approx(p0.x, 0, 0.01); approx(p0.y, 0, 0.01)
  approx(p1.x, 4, 0.01); approx(p1.y, 0, 0.01)
})

// ─── NURBSCurve ───────────────────────────────────────────────────────────────
console.log('\nNURBSCurve')

test('curveType is NURBSCurve', () => {
  const c = new NURBSCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  assert(c.curveType === 'NURBSCurve')
})
test('t=0 returns start region, t=1 returns end region', () => {
  const c = new NURBSCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const p0 = c.getPoint(0), p1 = c.getPoint(1)
  assert(p0.x < p1.x, 'start.x should be less than end.x')
})
test('order 2 NURBS = polyline', () => {
  const pts  = [v3(0,0,0),v3(1,1,0),v3(2,0,0)]
  const c    = new NURBSCurve(pts, { order: 2 })
  // Linear spline — t=0.5 should be near (1,1,0)
  const p    = c.getPoint(0.5)
  assert(p.x > 0.5 && p.x < 1.5, `x=${p.x}`)
})
test('buildOpenUniformKnots returns n+order values', () => {
  const knots = buildOpenUniformKnots(5, 4)
  assert(knots.length === 9, `expected 9, got ${knots.length}`)
})
test('buildOpenUniformKnots starts with order zeros', () => {
  const knots = buildOpenUniformKnots(5, 3)
  assert(knots[0] === 0 && knots[1] === 0 && knots[2] === 0)
})
test('buildNURBSCircle returns 9 points', () => {
  const { points } = buildNURBSCircle(1)
  assert(points.length === 9)
})
test('NURBS circle first and last point equal (closed)', () => {
  const { points } = buildNURBSCircle(1)
  approx(points[0].x, points[8].x)
  approx(points[0].y, points[8].y)
})
test('NURBS circle t=0 lies on x-axis', () => {
  const { points, weights, knots } = buildNURBSCircle(1)
  const c = new NURBSCurve(points, { order: 3, weights, knots })
  const p = c.getPoint(0)
  approx(Math.abs(p.x), 1, 0.02)
  approx(Math.abs(p.y), 0, 0.02)
})

// ─── CatmullRomCurve ─────────────────────────────────────────────────────────
console.log('\nCatmullRomCurve')

test('curveType is CatmullRomCurve', () => {
  const c = new CatmullRomCurve([v3(0,0,0),v3(1,0,0)])
  assert(c.curveType === 'CatmullRomCurve')
})
test('t=0 returns first point', () => {
  const c = new CatmullRomCurve([v3(0,0,0),v3(2,0,0),v3(4,0,0)])
  const p = c.getPoint(0)
  approx(p.x, 0, 0.01)
})
test('t=1 returns last point', () => {
  const c = new CatmullRomCurve([v3(0,0,0),v3(2,0,0),v3(4,0,0)])
  const p = c.getPoint(1)
  approx(p.x, 4, 0.01)
})
test('collinear points: t=0.5 gives midpoint', () => {
  const c = new CatmullRomCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0),v3(3,0,0)])
  const p = c.getPoint(0.5)
  approx(p.x, 1.5, 0.05)
})
test('getTangent is unit length', () => {
  const c = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0),v3(3,-1,0)])
  const t = c.getTangent(0.5)
  const len = Math.sqrt(t.x**2 + t.y**2 + t.z**2)
  approx(len, 1, 0.001)
})
test('getSpacedPoints returns correct count', () => {
  const c   = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const pts = c.getSpacedPoints(10)
  assert(pts.length === 10)
})
test('parameters.tension is exposed', () => {
  const c = new CatmullRomCurve([v3(0,0,0),v3(1,0,0)], { tension: 0.25 })
  approx(c.parameters.tension, 0.25)
})
test('closed curve: t=0 and t=1 end near same point', () => {
  const c = new CatmullRomCurve([v3(1,0,0),v3(0,1,0),v3(-1,0,0),v3(0,-1,0)], { closed: true })
  const p0 = c.getPoint(0), p1 = c.getPoint(1)
  // Both are near the first control point
  const d = Math.sqrt((p0.x-p1.x)**2+(p0.y-p1.y)**2+(p0.z-p1.z)**2)
  assert(d < 0.2, `start and end too far apart: ${d}`)
})

// ─── Arc-length LUT ──────────────────────────────────────────────────────────
console.log('\nArc-length LUT')

test('LUT starts at len=0', () => {
  const c = new CatmullRomCurve([v3(0,0,0),v3(1,0,0)])
  const lut = c.buildArcLengthLUT(50)
  approx(lut[0].len, 0)
})
test('LUT is monotonically increasing', () => {
  const c   = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const lut = c.buildArcLengthLUT(50)
  for (let i = 1; i < lut.length; i++) {
    assert(lut[i].len >= lut[i-1].len, `not monotone at i=${i}`)
  }
})
test('getUtoTmapping(0) = 0, getUtoTmapping(1) = 1', () => {
  const c   = new CatmullRomCurve([v3(0,0,0),v3(1,0,0)])
  const lut = c.buildArcLengthLUT(50)
  approx(c.getUtoTmapping(0, lut), 0)
  approx(c.getUtoTmapping(1, lut), 1)
})
test('straight line: uniform spacing gives evenly spaced x', () => {
  const c    = new CatmullRomCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0),v3(3,0,0)])
  const pts  = c.getSpacedPoints(4)
  // 4 points on straight line: x ≈ 0, 1, 2, 3
  approx(pts[0].x, 0,   0.05)
  approx(pts[3].x, 3,   0.05)
})

// ─── CurveTube ───────────────────────────────────────────────────────────────
console.log('\nCurveTube')

test('returns BufferGeometry with position, normal, uv', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const tube  = new CurveTube({ tubularSegments: 8, radialSegments: 6 })
  const geo   = tube.apply(curve)
  assert(geo.getAttribute('position') !== null)
  assert(geo.getAttribute('normal')   !== null)
  assert(geo.getAttribute('uv')       !== null)
})
test('vertex count = (tubularSegments+1)*(radialSegments+1)', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0)])
  const tube  = new CurveTube({ tubularSegments: 8, radialSegments: 6 })
  const geo   = tube.apply(curve)
  const expected = 9 * 7
  assert(geo.getAttribute('position').count === expected, `got ${geo.getAttribute('position').count}`)
})
test('parameters object has radius, tubularSegments, radialSegments', () => {
  const t = new CurveTube({ radius: 0.2 })
  approx(t.parameters.radius, 0.2)
  assert('tubularSegments' in t.parameters)
  assert('radialSegments'  in t.parameters)
})

// ─── CurveBevel ───────────────────────────────────────────────────────────────
console.log('\nCurveBevel')

test('square profile: returns geometry with index', () => {
  const curve   = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const profile = CurveBevel.square(0.1)
  const bevel   = new CurveBevel(profile, { tubularSegments: 8 })
  const geo     = bevel.apply(curve)
  assert(geo.getAttribute('position') !== null)
  assert(geo.index !== null)
})
test('CurveBevel.circle returns correct point count', () => {
  const pts = CurveBevel.circle(0.1, 8)
  assert(pts.length === 8)
})
test('CurveBevel.star returns 2*points points', () => {
  const pts = CurveBevel.star(0.1, 0.05, 5)
  assert(pts.length === 10)
})

// ─── CurveLine ───────────────────────────────────────────────────────────────
console.log('\nCurveLine')

test('returns position attribute with correct count', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,0,0)])
  const line  = new CurveLine({ points: 16 })
  const geo   = line.apply(curve)
  assert(geo.getAttribute('position').count === 16)
})
test('parameters.points is exposed', () => {
  const line = new CurveLine({ points: 32 })
  assert(line.parameters.points === 32)
})

// ─── PathFollow ───────────────────────────────────────────────────────────────
console.log('\nPathFollow')

test('parameters has offset and roll', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,0,0)])
  const pf    = new PathFollow(curve)
  assert('offset' in pf.parameters)
  assert('roll'   in pf.parameters)
})
test('getPosition at u=0 near start', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0)])
  const pf    = new PathFollow(curve)
  const pos   = pf.getPosition(0)
  approx(pos.x, 0, 0.1)
})
test('getPosition at u=1 near end', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0)])
  const pf    = new PathFollow(curve)
  const pos   = pf.getPosition(1)
  approx(pos.x, 2, 0.1)
})
test('getMatrix returns a Matrix4', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const pf    = new PathFollow(curve)
  const m     = pf.getMatrix(0.5)
  assert(typeof m === 'object')
})
test('length is positive', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(3,0,0)])
  const pf    = new PathFollow(curve)
  assert(pf.length > 0)
})

// ─── computeRMFrames ─────────────────────────────────────────────────────────
console.log('\ncomputeRMFrames')

test('returns correct frame count', () => {
  const curve  = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const frames = computeRMFrames(curve, 10)
  assert(frames.length === 10)
})
test('each frame has position, tangent, normal, binormal', () => {
  const curve  = new CatmullRomCurve([v3(0,0,0),v3(1,0,0),v3(2,0,0)])
  const frames = computeRMFrames(curve, 5)
  for (const f of frames) {
    assert('position' in f && 'tangent' in f && 'normal' in f && 'binormal' in f)
  }
})
test('tangent at each frame is unit length', () => {
  const curve  = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const frames = computeRMFrames(curve, 8)
  for (const f of frames) {
    const l = Math.sqrt(f.tangent.x**2+f.tangent.y**2+f.tangent.z**2)
    approx(l, 1, 0.01)
  }
})
test('normal and binormal are orthogonal', () => {
  const curve  = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,-1,0),v3(3,0,0)])
  const frames = computeRMFrames(curve, 8)
  for (const f of frames) {
    const dot = f.normal.dot(f.binormal)
    approx(dot, 0, 0.01)
  }
})

// ─── Bezier Handle Modes ─────────────────────────────────────────────────────
console.log('\nBezier Handle Modes')

test('buildAlignedHandles: throws for < 2 anchors', () => {
  let threw = false
  try { buildAlignedHandles([v3(0,0,0)], [v3(1,0,0)]) } catch { threw = true }
  assert(threw)
})
test('buildAlignedHandles: throws when rightHandles length mismatch', () => {
  let threw = false
  try { buildAlignedHandles([v3(0,0,0),v3(1,0,0)], [v3(0.3,0,0)]) } catch { threw = true }
  assert(threw, 'should have thrown for length mismatch')
})
test('buildAlignedHandles: correct point count for 3 anchors (open)', () => {
  const anchors = [v3(0,0,0), v3(1,1,0), v3(2,0,0)]
  const rights  = [v3(0.3,0.2,0), v3(1.3,1,0), v3(2.3,0,0)]
  const pts = buildAlignedHandles(anchors, rights)
  // Same shape as buildAutoHandles: 7 points
  assert(pts.length === 7, `expected 7 got ${pts.length}`)
})
test('buildAlignedHandles: left handle is mirror of right handle', () => {
  const anchor = v3(1, 1, 0)
  const right  = v3(1.5, 1.2, 0)
  const anchors = [v3(0,0,0), anchor, v3(2,0,0)]
  const rights  = [v3(0.3,0.1,0), right, v3(2.3,0,0)]
  const pts = buildAlignedHandles(anchors, rights)
  // For anchor at index 1: pts = [hl, anchor, hr, ...]
  // pts[0]=anchor0, pts[1]=hr0, pts[2]=hl1, pts[3]=anchor1, pts[4]=hr1, pts[5]=hl2, pts[6]=anchor2
  const hl1 = pts[2]
  // hl1 should be mirror of right around anchor
  approx(hl1.x, 2*anchor.x - right.x, 1e-4)
  approx(hl1.y, 2*anchor.y - right.y, 1e-4)
})
test('buildAlignedHandles: curve passes through first and last anchor', () => {
  const anchors = [v3(0,0,0), v3(1,2,0), v3(3,0,0)]
  const rights  = [v3(0.3,0.5,0), v3(1.4,2,0), v3(3.3,0,0)]
  const pts   = buildAlignedHandles(anchors, rights)
  const curve = new BezierCurve(pts)
  const p0 = curve.getPoint(0), p1 = curve.getPoint(1)
  approx(p0.x, 0, 0.01); approx(p1.x, 3, 0.01)
})

test('buildVectorHandles: correct point count for 3 anchors', () => {
  const pts = buildVectorHandles([v3(0,0,0), v3(1,1,0), v3(2,0,0)])
  assert(pts.length === 7, `expected 7 got ${pts.length}`)
})
test('buildVectorHandles: curve passes through endpoints', () => {
  const anchors = [v3(0,0,0), v3(1,2,0), v3(3,0,0)]
  const pts   = buildVectorHandles(anchors)
  const curve = new BezierCurve(pts)
  const p0 = curve.getPoint(0), p1 = curve.getPoint(1)
  approx(p0.x, 0, 0.01); approx(p1.x, 3, 0.01)
})
test('buildVectorHandles: handle at first anchor points toward next', () => {
  // For a straight horizontal line the right handle of anchor 0 should have y≈0
  const pts = buildVectorHandles([v3(0,0,0), v3(1,0,0), v3(2,0,0)])
  // pts[0]=anchor0, pts[1]=hr0; hr0.y should be 0
  approx(pts[1].y, 0, 1e-4)
})
test('buildVectorHandles: throws for < 2 anchors', () => {
  let threw = false
  try { buildVectorHandles([v3(0,0,0)]) } catch { threw = true }
  assert(threw)
})

test('buildFreeHandles: correct point count for 3 anchors', () => {
  const a = [v3(0,0,0), v3(1,1,0), v3(2,0,0)]
  const l = [v3(-0.2,0,0), v3(0.7,1,0), v3(1.7,0,0)]
  const r = [v3(0.3,0,0), v3(1.3,1,0), v3(2.3,0,0)]
  const pts = buildFreeHandles(a, l, r)
  assert(pts.length === 7, `expected 7 got ${pts.length}`)
})
test('buildFreeHandles: user-supplied handles are used verbatim', () => {
  const anchors = [v3(0,0,0), v3(2,0,0)]
  const lefts   = [v3(-0.5, 0.5, 0), v3(1.5, 0.5, 0)]
  const rights  = [v3(0.5,  0.5, 0), v3(2.5, 0.5, 0)]
  const pts = buildFreeHandles(anchors, lefts, rights)
  // pts[0]=anchor0, pts[1]=rights[0], pts[2]=lefts[1], pts[3]=anchor1
  approx(pts[1].y, 0.5, 1e-5)  // right handle of anchor0
  approx(pts[2].y, 0.5, 1e-5)  // left handle of anchor1
})
test('buildFreeHandles: throws for length mismatch', () => {
  let threw = false
  try { buildFreeHandles([v3(0,0,0),v3(1,0,0)], [v3(0,0,0)], [v3(0,0,0),v3(0,0,0)]) } catch { threw = true }
  assert(threw)
})

// ─── BevelFactor (CurveTube) ─────────────────────────────────────────────────
console.log('\nBevelFactor — CurveTube')

test('bevelFactorStart/End exposed in parameters', () => {
  const tube = new CurveTube({ bevelFactorStart: 0.1, bevelFactorEnd: 0.9 })
  approx(tube.parameters.bevelFactorStart, 0.1)
  approx(tube.parameters.bevelFactorEnd,   0.9)
})
test('default bevelFactor 0..1 gives same vertex count', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const tube1 = new CurveTube({ tubularSegments: 8, radialSegments: 6 })
  const tube2 = new CurveTube({ tubularSegments: 8, radialSegments: 6, bevelFactorStart: 0, bevelFactorEnd: 1 })
  const g1 = tube1.apply(curve)
  const g2 = tube2.apply(curve)
  assert(g1.getAttribute('position').count === g2.getAttribute('position').count)
})
test('trimmed tube: positions differ from full-range tube (not all zeros)', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(2,2,0),v3(4,0,0)])
  const full  = new CurveTube({ tubularSegments: 8, radialSegments: 4 })
  const trim  = new CurveTube({ tubularSegments: 8, radialSegments: 4, bevelFactorStart: 0.25, bevelFactorEnd: 0.75 })
  const gFull = full.apply(curve)
  const gTrim = trim.apply(curve)
  const posF  = gFull.getAttribute('position').array
  const posT  = gTrim.getAttribute('position').array
  // At least one position should differ
  let differs = false
  for (let i = 0; i < posF.length; i++) {
    if (Math.abs(posF[i] - posT[i]) > 0.01) { differs = true; break }
  }
  assert(differs, 'trimmed tube should produce different positions than full tube')
})

// ─── BevelFactor (CurveBevel) ─────────────────────────────────────────────────
console.log('\nBevelFactor — CurveBevel')

test('bevelFactorStart/End exposed in parameters', () => {
  const bevel = new CurveBevel(CurveBevel.square(0.1), { bevelFactorStart: 0.2, bevelFactorEnd: 0.8 })
  approx(bevel.parameters.bevelFactorStart, 0.2)
  approx(bevel.parameters.bevelFactorEnd,   0.8)
})
test('trimmed bevel: geometry is produced', () => {
  const curve = new CatmullRomCurve([v3(0,0,0),v3(1,1,0),v3(2,0,0)])
  const bevel = new CurveBevel(CurveBevel.square(0.1), { tubularSegments: 8, bevelFactorStart: 0.1, bevelFactorEnd: 0.9 })
  const geo   = bevel.apply(curve)
  assert(geo.getAttribute('position') !== null)
  assert(geo.index !== null)
})

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
