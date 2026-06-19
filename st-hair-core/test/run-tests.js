import { strict as assert } from 'assert'
import { BufferGeometry, BufferAttribute } from 'three'
import {
  HairSystem, StrandGenerator,
  HairDynamics,
  sampleSpline, sampleTangent, computeRMFrames,
  buildTubeGeometry, buildRibbonGeometry, buildLineGeometry,
  applyKink, applyKinkToStrands, applyClump,
} from '../dist/index.js'

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch(e) { console.error(`  ✗ ${name}: ${e.message}`); failed++ }
}
function approx(a, b, tol = 1e-4) {
  assert(Math.abs(a - b) < tol, `Expected ${a} ≈ ${b} (tol ${tol})`)
}

// ── sampleSpline ──────────────────────────────────────────────────────────────
console.log('\nsampleSpline')

test('t=0 returns first point', () => {
  const pts = [[0,0,0],[1,0,0],[2,0,0]]
  const [x] = sampleSpline(pts, 0)
  approx(x, 0)
})
test('t=1 returns last point', () => {
  const pts = [[0,0,0],[1,0,0],[2,0,0]]
  const [x] = sampleSpline(pts, 1)
  approx(x, 2)
})
test('t=0.5 midpoint', () => {
  const pts = [[0,0,0],[2,0,0]]
  const [x] = sampleSpline(pts, 0.5)
  approx(x, 1, 0.01)
})
test('single point returns that point', () => {
  const [x,y,z] = sampleSpline([[3,4,5]], 0.7)
  approx(x,3); approx(y,4); approx(z,5)
})

// ── sampleTangent ─────────────────────────────────────────────────────────────
console.log('\nsampleTangent')

test('tangent is unit length', () => {
  const pts = [[0,0,0],[0,1,0],[0,2,0]]
  const [tx,ty,tz] = sampleTangent(pts, 0.5)
  approx(Math.sqrt(tx*tx+ty*ty+tz*tz), 1, 0.01)
})
test('vertical strand tangent points up', () => {
  const pts = [[0,0,0],[0,1,0],[0,2,0]]
  const [,ty] = sampleTangent(pts, 0.5)
  assert(ty > 0.9, `Expected upward tangent, got ${ty}`)
})

// ── computeRMFrames ───────────────────────────────────────────────────────────
console.log('\ncomputeRMFrames')

test('returns steps+1 frames', () => {
  const pts = [[0,0,0],[0,1,0],[0,2,0]]
  const frames = computeRMFrames(pts, 8)
  assert(frames.length === 9)
})
test('frame positions lie on spline', () => {
  const pts = [[0,0,0],[0,1,0],[0,2,0]]
  const frames = computeRMFrames(pts, 4)
  approx(frames[0].pos[1], 0, 0.01)
  approx(frames[4].pos[1], 2, 0.01)
})
test('frame normals are unit length', () => {
  const pts = [[0,0,0],[1,1,0],[2,0,0]]
  const frames = computeRMFrames(pts, 4)
  for (const f of frames) {
    const len = Math.sqrt(f.normal[0]**2+f.normal[1]**2+f.normal[2]**2)
    approx(len, 1, 0.01)
  }
})
test('normal and tangent are orthogonal', () => {
  const pts = [[0,0,0],[1,1,0],[2,0,0]]
  const frames = computeRMFrames(pts, 4)
  for (const f of frames) {
    const dot = f.normal[0]*f.tangent[0]+f.normal[1]*f.tangent[1]+f.normal[2]*f.tangent[2]
    approx(dot, 0, 0.01)
  }
})

// ── buildTubeGeometry ─────────────────────────────────────────────────────────
console.log('\nbuildTubeGeometry')

const straightStrand = { points: [[0,0,0],[0,1,0],[0,2,0]] }

test('tube has position attribute', () => {
  const geo = buildTubeGeometry([straightStrand], 8, 6, 0.05, 0.01)
  assert(geo.getAttribute('position') !== null)
})
test('tube vertex count = strands × (steps+1) × (crossSections+1)', () => {
  const geo = buildTubeGeometry([straightStrand], 8, 6, 0.05, 0.01)
  const expected = 1 * (8+1) * (6+1)
  assert(geo.getAttribute('position').count === expected)
})
test('tube has uv attribute with root-to-tip V', () => {
  const geo = buildTubeGeometry([straightStrand], 4, 4, 0.05, 0.01)
  const uv = geo.getAttribute('uv')
  approx(uv.getY(0), 0)     // root
  approx(uv.getY((4)*(4+1)), 1, 0.01)  // tip row
})
test('two strands produce double vertices', () => {
  const strand2 = { points: [[1,0,0],[1,1,0],[1,2,0]] }
  const geo = buildTubeGeometry([straightStrand, strand2], 4, 4, 0.05, 0.01)
  assert(geo.getAttribute('position').count === 2 * (4+1) * (4+1))
})
test('tip is narrower than root', () => {
  const geo = buildTubeGeometry([straightStrand], 8, 6, 0.1, 0.01)
  const pos = geo.getAttribute('position')
  // Root ring (first step) should have larger radius than tip ring (last step)
  // Root verts at row 0, tip at row 8
  const rootR = Math.sqrt(pos.getX(1)**2 + pos.getZ(1)**2)
  const tipR  = Math.sqrt(pos.getX((8)*(6+1)+1)**2 + pos.getZ((8)*(6+1)+1)**2)
  assert(rootR > tipR, `Root r=${rootR.toFixed(4)} should > tip r=${tipR.toFixed(4)}`)
})

// ── buildRibbonGeometry ───────────────────────────────────────────────────────
console.log('\nbuildRibbonGeometry')

test('ribbon vertex count = (steps+1) × 2 per strand', () => {
  const geo = buildRibbonGeometry([straightStrand], 8, 0.04, 0.01)
  assert(geo.getAttribute('position').count === (8+1)*2)
})
test('ribbon has uv', () => {
  const geo = buildRibbonGeometry([straightStrand], 4, 0.04, 0.01)
  const uv = geo.getAttribute('uv')
  approx(uv.getX(0), 0)  // left edge U=0
  approx(uv.getX(1), 1)  // right edge U=1
})
test('ribbon edges are symmetric around strand', () => {
  const geo = buildRibbonGeometry([straightStrand], 4, 0.04, 0.01)
  const pos = geo.getAttribute('position')
  // First row: left and right should be symmetric around X axis
  const lx = pos.getX(0), rx = pos.getX(1)
  approx(lx + rx, 0, 0.001)  // symmetric around 0
})

// ── buildLineGeometry ─────────────────────────────────────────────────────────
console.log('\nbuildLineGeometry')

test('line vertex count = steps × 2 per strand (segments)', () => {
  const geo = buildLineGeometry([straightStrand], 8)
  assert(geo.getAttribute('position').count === 8*2)
})
test('two strands double the line vertices', () => {
  const s2 = { points: [[1,0,0],[1,2,0]] }
  const geo = buildLineGeometry([straightStrand, s2], 4)
  assert(geo.getAttribute('position').count === 2*4*2)
})

// ── KinkModifier ──────────────────────────────────────────────────────────────
console.log('\nKinkModifier')

test('NOTHING kink leaves points unchanged', () => {
  const s = { points: [[0,0,0],[0,1,0],[0,2,0]] }
  const result = applyKink(s, { type: 'NOTHING' })
  for (let i = 0; i < s.points.length; i++) {
    approx(result.points[i][0], s.points[i][0])
    approx(result.points[i][1], s.points[i][1])
  }
})
test('WAVE kink displaces points', () => {
  const s = { points: [[0,0,0],[0,1,0],[0,2,0],[0,3,0]] }
  const result = applyKink(s, { type: 'WAVE', amplitude: 0.5, frequency: 2 })
  // Root point (t=0) has zero displacement (envelope = 0)
  approx(result.points[0][0], 0, 0.01)
  // Tip should be displaced
  const tipDisp = Math.abs(result.points[3][0]) + Math.abs(result.points[3][2])
  assert(tipDisp > 0, `Tip should be displaced`)
})
test('CURL kink produces circular pattern', () => {
  const pts = Array.from({length:8},(_,i)=>([0, i*0.2, 0]))
  const s = { points: pts }
  const result = applyKink(s, { type: 'CURL', amplitude: 0.3, frequency: 3 })
  // Points should span across X and Z axes
  const maxX = Math.max(...result.points.map(p=>Math.abs(p[0])))
  assert(maxX > 0.01, 'CURL should produce X displacement')
})
test('zero amplitude leaves unchanged', () => {
  const s = { points: [[0,0,0],[0,1,0],[0,2,0]] }
  const result = applyKink(s, { type: 'WAVE', amplitude: 0 })
  approx(result.points[2][0], 0)
})
test('applyKinkToStrands maps over array', () => {
  const strands = [straightStrand, straightStrand]
  const result = applyKinkToStrands(strands, { type: 'CURL', amplitude: 0.1, frequency: 2 })
  assert(result.length === 2)
})
test('kink does not mutate original strand', () => {
  const s = { points: [[0,0,0],[0,1,0],[0,2,0]] }
  applyKink(s, { type: 'WAVE', amplitude: 0.5, frequency: 2 })
  approx(s.points[2][0], 0)
})

// ── ClumpModifier ─────────────────────────────────────────────────────────────
console.log('\nClumpModifier')

test('clump pulls child toward parent', () => {
  const parent  = { points: [[0,0,0],[0,1,0],[0,2,0]] }
  const child   = { points: [[1,0,0],[1,1,0],[1,2,0]] }
  const result  = applyClump([child], [parent], { factor: 1, shape: 1 })
  // Tip should be pulled all the way to parent tip
  approx(result[0].points[2][0], 0, 0.01)
})
test('clump factor 0 leaves unchanged', () => {
  const parent = { points: [[0,0,0],[0,1,0]] }
  const child  = { points: [[1,0,0],[1,1,0]] }
  const result = applyClump([child], [parent], { factor: 0 })
  approx(result[0].points[1][0], 1)
})
test('clump root stays at original position', () => {
  const parent = { points: [[0,0,0],[0,2,0]] }
  const child  = { points: [[1,0,0],[1,2,0]] }
  const result = applyClump([child], [parent], { factor: 1, shape: 1 })
  approx(result[0].points[0][0], 1)  // root unchanged (t=0, envelope=0)
})
test('no parents leaves unchanged', () => {
  const child  = { points: [[1,0,0],[1,2,0]] }
  const result = applyClump([child], [], { factor: 1 })
  approx(result[0].points[1][0], 1)
})

// ── HairSystem ────────────────────────────────────────────────────────────────
console.log('\nHairSystem')

test('empty system builds empty geometry', () => {
  const h = new HairSystem()
  const geo = h.build()
  assert(geo instanceof BufferGeometry)
})
test('parameters object exposed', () => {
  const h = new HairSystem({ radiusRoot: 0.05, radiusTip: 0.01 })
  approx(h.parameters.radiusRoot, 0.05)
  approx(h.parameters.radiusTip, 0.01)
})
test('tube mode — build produces geometry', () => {
  const h = new HairSystem({ mode: 'tube', steps: 4, crossSections: 4 })
  h.addStrand({ points: [[0,0,0],[0,1,0],[0,2,0]] })
  const geo = h.build()
  assert(geo.getAttribute('position').count > 0)
})
test('ribbon mode — build produces geometry', () => {
  const h = new HairSystem({ mode: 'ribbon', steps: 4 })
  h.addStrand({ points: [[0,0,0],[0,1,0],[0,2,0]] })
  const geo = h.build()
  assert(geo.getAttribute('position').count > 0)
})
test('line mode — build produces geometry', () => {
  const h = new HairSystem({ mode: 'line', steps: 4 })
  h.addStrand({ points: [[0,0,0],[0,1,0],[0,2,0]] })
  const geo = h.build()
  assert(geo.getAttribute('position').count > 0)
})
test('setStrands replaces strands', () => {
  const h = new HairSystem()
  h.addStrand({ points: [[0,0,0],[0,1,0]] })
  h.setStrands([])
  assert(h.strandCount === 0)
})
test('kink applied in build', () => {
  // frequency=0.5 so phase at t=0.5 is π/2, sin=1 (non-zero displacement)
  const h = new HairSystem({ mode: 'tube', steps: 4, crossSections: 3, kinkType: 'WAVE', kinkAmplitude: 0.3, kinkFrequency: 0.5 })
  h.addStrand({ points: [[0,0,0],[0,1,0],[0,2,0]] })
  const geo1 = h.build()
  h.parameters.kinkType = 'NOTHING'
  const geo2 = h.build()
  // With kink the positions should differ
  const p1 = geo1.getAttribute('position')
  const p2 = geo2.getAttribute('position')
  let differs = false
  for (let i = 0; i < p1.count; i++) {
    const dx = Math.abs(p1.getX(i) - p2.getX(i))
    const dy = Math.abs(p1.getY(i) - p2.getY(i))
    const dz = Math.abs(p1.getZ(i) - p2.getZ(i))
    if (dx > 0.001 || dy > 0.001 || dz > 0.001) { differs = true; break }
  }
  assert(differs, 'Kink should produce different geometry')
})
test('clump applied when parents set', () => {
  const parent = { points: [[0,0,0],[0,2,0]] }
  const child  = { points: [[0.5,0,0],[0.5,2,0]] }
  const h = new HairSystem({ mode: 'line', steps: 4 })
  h.setStrands([child])
  h.setParents([parent])
  h.parameters.clumpFactor = 1
  const geo = h.build()
  const pos = geo.getAttribute('position')
  // Tip vertices should be close to parent tip (x≈0)
  let minAbsX = Infinity
  for (let i = 0; i < pos.count; i++) minAbsX = Math.min(minAbsX, Math.abs(pos.getX(i)))
  approx(minAbsX, 0, 0.05)
})
test('strandCount reflects added strands', () => {
  const h = new HairSystem()
  h.addStrand({ points: [[0,0,0],[0,1,0]] })
  h.addStrand({ points: [[1,0,0],[1,1,0]] })
  assert(h.strandCount === 2)
})

// ── StrandGenerator ───────────────────────────────────────────────────────────
console.log('\nStrandGenerator')

function makeSphereGeo() {
  // Simple UV sphere for testing
  const segs=8, rings=4, r=1
  const pos=[], nor=[], idx=[]
  for(let i=0;i<=rings;i++){
    const phi=i/rings*Math.PI,sp=Math.sin(phi),cp=Math.cos(phi)
    for(let j=0;j<=segs;j++){
      const th=j/segs*Math.PI*2,x=Math.cos(th)*sp,y=cp,z=Math.sin(th)*sp
      pos.push(x*r,y*r,z*r); nor.push(x,y,z)
    }
  }
  const cols=segs+1
  for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){
    const a=i*cols+j,b=a+cols; idx.push(a,b,a+1,b,b+1,a+1)
  }
  const geo=new BufferGeometry()
  geo.setAttribute('position',new BufferAttribute(new Float32Array(pos),3))
  geo.setAttribute('normal',new BufferAttribute(new Float32Array(nor),3))
  geo.setIndex(idx)
  return geo
}

test('generates correct strand count', () => {
  const gen = new StrandGenerator({ count: 50, length: 1, segments: 4 })
  const strands = gen.generate(makeSphereGeo())
  assert(strands.length === 50)
})
test('each strand has segments+1 points', () => {
  const gen = new StrandGenerator({ count: 10, length: 1, segments: 5 })
  const strands = gen.generate(makeSphereGeo())
  for (const s of strands) {
    assert(s.points.length === 6, `Expected 6 points, got ${s.points.length}`)
  }
})
test('strand roots lie close to mesh surface', () => {
  const gen = new StrandGenerator({ count: 20, length: 0.5, segments: 3 })
  const strands = gen.generate(makeSphereGeo())
  for (const s of strands) {
    const [x,y,z] = s.points[0]
    const d = Math.sqrt(x*x+y*y+z*z)
    approx(d, 1, 0.15)  // sphere radius = 1; barycentric interp on flat faces can be ~0.90
  }
})
test('different seeds give different strands', () => {
  const geo = makeSphereGeo()
  const g1 = new StrandGenerator({ count: 10, seed: 0 })
  const g2 = new StrandGenerator({ count: 10, seed: 99 })
  const s1 = g1.generate(geo)
  const s2 = g2.generate(geo)
  assert(s1[0].points[0][0] !== s2[0].points[0][0] || s1[0].points[0][1] !== s2[0].points[0][1])
})
test('parameters exposed', () => {
  const gen = new StrandGenerator({ count: 200, length: 2 })
  assert(gen.parameters.count === 200)
  assert(gen.parameters.length === 2)
})
test('StrandGenerator integrates with HairSystem', () => {
  const gen  = new StrandGenerator({ count: 30, length: 0.3, segments: 4 })
  const hair = new HairSystem({ mode: 'ribbon', steps: 4 })
  hair.setStrands(gen.generate(makeSphereGeo()))
  const geo = hair.build()
  assert(geo.getAttribute('position').count > 0)
})

// ── HairDynamics ──────────────────────────────────────────────────────────────
console.log('\nHairDynamics')

const makeStrand = (n = 5, length = 1) => ({
  points: Array.from({ length: n }, (_, i) => [0, i * (length / (n - 1)), 0]),
})

test('root is pinned after update', () => {
  const strand = makeStrand(5, 1)
  const dyn = new HairDynamics([strand], { gravity: -9.8 })
  dyn.update(0.016)
  const result = dyn.getStrands()[0].points[0]
  approx(result[0], strand.points[0][0])
  approx(result[1], strand.points[0][1])
  approx(result[2], strand.points[0][2])
})

test('free particles fall under gravity', () => {
  const strand = makeStrand(3, 0.5)
  const dyn = new HairDynamics([strand], { gravity: -9.8, stiffness: 0, damping: 1.0 })
  dyn.update(0.1)
  const tip = dyn.getStrands()[0].points[2]
  assert(tip[1] < strand.points[2][1], 'Tip should fall below initial position')
})

test('distance constraints preserve approximate segment length', () => {
  const strand = makeStrand(4, 1.2)
  const dyn = new HairDynamics([strand], { gravity: -9.8, stiffness: 0.9, iterations: 5 })
  for (let i = 0; i < 20; i++) dyn.update(0.016)
  const pts = dyn.getStrands()[0].points
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1][0]-pts[i][0], dy = pts[i+1][1]-pts[i][1], dz = pts[i+1][2]-pts[i][2]
    const d = Math.sqrt(dx*dx+dy*dy+dz*dz)
    const restDist = 1.2 / 3
    assert(Math.abs(d - restDist) < restDist * 0.5, `Segment ${i} length ${d.toFixed(3)} too far from rest ${restDist.toFixed(3)}`)
  }
})

test('collision sphere pushes free particles outside', () => {
  // Place root above the sphere so free particles fall into it
  const strand = { points: [[0, 3, 0], [0, 2, 0], [0, 1.5, 0]] }
  const dyn = new HairDynamics([strand], { gravity: -9.8, stiffness: 0.5, collisionSphere: [0, 0, 0, 1.4] })
  for (let i = 0; i < 60; i++) dyn.update(0.016)
  const pts = dyn.getStrands()[0].points
  // Check free particles (index 1+) are outside sphere
  for (let i = 1; i < pts.length; i++) {
    const [x, y, z] = pts[i]
    const d = Math.sqrt(x*x + y*y + z*z)
    assert(d >= 1.3, `Free particle ${i} inside sphere: d=${d.toFixed(3)}`)
  }
})

test('parameters exposed and writable', () => {
  const dyn = new HairDynamics([makeStrand()], { gravity: -9.8, windX: 1 })
  assert(typeof dyn.parameters.gravity === 'number')
  dyn.parameters.gravity = -5
  approx(dyn.parameters.gravity, -5)
})

test('resetTo reinitializes simulation', () => {
  const s1 = makeStrand(3, 0.5)
  const s2 = { points: [[1, 0, 0], [1, 0.5, 0], [1, 1.0, 0]] }
  const dyn = new HairDynamics([s1], { gravity: -9.8 })
  dyn.update(0.1)
  dyn.resetTo([s2])
  const pts = dyn.getStrands()[0].points
  approx(pts[0][0], 1)
  approx(pts[0][1], 0)
})

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
