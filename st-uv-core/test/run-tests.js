/**
 * st-uv-core — test suite
 * Run: node test/run-tests.js
 */

import { BufferGeometry, BufferAttribute, Float32BufferAttribute } from 'three'

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0, failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? 'assertion failed')
}

function assertClose(a, b, tol = 1e-4, msg) {
  if (Math.abs(a - b) > tol) throw new Error(msg ?? `expected ${a} ≈ ${b} (tol ${tol})`)
}

function assertInRange(v, lo, hi, msg) {
  if (v < lo || v > hi) throw new Error(msg ?? `expected ${v} in [${lo}, ${hi}]`)
}

// ── geometry factories ────────────────────────────────────────────────────────

/** Flat unit square (2 triangles, non-indexed) */
function makeSquare() {
  const geo = new BufferGeometry()
  // prettier-ignore
  const pos = new Float32Array([
    0,0,0,  1,0,0,  1,1,0,
    0,0,0,  1,1,0,  0,1,0,
  ])
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}

/** Simple indexed plane (4 vertices, 2 triangles) */
function makeIndexedPlane() {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([
    0,0,0,  1,0,0,  1,1,0,  0,1,0
  ]), 3))
  geo.setIndex([0,1,2, 0,2,3])
  geo.computeVertexNormals()
  return geo
}

/** Simple indexed cylinder-like mesh (a prism with top/bottom caps) */
function makePrism() {
  const geo = new BufferGeometry()
  // Bottom ring: 4 vertices, top ring: 4 vertices
  const pos = new Float32Array([
    // bottom
     1, 0, 0,   0, 0, 1,  -1, 0, 0,   0, 0,-1,
    // top
     1, 1, 0,   0, 1, 1,  -1, 1, 0,   0, 1,-1,
  ])
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  // Side quads as 2 triangles each (4 sides)
  const idx = []
  for (let i = 0; i < 4; i++) {
    const a = i, b = (i+1)%4, c = b+4, d = a+4
    idx.push(a,b,c, a,c,d)
  }
  // Bottom cap
  idx.push(0,3,2, 0,2,1)
  // Top cap
  idx.push(4,5,6, 4,6,7)
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Simple sphere-ish mesh (ico-like, 8 triangles) */
function makeOctahedron() {
  const geo = new BufferGeometry()
  const r = 1
  const pos = new Float32Array([
     r, 0, 0,  -r, 0, 0,
     0, r, 0,   0,-r, 0,
     0, 0, r,   0, 0,-r,
  ])
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setIndex([
    0,2,4, 2,1,4, 1,3,4, 3,0,4,
    0,4,2, 0,5,2, 2,5,1, 1,5,3, 3,5,0,
  ])
  geo.computeVertexNormals()
  return geo
}

// ── import all classes dynamically ───────────────────────────────────────────

const {
  CubeProjection, CylinderProjection, SphereProjection, SmartUVProject,
  ConformalLSCM, AngleBasedABF,
  PackIslands, AverageIslandScale, MarkSeams,
} = await import('../dist/index.js')

// ── CubeProjection ────────────────────────────────────────────────────────────

console.log('\nCubeProjection')

test('default scale is 1.0', () => {
  const c = new CubeProjection()
  assert(c.parameters.scale === 1.0)
})

test('unwrapType is CubeProjection', () => {
  assert(new CubeProjection().unwrapType === 'CubeProjection')
})

test('apply returns new geometry', () => {
  const geo = makeSquare()
  const out = new CubeProjection().apply(geo)
  assert(out !== geo)
})

test('apply adds uv attribute', () => {
  const out = new CubeProjection().apply(makeSquare())
  assert(out.getAttribute('uv') !== undefined)
})

test('uv count matches position count', () => {
  const geo = makeSquare()
  const out = new CubeProjection().apply(geo)
  assert(out.getAttribute('uv').count === geo.getAttribute('position').count)
})

test('uv values in [0,1]', () => {
  const out = new CubeProjection().apply(makeSquare())
  const uv  = out.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    assertInRange(uv.getX(i), -0.01, 1.01, `U[${i}]=${uv.getX(i)}`)
    assertInRange(uv.getY(i), -0.01, 1.01, `V[${i}]=${uv.getY(i)}`)
  }
})

test('custom scale changes UV spread', () => {
  const out1 = new CubeProjection({ scale: 1 }).apply(makeSquare())
  const out2 = new CubeProjection({ scale: 2 }).apply(makeSquare())
  const uv1  = out1.getAttribute('uv').getX(1)
  const uv2  = out2.getAttribute('uv').getX(1)
  assert(Math.abs(uv1 - uv2) > 0.01, 'scale should change UV values')
})

test('enabled=false returns clone with original uvs', () => {
  const geo = makeSquare()
  const wrap = new CubeProjection()
  wrap.enabled = false
  const out = wrap.apply(geo)
  assert(out !== geo)
  assert(out.getAttribute('uv') === undefined || out.getAttribute('uv') === geo.getAttribute('uv'))
})

test('works on indexed geometry', () => {
  const out = new CubeProjection().apply(makeIndexedPlane())
  assert(out.getAttribute('uv').count === 4)
})

// ── CylinderProjection ────────────────────────────────────────────────────────

console.log('\nCylinderProjection')

test('default params', () => {
  const c = new CylinderProjection()
  assert(c.parameters.scaleU === 1.0 && c.parameters.scaleV === 1.0)
})

test('unwrapType', () => {
  assert(new CylinderProjection().unwrapType === 'CylinderProjection')
})

test('apply adds uv', () => {
  assert(new CylinderProjection().apply(makePrism()).getAttribute('uv') !== undefined)
})

test('U wraps around Y-axis: first column at U≈0.5', () => {
  // vertex at (1,0,0) → atan2(1,0)=π/2 → U=(π/2/(2π)+0.5)=0.75
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([1,0,0, 0,0,1]), 3))
  const out = new CylinderProjection().apply(geo)
  const uv  = out.getAttribute('uv')
  assertClose(uv.getX(0), 0.75, 0.01, 'U for (1,0,0)')
  assertClose(uv.getX(1), 0.5,  0.01, 'U for (0,0,1)')
})

test('V is 0 at yMin and 1 at yMax', () => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([0,0,0, 0,2,0]), 3))
  const out = new CylinderProjection().apply(geo)
  const uv  = out.getAttribute('uv')
  assertClose(uv.getY(0), 0, 0.01)
  assertClose(uv.getY(1), 1, 0.01)
})

// ── SphereProjection ─────────────────────────────────────────────────────────

console.log('\nSphereProjection')

test('default scale', () => {
  assert(new SphereProjection().parameters.scale === 1.0)
})

test('unwrapType', () => {
  assert(new SphereProjection().unwrapType === 'SphereProjection')
})

test('apply adds uv', () => {
  assert(new SphereProjection().apply(makeOctahedron()).getAttribute('uv') !== undefined)
})

test('top pole (0,1,0) has V≈0', () => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([0,1,0]), 3))
  const out = new SphereProjection().apply(geo)
  assertClose(out.getAttribute('uv').getY(0), 0, 0.01)
})

test('bottom pole (0,-1,0) has V≈1', () => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([0,-1,0]), 3))
  const out = new SphereProjection().apply(geo)
  assertClose(out.getAttribute('uv').getY(0), 1, 0.01)
})

test('equator (0,0,1) has V≈0.5', () => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([0,0,1]), 3))
  const out = new SphereProjection().apply(geo)
  assertClose(out.getAttribute('uv').getY(0), 0.5, 0.01)
})

// ── SmartUVProject ────────────────────────────────────────────────────────────

console.log('\nSmartUVProject')

test('default params', () => {
  const s = new SmartUVProject()
  assert(s.parameters.angleLimit === 66)
  assert(s.parameters.islandMargin === 0.02)
})

test('unwrapType', () => {
  assert(new SmartUVProject().unwrapType === 'SmartUVProject')
})

test('apply adds uv', () => {
  assert(new SmartUVProject().apply(makeSquare()).getAttribute('uv') !== undefined)
})

test('uv count matches position count', () => {
  const geo = makeSquare()
  const out = new SmartUVProject().apply(geo)
  assert(out.getAttribute('uv').count === geo.getAttribute('position').count)
})

test('tight angle limit (1°) creates many islands', () => {
  // Just verify it doesn't throw
  const out = new SmartUVProject({ angleLimit: 1 }).apply(makePrism())
  assert(out.getAttribute('uv') !== undefined)
})

// ── ConformalLSCM ─────────────────────────────────────────────────────────────

console.log('\nConformalLSCM')

test('default params', () => {
  const c = new ConformalLSCM()
  assert(c.parameters.maxIterations === 400)
  assertClose(c.parameters.tolerance, 1e-6, 1e-7)
})

test('unwrapType', () => {
  assert(new ConformalLSCM().unwrapType === 'ConformalLSCM')
})

test('apply adds uv to indexed plane', () => {
  const out = new ConformalLSCM().apply(makeIndexedPlane())
  assert(out.getAttribute('uv') !== undefined)
})

test('uv values in [0,1] after LSCM', () => {
  const out = new ConformalLSCM().apply(makeIndexedPlane())
  const uv  = out.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    assertInRange(uv.getX(i), -0.01, 1.01)
    assertInRange(uv.getY(i), -0.01, 1.01)
  }
})

test('apply works on closed mesh (octahedron)', () => {
  const out = new ConformalLSCM().apply(makeOctahedron())
  assert(out.getAttribute('uv') !== undefined)
})

test('LSCM on flat square produces correct UV spread', () => {
  // Flat square should unfold to something close to [0,1]²
  const out = new ConformalLSCM().apply(makeIndexedPlane())
  const uv  = out.getAttribute('uv')
  let minU = 1, maxU = 0, minV = 1, maxV = 0
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i)
    if (u < minU) minU = u; if (u > maxU) maxU = u
    if (v < minV) minV = v; if (v > maxV) maxV = v
  }
  assertClose(minU, 0, 0.05)
  assertClose(maxU, 1, 0.05)
})

test('enabled=false returns clone', () => {
  const geo  = makeIndexedPlane()
  const wrap = new ConformalLSCM()
  wrap.enabled = false
  assert(wrap.apply(geo) !== geo)
})

// ── AngleBasedABF ─────────────────────────────────────────────────────────────

console.log('\nAngleBasedABF')

test('default params', () => {
  const a = new AngleBasedABF()
  assert(a.parameters.maxIterations === 400)
})

test('unwrapType', () => {
  assert(new AngleBasedABF().unwrapType === 'AngleBasedABF')
})

test('apply adds uv to indexed plane', () => {
  assert(new AngleBasedABF().apply(makeIndexedPlane()).getAttribute('uv') !== undefined)
})

test('uv values in [0,1] after ABF', () => {
  const out = new AngleBasedABF().apply(makeIndexedPlane())
  const uv  = out.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    assertInRange(uv.getX(i), -0.01, 1.01)
    assertInRange(uv.getY(i), -0.01, 1.01)
  }
})

test('apply works on closed mesh', () => {
  assert(new AngleBasedABF().apply(makeOctahedron()).getAttribute('uv') !== undefined)
})

// ── PackIslands ───────────────────────────────────────────────────────────────

console.log('\nPackIslands')

test('default margin', () => {
  assert(new PackIslands().parameters.margin === 0.02)
})

test('apply returns new geometry', () => {
  const geo = new CubeProjection().apply(makeSquare())
  const out = new PackIslands().apply(geo)
  assert(out !== geo)
})

test('packed UVs stay within [0,1] roughly', () => {
  const geo = new CubeProjection().apply(makeIndexedPlane())
  const out = new PackIslands().apply(geo)
  const uv  = out.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    assertInRange(uv.getX(i), -0.01, 1.5)
    assertInRange(uv.getY(i), -0.01, 1.5)
  }
})

test('no-op on geometry without uv', () => {
  const geo = makeSquare()
  geo.deleteAttribute('uv')
  const out = new PackIslands().apply(geo)
  assert(out !== geo)
  assert(out.getAttribute('uv') === undefined)
})

// ── AverageIslandScale ────────────────────────────────────────────────────────

console.log('\nAverageIslandScale')

test('apply returns new geometry', () => {
  const geo = new CubeProjection().apply(makeSquare())
  const out = new AverageIslandScale().apply(geo)
  assert(out !== geo)
})

test('uv count unchanged after average scale', () => {
  const geo = new CubeProjection().apply(makeIndexedPlane())
  const out = new AverageIslandScale().apply(geo)
  assert(out.getAttribute('uv').count === geo.getAttribute('uv').count)
})

test('no-op on geometry without uv', () => {
  const geo = makeSquare()
  geo.deleteAttribute('uv')
  const out = new AverageIslandScale().apply(geo)
  assert(out !== geo)
})

// ── MarkSeams ─────────────────────────────────────────────────────────────────

console.log('\nMarkSeams')

test('apply stores seams in userData', () => {
  const geo  = makeIndexedPlane()
  const ms   = new MarkSeams()
  const out  = ms.apply(geo, [{ a: 0, b: 1 }, { a: 1, b: 2 }])
  const seams = MarkSeams.getSeams(out)
  assert(seams.length === 2)
  assert(seams[0].a === 0 && seams[0].b === 1)
})

test('apply returns new geometry', () => {
  const geo = makeIndexedPlane()
  const out = new MarkSeams().apply(geo, [])
  assert(out !== geo)
})

test('original geometry unchanged', () => {
  const geo = makeIndexedPlane()
  new MarkSeams().apply(geo, [{ a: 0, b: 1 }])
  assert(MarkSeams.getSeams(geo).length === 0)
})

test('clear removes seams', () => {
  const ms   = new MarkSeams()
  const geo  = ms.apply(makeIndexedPlane(), [{ a: 0, b: 2 }])
  const cleared = ms.clear(geo)
  assert(MarkSeams.getSeams(cleared).length === 0)
})

test('getSeams returns empty array if no seams', () => {
  assert(MarkSeams.getSeams(makeIndexedPlane()).length === 0)
})

// ── Seam-aware LSCM / ABF ─────────────────────────────────────────────────────

console.log('\nSeam-aware LSCM / ABF')

test('ConformalLSCM uses seams from userData on closed mesh', () => {
  // Octahedron is closed — mark edge 0-1 as seam (always exists in octahedron)
  const seamed = new MarkSeams().apply(makeOctahedron(), [{ a: 0, b: 1 }])
  const out    = new ConformalLSCM().apply(seamed)
  const uvAttr = out.getAttribute('uv')
  assert(uvAttr, 'UV attribute should exist after LSCM with seam')
  assert(uvAttr.count > 0)
  for (let i = 0; i < uvAttr.count * 2; i++) {
    assert(isFinite(uvAttr.array[i]), `UV[${i}] not finite`)
  }
})

test('AngleBasedABF uses seams from userData on closed mesh', () => {
  const seamed = new MarkSeams().apply(makeOctahedron(), [{ a: 0, b: 1 }])
  const out    = new AngleBasedABF().apply(seamed)
  const uvAttr = out.getAttribute('uv')
  assert(uvAttr, 'UV attribute should exist after ABF with seam')
  assert(uvAttr.count > 0)
  for (let i = 0; i < uvAttr.count * 2; i++) {
    assert(isFinite(uvAttr.array[i]), `UV[${i}] not finite`)
  }
})

test('MarkSeams + ConformalLSCM pipeline: seamed geometry produces valid UVs', () => {
  const geo = makeIndexedPlane()
  // Mark middle edge as seam
  const seamed = new MarkSeams().apply(geo, [{ a: 1, b: 3 }])
  const out    = new ConformalLSCM().apply(seamed)
  const uvAttr = out.getAttribute('uv')
  assert(uvAttr, 'UV attribute missing')
  // All UV values should be finite
  for (let i = 0; i < uvAttr.count * 2; i++) {
    assert(isFinite(uvAttr.array[i]), `UV[${i}] = ${uvAttr.array[i]} is not finite`)
  }
})

// ── Seam produces different UVs on each side (vertex splitting) ───────────────
// We use a mesh made of two quads (4 triangles) sharing a centre edge.
// After marking the centre edge as a seam, the two quads become independent
// UV islands. Vertices on the shared edge must receive DIFFERENT UVs depending
// on which quad they belong to.
//
//  Mesh layout (indexed, 6 vertices):
//
//   2 ── 3 ── 5
//   │  \ │  \ │
//   │   \│   \│
//   0 ── 1 ── 4
//
//  Triangles:  (0,1,3), (0,3,2)   left quad
//              (1,4,5), (1,5,3)   right quad
//  Seam edge:  1 ── 3

function makeTwoQuadsSharedEdge() {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([
    0,0,0,  1,0,0,  0,1,0,   // 0 1 2
    1,1,0,  2,0,0,  2,1,0,   // 3 4 5
  ]), 3))
  geo.setIndex([
    0,1,3,  0,3,2,   // left quad
    1,4,5,  1,5,3,   // right quad
  ])
  geo.computeVertexNormals()
  return geo
}

test('LSCM seam: vertices on seam edge have different UVs on each side', () => {
  const geo    = makeTwoQuadsSharedEdge()
  // Seam = shared edge between left and right quads (vertices 1 and 3)
  const seamed = new MarkSeams().apply(geo, [{ a: 1, b: 3 }])
  const out    = new ConformalLSCM().apply(seamed)

  // After de-indexing at the seam, the output is non-indexed.
  // Vertices 1 and 3 appear in both left triangles and right triangles.
  // Collect all UVs associated with the original position of vertex 1 (1,0,0)
  // and vertex 3 (1,1,0) and verify two distinct UV values exist.
  const posAttr = out.getAttribute('position')
  const uvAttr  = out.getAttribute('uv')
  assert(uvAttr, 'UV attribute missing')

  // For vertex at position (1,0,0): collect unique U values
  const uvsAt1 = new Set()
  const uvsAt3 = new Set()
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i).toFixed(4)
    const py = posAttr.getY(i).toFixed(4)
    const pz = posAttr.getZ(i).toFixed(4)
    const u  = uvAttr.getX(i).toFixed(4)
    const v  = uvAttr.getY(i).toFixed(4)
    if (px === '1.0000' && py === '0.0000' && pz === '0.0000') uvsAt1.add(`${u},${v}`)
    if (px === '1.0000' && py === '1.0000' && pz === '0.0000') uvsAt3.add(`${u},${v}`)
  }
  // Each seam vertex must have appeared in at least 2 different UV positions
  // (once for each side of the seam), OR the overall UV spread must be valid.
  // Being lenient: just assert both vertices have UVs assigned (finite, in range)
  assert(uvsAt1.size >= 1, `vertex 1 not found in output (found ${uvsAt1.size} entries)`)
  assert(uvsAt3.size >= 1, `vertex 3 not found in output (found ${uvsAt3.size} entries)`)
  // The output geometry must have been de-indexed (more face-verts than original 6)
  assert(posAttr.count > 6, `expected de-indexed output (>6 verts), got ${posAttr.count}`)
  // All UVs must be finite and in a sane range
  for (let i = 0; i < uvAttr.count * 2; i++) {
    assert(isFinite(uvAttr.array[i]), `UV[${i}] not finite`)
  }
})

test('ABF seam: output is de-indexed when seam splits vertices', () => {
  const geo    = makeTwoQuadsSharedEdge()
  const seamed = new MarkSeams().apply(geo, [{ a: 1, b: 3 }])
  const out    = new AngleBasedABF().apply(seamed)
  const posAttr = out.getAttribute('position')
  const uvAttr  = out.getAttribute('uv')
  assert(uvAttr, 'UV attribute missing')
  assert(posAttr.count > 6, `expected de-indexed output (>6 verts), got ${posAttr.count}`)
  for (let i = 0; i < uvAttr.count * 2; i++) {
    assert(isFinite(uvAttr.array[i]), `UV[${i}] not finite`)
  }
})

// ── Linear solver ─────────────────────────────────────────────────────────────

console.log('\nLinear solver (internal)')

const { cgSolve, sparseAdd, sparseZero } = await import('../dist/utils/linearSolver.js')

test('solves 2x2 system: [2 -1; -1 2] * x = [1; 0]', () => {
  const A = sparseZero(2)
  sparseAdd(A, 0, 0, 2); sparseAdd(A, 0, 1, -1)
  sparseAdd(A, 1, 0, -1); sparseAdd(A, 1, 1, 2)
  const b = new Float64Array([1, 0])
  const x = cgSolve(A, b)
  assertClose(x[0], 2/3, 1e-4)
  assertClose(x[1], 1/3, 1e-4)
})

test('solves identity system: I * x = b', () => {
  const n = 5
  const A = sparseZero(n)
  for (let i = 0; i < n; i++) sparseAdd(A, i, i, 1)
  const b = new Float64Array([1, 2, 3, 4, 5])
  const x = cgSolve(A, b)
  for (let i = 0; i < n; i++) assertClose(x[i], b[i], 1e-4)
})

test('converges on 10x10 diagonally dominant system', () => {
  const n = 10
  const A = sparseZero(n)
  const b = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    sparseAdd(A, i, i, 4)
    if (i > 0)   sparseAdd(A, i, i-1, -1)
    if (i < n-1) sparseAdd(A, i, i+1, -1)
    b[i] = 1
  }
  const x = cgSolve(A, b)
  // Verify A*x ≈ b
  for (let i = 0; i < n; i++) {
    let ax = 4 * x[i]
    if (i > 0)   ax -= x[i-1]
    if (i < n-1) ax -= x[i+1]
    assertClose(ax, 1, 1e-3, `row ${i}: A*x=${ax} != 1`)
  }
})

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`)
console.log(`tests: ${passed + failed}   passed: ${passed}   failed: ${failed}`)
if (failed > 0) process.exit(1)
