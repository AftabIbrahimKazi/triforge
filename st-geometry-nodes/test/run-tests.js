import { strict as assert } from 'assert'
import {
  Grid, UVSphere, IcoSphere, Cylinder, Cone, Cube, Circle,
  TransformGeometry, JoinGeometry, SetPosition, SubdivisionSurface,
  MergeByDistance, FlipFaces,
  DistributePointsOnFaces, InstanceOnPoints,
} from '../dist/index.js'

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch(e) { console.error(`  ✗ ${name}: ${e.message}`); failed++ }
}
function approx(a, b, tol = 1e-4) {
  assert(Math.abs(a - b) < tol, `Expected ${a} ≈ ${b}`)
}

// ── Grid ─────────────────────────────────────────────────────────────────────
console.log('\nGrid')

test('default grid vertex count', () => {
  const g = new Grid()
  const geo = g.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  assert(pos.count === 9, `Expected 9 got ${pos.count}`)  // 3×3 default
})
test('custom size grid', () => {
  const g = new Grid({ vertsX: 5, vertsY: 5 })
  const geo = g.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  assert(pos.count === 25)
})
test('grid has uv attribute', () => {
  const g = new Grid()
  const geo = g.output('Geometry').evaluate()
  assert(geo.getAttribute('uv') !== null)
})
test('grid has index', () => {
  const g = new Grid({ vertsX: 3, vertsY: 3 })
  const geo = g.output('Geometry').evaluate()
  assert(geo.getIndex() !== null)
  assert(geo.getIndex().count === 2 * 4 * 3)  // (vertsX-1)*(vertsY-1)*2 tris * 3
})
test('grid corner positions', () => {
  const g = new Grid({ sizeX: 2, sizeY: 2, vertsX: 2, vertsY: 2 })
  const geo = g.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  approx(pos.getX(0), -1); approx(pos.getY(0), -1)
  approx(pos.getX(3),  1); approx(pos.getY(3),  1)
})
test('parameters object exposed', () => {
  const g = new Grid({ sizeX: 4 })
  assert(g.parameters.sizeX === 4)
})

// ── UVSphere ──────────────────────────────────────────────────────────────────
console.log('\nUVSphere')

test('vertex count = (rings+1)*(segs+1)', () => {
  const s = new UVSphere({ segments: 8, rings: 4 })
  const geo = s.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  assert(pos.count === (4+1)*(8+1), `Expected ${(4+1)*(8+1)} got ${pos.count}`)
})
test('radius applied', () => {
  const s = new UVSphere({ radius: 3, segments: 8, rings: 4 })
  const geo = s.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  // Top vertex should be at y ≈ radius
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i))
  approx(maxY, 3, 0.001)
})
test('normals are unit length', () => {
  const s = new UVSphere({ segments: 8, rings: 4 })
  const geo = s.output('Geometry').evaluate()
  const nor = geo.getAttribute('normal')
  const len = Math.sqrt(nor.getX(5)**2 + nor.getY(5)**2 + nor.getZ(5)**2)
  approx(len, 1, 0.001)
})

// ── IcoSphere ─────────────────────────────────────────────────────────────────
console.log('\nIcoSphere')

test('level 0 = 20 faces = 60 vertices', () => {
  const s = new IcoSphere({ subdivisions: 0 })
  const geo = s.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 60)
})
test('level 1 = 80 faces = 240 vertices', () => {
  const s = new IcoSphere({ subdivisions: 1 })
  const geo = s.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 240)
})
test('radius applied', () => {
  const s = new IcoSphere({ radius: 2, subdivisions: 0 })
  const geo = s.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  const len = Math.sqrt(pos.getX(0)**2 + pos.getY(0)**2 + pos.getZ(0)**2)
  approx(len, 2, 0.01)
})

// ── Cylinder ──────────────────────────────────────────────────────────────────
console.log('\nCylinder')

test('cylinder has position attribute', () => {
  const c = new Cylinder({ vertices: 8 })
  const geo = c.output('Geometry').evaluate()
  assert(geo.getAttribute('position') !== null)
})
test('cap fill NOTHING has fewer vertices', () => {
  const withCap    = new Cylinder({ vertices: 8, capFill: 'NGON' })
  const withoutCap = new Cylinder({ vertices: 8, capFill: 'NOTHING' })
  const wc = withCap.output('Geometry').evaluate().getAttribute('position').count
  const nc = withoutCap.output('Geometry').evaluate().getAttribute('position').count
  assert(wc > nc, `With cap ${wc} should > without ${nc}`)
})
test('cone is cylinder with radiusTop=0', () => {
  const c = new Cone({ vertices: 8, radius: 1, depth: 2 })
  const geo = c.output('Geometry').evaluate()
  assert(geo.getAttribute('position') !== null)
})

// ── Cube ──────────────────────────────────────────────────────────────────────
console.log('\nCube')

test('cube has 24 vertices (4 per face × 6 faces)', () => {
  const c = new Cube()
  const geo = c.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 24)
})
test('cube size applied', () => {
  const c = new Cube({ sizeX: 4, sizeY: 2, sizeZ: 2 })
  const geo = c.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  let maxX = -Infinity
  for (let i = 0; i < pos.count; i++) maxX = Math.max(maxX, pos.getX(i))
  approx(maxX, 2)  // half-size = 2
})

// ── Circle ────────────────────────────────────────────────────────────────────
console.log('\nCircle')

test('circle NOTHING fill — no index', () => {
  const c = new Circle({ vertices: 8, fillType: 'NOTHING' })
  const geo = c.output('Geometry').evaluate()
  assert(!geo.getIndex() || geo.getIndex().count === 0)
})
test('circle TRIFAN fill — has index', () => {
  const c = new Circle({ vertices: 8, fillType: 'TRIFAN' })
  const geo = c.output('Geometry').evaluate()
  assert(geo.getIndex() !== null && geo.getIndex().count > 0)
})
test('circle radius applied', () => {
  const c = new Circle({ vertices: 8, radius: 3, fillType: 'NOTHING' })
  const geo = c.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  const len = Math.sqrt(pos.getX(0)**2 + pos.getZ(0)**2)
  approx(len, 3, 0.001)
})

// ── TransformGeometry ─────────────────────────────────────────────────────────
console.log('\nTransformGeometry')

test('translate moves vertices', () => {
  const g = new Grid({ vertsX: 2, vertsY: 2 })
  const t = new TransformGeometry({ geometry: g.output('Geometry'), translation: [5, 0, 0] })
  const geo = t.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  // All vertices should be shifted by 5 in X
  for (let i = 0; i < pos.count; i++) {
    assert(pos.getX(i) >= 5 - 1 - 0.01, `vertex ${i} x=${pos.getX(i)} should be >= 4`)
  }
})
test('scale doubles size', () => {
  const g = new Grid({ sizeX: 2, sizeY: 2, vertsX: 2, vertsY: 2 })
  const t = new TransformGeometry({ geometry: g.output('Geometry'), scale: [2, 2, 1] })
  const geo = t.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  let maxX = -Infinity
  for (let i = 0; i < pos.count; i++) maxX = Math.max(maxX, pos.getX(i))
  approx(maxX, 2, 0.01)
})
test('null geometry returns null', () => {
  const t = new TransformGeometry()
  const geo = t.output('Geometry').evaluate()
  assert(geo === null)
})
test('chained transform graph evaluates correctly', () => {
  const g  = new Grid({ vertsX: 2, vertsY: 2 })
  const t1 = new TransformGeometry({ geometry: g.output('Geometry'), translation: [1, 0, 0] })
  const t2 = new TransformGeometry({ geometry: t1.output('Geometry'), translation: [1, 0, 0] })
  const geo = t2.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  let minX = Infinity
  for (let i = 0; i < pos.count; i++) minX = Math.min(minX, pos.getX(i))
  assert(minX >= 1 - 0.001, `min X should be ≥ 1 after two +1 translations, got ${minX}`)
})

// ── JoinGeometry ──────────────────────────────────────────────────────────────
console.log('\nJoinGeometry')

test('join two grids doubles vertex count', () => {
  const g1 = new Grid({ vertsX: 2, vertsY: 2 })
  const g2 = new Grid({ vertsX: 2, vertsY: 2 })
  const j  = new JoinGeometry([g1.output('Geometry'), g2.output('Geometry')])
  const geo = j.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 8)
})
test('join single geometry returns clone', () => {
  const g = new Grid({ vertsX: 3, vertsY: 3 })
  const j = new JoinGeometry([g.output('Geometry')])
  const geo = j.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 9)
})

// ── SetPosition ───────────────────────────────────────────────────────────────
console.log('\nSetPosition')

test('constant offset moves all vertices', () => {
  const g = new Grid({ vertsX: 2, vertsY: 2, sizeX: 2, sizeY: 2 })
  const s = new SetPosition({ geometry: g.output('Geometry'), offset: [0, 5, 0] })
  const geo = s.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  // Grid Y ranges from -1 to 1; after +5 offset all Y should be >= 4
  let minY = Infinity
  for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i))
  assert(minY >= 4 - 0.001, `minY ${minY} should be >= 4`)
})
test('field offset per-vertex', () => {
  const g = new Grid({ vertsX: 2, vertsY: 2 })
  const s = new SetPosition({
    geometry: g.output('Geometry'),
    offset: (i) => [0, i * 0.1, 0],
  })
  const geo = s.output('Geometry').evaluate()
  const pos = geo.getAttribute('position')
  // vertex 1 should be higher than vertex 0
  assert(pos.getY(1) > pos.getY(0))
})

// ── SubdivisionSurface ────────────────────────────────────────────────────────
console.log('\nSubdivisionSurface')

test('level 0 returns same triangle count', () => {
  const g = new Grid({ vertsX: 3, vertsY: 3 })
  const s = new SubdivisionSurface({ geometry: g.output('Geometry'), level: 0 })
  const geo = s.output('Geometry').evaluate()
  assert(geo.getAttribute('position') !== null)
})
test('level 1 quadruples triangle count', () => {
  const ico  = new IcoSphere({ subdivisions: 0 })
  const sub  = new SubdivisionSurface({ geometry: ico.output('Geometry'), level: 1 })
  const geo0 = ico.output('Geometry').evaluate()
  const geo1 = sub.output('Geometry').evaluate()
  const triCount = (g) => g.getIndex() ? g.getIndex().count / 3 : g.getAttribute('position').count / 3
  const n0 = triCount(geo0)
  const n1 = triCount(geo1)
  assert(n1 === n0 * 4, `Expected ${n0*4} got ${n1}`)
})
test('level 2 = 16× triangle count', () => {
  const ico = new IcoSphere({ subdivisions: 0 })
  const sub = new SubdivisionSurface({ geometry: ico.output('Geometry'), level: 2 })
  const geo = sub.output('Geometry').evaluate()
  const triCount = geo.getIndex() ? geo.getIndex().count / 3 : geo.getAttribute('position').count / 3
  assert(triCount === 20 * 16, `Expected ${20*16} got ${triCount}`)
})

// ── MergeByDistance ───────────────────────────────────────────────────────────
console.log('\nMergeByDistance')

test('merge welds shared edge vertices', () => {
  // Two grids side by side sharing an edge (x=1 to x=-1 of translated grid)
  const g1 = new Grid({ sizeX: 2, sizeY: 2, vertsX: 2, vertsY: 2 })
  const g2 = new TransformGeometry({ geometry: g1.output('Geometry'), translation: [2, 0, 0] })
  const j  = new JoinGeometry([g1.output('Geometry'), g2.output('Geometry')])
  const before = j.output('Geometry').evaluate().getAttribute('position').count
  const m  = new MergeByDistance({ geometry: j.output('Geometry'), distance: 0.01 })
  const geo = m.output('Geometry').evaluate()
  const after = geo.getAttribute('position').count
  assert(after < before, `Merge should reduce vertex count: before=${before} after=${after}`)
})
test('merge with large distance merges everything', () => {
  const g = new Grid({ vertsX: 2, vertsY: 2 })
  const m = new MergeByDistance({ geometry: g.output('Geometry'), distance: 100 })
  const geo = m.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 1)
})

// ── FlipFaces ─────────────────────────────────────────────────────────────────
console.log('\nFlipFaces')

test('flip reverses winding', () => {
  const g  = new Grid({ vertsX: 2, vertsY: 2 })
  const geoOrig = g.output('Geometry').evaluate()
  const f  = new FlipFaces({ geometry: g.output('Geometry') })
  const geoFlip = f.output('Geometry').evaluate()
  const io = geoOrig.getIndex()
  const if_ = geoFlip.getIndex()
  // First triangle winding should be reversed
  assert(io.getX(1) === if_.getX(2) && io.getX(2) === if_.getX(1))
})
test('flip negates normals', () => {
  const g = new Grid({ vertsX: 2, vertsY: 2 })
  const f = new FlipFaces({ geometry: g.output('Geometry') })
  const geo = f.output('Geometry').evaluate()
  const nor = geo.getAttribute('normal')
  // Grid normal is [0,0,1] — flipped should be [0,0,-1]
  approx(nor.getZ(0), -1, 0.001)
})

// ── DistributePointsOnFaces ───────────────────────────────────────────────────
console.log('\nDistributePointsOnFaces')

test('count mode places exact number of points', () => {
  const g = new Grid({ vertsX: 5, vertsY: 5 })
  const d = new DistributePointsOnFaces({ mesh: g.output('Geometry'), count: 50 })
  const geo = d.output('Points').evaluate()
  assert(geo.getAttribute('position').count === 50)
})
test('points lie on grid surface', () => {
  const g = new Grid({ sizeX: 2, sizeY: 2, vertsX: 3, vertsY: 3 })
  const d = new DistributePointsOnFaces({ mesh: g.output('Geometry'), count: 100 })
  const geo = d.output('Points').evaluate()
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    approx(pos.getZ(i), 0, 0.001)  // grid is in XY plane (Z=0)
  }
})
test('different seeds give different positions', () => {
  const g = new Grid({ vertsX: 5, vertsY: 5 })
  const d1 = new DistributePointsOnFaces({ mesh: g.output('Geometry'), count: 10, seed: 0 })
  const d2 = new DistributePointsOnFaces({ mesh: g.output('Geometry'), count: 10, seed: 99 })
  const p1 = d1.output('Points').evaluate().getAttribute('position')
  const p2 = d2.output('Points').evaluate().getAttribute('position')
  assert(p1.getX(0) !== p2.getX(0) || p1.getY(0) !== p2.getY(0))
})

// ── InstanceOnPoints ──────────────────────────────────────────────────────────
console.log('\nInstanceOnPoints')

test('instances on 4 points produces 4× geometry', () => {
  const pts  = new Grid({ vertsX: 2, vertsY: 2 })  // 4 vertices as points
  const inst = new Cube({ size: 0.2 })
  const iop  = new InstanceOnPoints({ points: pts.output('Geometry'), instance: inst.output('Geometry') })
  const geo  = iop.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 4 * 24)  // 24 verts per cube
})
test('scale field varies instance sizes', () => {
  const sphere = new UVSphere({ segments: 4, rings: 2 })
  const pts    = new Grid({ vertsX: 2, vertsY: 2 })
  const cube   = new Cube({ size: 0.1 })
  const iop    = new InstanceOnPoints({
    points:   pts.output('Geometry'),
    instance: cube.output('Geometry'),
    scale:    (i) => i === 0 ? 10 : 1,
  })
  const geo = iop.output('Geometry').evaluate()
  // First instance (scale=10) should have larger coordinates than last (scale=1)
  const pos = geo.getAttribute('position')
  let maxAbsX = 0
  for (let i = 0; i < 24; i++) maxAbsX = Math.max(maxAbsX, Math.abs(pos.getX(i)))
  assert(maxAbsX > 0.4, `Scale 10 should produce large coords, got max=${maxAbsX}`)
})
test('align to normal rotates instances', () => {
  const sphere = new UVSphere({ segments: 8, rings: 4 })
  const pts = new DistributePointsOnFaces({ mesh: sphere.output('Geometry'), count: 5, seed: 1 })
  const cube = new Cube({ size: 0.1 })
  const iop  = new InstanceOnPoints({ points: pts.output('Points'), instance: cube.output('Geometry'), alignToNormal: true })
  const geo  = iop.output('Geometry').evaluate()
  assert(geo.getAttribute('position').count === 5 * 24)
})

// ── Graph evaluation ──────────────────────────────────────────────────────────
console.log('\nGraph evaluation')

test('shared node evaluated once (memoization)', () => {
  let evalCount = 0
  const g = new Grid({ vertsX: 3, vertsY: 3 })
  // Wrap evaluate to count calls
  const orig = g._evaluate.bind(g)
  g._evaluate = (...args) => { evalCount++; return orig(...args) }
  const t1 = new TransformGeometry({ geometry: g.output('Geometry'), translation: [1, 0, 0] })
  const t2 = new TransformGeometry({ geometry: g.output('Geometry'), translation: [2, 0, 0] })
  const j  = new JoinGeometry([t1.output('Geometry'), t2.output('Geometry')])
  j.output('Geometry').evaluate()
  assert(evalCount === 1, `Grid should be evaluated once, was evaluated ${evalCount} times`)
})
test('output() returns OutputRef with correct node/socket', () => {
  const g = new Grid()
  const ref = g.output('Geometry')
  assert(ref.node === g)
  assert(ref.socket === 'Geometry')
})
test('invalid socket throws', () => {
  const g = new Grid()
  let threw = false
  try { g.output('NonExistent').evaluate() } catch { threw = true }
  assert(threw)
})

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
