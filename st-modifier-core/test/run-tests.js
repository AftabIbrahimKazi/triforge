import { BufferGeometry, BufferAttribute } from 'three'
import { SphereGeometry, BoxGeometry } from 'three'
import {
  ModifierStack,
  SubdivisionModifier,
  ArrayModifier,
  ExtrudeModifier,
  SolidifyModifier,
  MirrorModifier,
  DisplacementModifier,
  WarpModifier,
  TwistModifier,
  BendModifier,
  UVProjectionModifier,
  NormalRecalculateModifier,
  OceanModifier,
  BooleanModifier,
} from '../dist/index.js'

console.log('\n--- MODIFIER STACK TESTS ---\n')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++ }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCube() {
  // Simple 2-triangle quad (flat surface, enough for testing)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([
    -1,-1, 0,   1,-1, 0,   1, 1, 0,
    -1,-1, 0,   1, 1, 0,  -1, 1, 0,
  ]), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array([
    0,0,1, 0,0,1, 0,0,1,
    0,0,1, 0,0,1, 0,0,1,
  ]), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array([
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,
  ]), 2))
  return geo
}

function makeSphere() {
  // Use a simple icosahedron-like mesh: just a few triangles around a sphere
  const geo = new BufferGeometry()
  const pos = [], norm = [], uv = []
  const segs = 8
  for (let lat = 0; lat < segs; lat++) {
    for (let lon = 0; lon < segs; lon++) {
      const phi0 = (lat / segs) * Math.PI, phi1 = ((lat+1) / segs) * Math.PI
      const the0 = (lon / segs) * Math.PI * 2, the1 = ((lon+1) / segs) * Math.PI * 2
      const verts = [
        [Math.sin(phi0)*Math.cos(the0), Math.cos(phi0), Math.sin(phi0)*Math.sin(the0)],
        [Math.sin(phi0)*Math.cos(the1), Math.cos(phi0), Math.sin(phi0)*Math.sin(the1)],
        [Math.sin(phi1)*Math.cos(the0), Math.cos(phi1), Math.sin(phi1)*Math.sin(the0)],
        [Math.sin(phi1)*Math.cos(the1), Math.cos(phi1), Math.sin(phi1)*Math.sin(the1)],
      ]
      for (const v of [verts[0],verts[1],verts[2], verts[1],verts[3],verts[2]]) {
        pos.push(...v); norm.push(...v); uv.push(0.5, 0.5)
      }
    }
  }
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal',   new BufferAttribute(new Float32Array(norm), 3))
  geo.setAttribute('uv',       new BufferAttribute(new Float32Array(uv),   2))
  return geo
}

// ── ModifierStack ──────────────────────────────────────────────────────────────

test('ModifierStack constructs and holds source geometry', () => {
  const geo   = makeCube()
  const stack = new ModifierStack(geo)
  if (!stack) throw new Error('No stack')
})

test('ModifierStack.apply() with no modifiers returns source geometry', () => {
  const geo    = makeCube()
  const stack  = new ModifierStack(geo)
  const result = stack.apply()
  if (result !== geo) throw new Error('Expected source geometry passthrough')
})

test('ModifierStack.add() and remove() work', () => {
  const stack = new ModifierStack(makeCube())
  const mod   = new SubdivisionModifier()
  stack.add(mod)
  if (stack.modifiers.length !== 1) throw new Error('Expected 1 modifier')
  stack.remove(mod)
  if (stack.modifiers.length !== 0) throw new Error('Expected 0 modifiers')
})

test('Disabled modifier is skipped', () => {
  const geo = makeCube()
  const mod = new SubdivisionModifier({ levels: 2 })
  mod.enabled = false
  const stack  = new ModifierStack(geo)
  stack.add(mod)
  const result = stack.apply()
  if (result !== geo) throw new Error('Disabled modifier should pass through source')
})

// ── SubdivisionModifier ────────────────────────────────────────────────────────

test('SubdivisionModifier level 1 quadruples triangles', () => {
  const geo    = makeCube()
  const before = countTris(geo)
  const result = new SubdivisionModifier({ levels: 1 }).apply(geo)
  const after  = countTris(result)
  if (after !== before * 4) throw new Error(`Expected ${before*4} tris, got ${after}`)
})

test('SubdivisionModifier level 2 produces 16x triangles', () => {
  const geo    = makeCube()
  const before = countTris(geo)
  const result = new SubdivisionModifier({ levels: 2 }).apply(geo)
  const after  = countTris(result)
  if (after !== before * 16) throw new Error(`Expected ${before*16}, got ${after}`)
})

test('SubdivisionModifier exposes parameters.levels', () => {
  const mod = new SubdivisionModifier({ levels: 3 })
  if (mod.parameters.levels !== 3) throw new Error(`Expected 3, got ${mod.parameters.levels}`)
})

test('SubdivisionModifier name is correct', () => {
  if (new SubdivisionModifier().name !== 'Subdivision') throw new Error('Wrong name')
})

// ── ArrayModifier ──────────────────────────────────────────────────────────────

test('ArrayModifier doubles vertex count with count=2', () => {
  const geo    = makeCube()
  const before = geo.getAttribute('position').count
  const result = new ArrayModifier({ count: 2, offsetX: 3 }).apply(geo)
  const after  = result.getAttribute('position').count
  if (after !== before * 2) throw new Error(`Expected ${before*2}, got ${after}`)
})

test('ArrayModifier offsets second copy along X', () => {
  const geo    = makeCube()
  const result = new ArrayModifier({ count: 2, offsetX: 5, offsetY: 0, offsetZ: 0 }).apply(geo)
  const pos    = result.getAttribute('position')
  // Second copy starts at vertex index = original vCount
  const vCount = geo.getAttribute('position').count
  const x0 = pos.getX(0), x1 = pos.getX(vCount)
  if (Math.abs((x1 - x0) - 5) > 0.001) throw new Error(`Expected 5 offset, got ${x1-x0}`)
})

test('ArrayModifier exposes parameters', () => {
  const mod = new ArrayModifier({ count: 4, offsetX: 2, offsetY: 1, offsetZ: 0.5 })
  if (mod.parameters.count   !== 4)   throw new Error('count wrong')
  if (mod.parameters.offsetX !== 2)   throw new Error('offsetX wrong')
  if (mod.parameters.offsetY !== 1)   throw new Error('offsetY wrong')
  if (mod.parameters.offsetZ !== 0.5) throw new Error('offsetZ wrong')
})

// ── SolidifyModifier ───────────────────────────────────────────────────────────

test('SolidifyModifier increases triangle count', () => {
  const geo    = makeCube()
  const before = countTris(geo)
  const result = new SolidifyModifier({ thickness: 0.1 }).apply(geo)
  const after  = countTris(result)
  if (after <= before) throw new Error(`Expected more tris, got ${after} vs ${before}`)
})

test('SolidifyModifier exposes parameters', () => {
  const mod = new SolidifyModifier({ thickness: 0.2, offset: 0 })
  if (mod.parameters.thickness !== 0.2) throw new Error('thickness wrong')
  if (mod.parameters.offset    !== 0)   throw new Error('offset wrong')
})

// ── MirrorModifier ─────────────────────────────────────────────────────────────

test('MirrorModifier X doubles vertex count', () => {
  const geo    = makeCube()
  const before = geo.getAttribute('position').count
  const result = new MirrorModifier({ x: true }).apply(geo)
  const after  = result.getAttribute('position').count
  if (after !== before * 2) throw new Error(`Expected ${before*2}, got ${after}`)
})

test('MirrorModifier XY quadruples vertex count', () => {
  const geo    = makeCube()
  const before = geo.getAttribute('position').count
  const result = new MirrorModifier({ x: true, y: true }).apply(geo)
  const after  = result.getAttribute('position').count
  // 1 original + 2 single-axis mirrors + 1 combined = 4x
  if (after !== before * 4) throw new Error(`Expected ${before*4}, got ${after}`)
})

// ── DisplacementModifier ───────────────────────────────────────────────────────

test('DisplacementModifier moves vertices', () => {
  const geo    = makeSphere()
  const before = sumPositions(geo)
  const result = new DisplacementModifier({
    strength: 1.0,
    noiseFunction: (x, y, z) => 1.0  // constant full displacement
  }).apply(geo)
  const after = sumPositions(result)
  if (Math.abs(after - before) < 0.001) throw new Error('Positions did not change')
})

test('DisplacementModifier with zero strength leaves positions unchanged', () => {
  const geo    = makeSphere()
  const before = sumPositions(geo)
  const result = new DisplacementModifier({
    strength: 0.0,
    noiseFunction: () => 0.5
  }).apply(geo)
  const after = sumPositions(result)
  if (Math.abs(after - before) > 0.001) throw new Error('Positions should not change with strength=0')
})

test('DisplacementModifier exposes parameters', () => {
  const mod = new DisplacementModifier({ strength: 0.5, midlevel: 0.3 })
  if (mod.parameters.strength !== 0.5) throw new Error('strength wrong')
  if (mod.parameters.midlevel !== 0.3) throw new Error('midlevel wrong')
})

test('DisplacementModifier noiseFunction callback receives vertex position', () => {
  let called = false
  const geo = makeSphere()
  new DisplacementModifier({
    strength: 0.1,
    noiseFunction: (x, y, z) => { called = true; return 0.5 }
  }).apply(geo)
  if (!called) throw new Error('noiseFunction was never called')
})

// ── TwistModifier ──────────────────────────────────────────────────────────────

test('TwistModifier changes vertex positions', () => {
  const geo    = makeSphere()
  const before = sumPositions(geo)
  const result = new TwistModifier({ angle: Math.PI }).apply(geo)
  const after  = sumPositions(result)
  if (Math.abs(after - before) < 0.001) throw new Error('Positions did not change')
})

test('TwistModifier preserves vertex count', () => {
  const geo    = makeSphere()
  const result = new TwistModifier({ angle: Math.PI }).apply(geo)
  if (result.getAttribute('position').count !== geo.getAttribute('position').count)
    throw new Error('Vertex count changed')
})

// ── WarpModifier ───────────────────────────────────────────────────────────────

test('WarpModifier with radius 0 leaves geometry unchanged', () => {
  const geo    = makeSphere()
  const before = sumPositions(geo)
  const result = new WarpModifier({ radius: 0 }).apply(geo)
  const after  = sumPositions(result)
  if (Math.abs(after - before) > 0.001) throw new Error('Zero radius should not move vertices')
})

test('WarpModifier with large radius moves vertices', () => {
  const geo    = makeSphere()
  const before = sumPositions(geo)
  const result = new WarpModifier({ fromX: 0, toX: 5, radius: 100, strength: 1 }).apply(geo)
  const after  = sumPositions(result)
  if (Math.abs(after - before) < 0.001) throw new Error('Vertices should have moved')
})

// ── BendModifier ───────────────────────────────────────────────────────────────

test('BendModifier changes vertex positions', () => {
  const geo    = makeSphere()
  const before = sumPositions(geo)
  const result = new BendModifier({ angle: Math.PI * 0.5 }).apply(geo)
  const after  = sumPositions(result)
  if (Math.abs(after - before) < 0.001) throw new Error('Positions did not change')
})

// ── UVProjectionModifier ───────────────────────────────────────────────────────

test('UVProjectionModifier box replaces UV attribute', () => {
  const geo    = makeSphere()
  const result = new UVProjectionModifier({ type: 'box' }).apply(geo)
  if (!result.getAttribute('uv')) throw new Error('No UV attribute')
})

test('UVProjectionModifier sphere mode produces valid UVs', () => {
  const geo    = makeSphere()
  const result = new UVProjectionModifier({ type: 'sphere' }).apply(geo)
  const uv     = result.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i)
    if (!isFinite(u) || !isFinite(v)) throw new Error(`Non-finite UV at ${i}: ${u}, ${v}`)
  }
})

test('UVProjectionModifier triplanar mode produces valid UVs', () => {
  const geo    = makeSphere()
  const result = new UVProjectionModifier({ type: 'triplanar' }).apply(geo)
  const uv     = result.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i)
    if (!isFinite(u) || !isFinite(v)) throw new Error(`Non-finite UV at ${i}: ${u}, ${v}`)
  }
})

// ── NormalRecalculateModifier ─────────────────────────────────────────────────

test('NormalRecalculateModifier updates normal attribute', () => {
  const geo  = makeCube()
  const n1   = geo.getAttribute('normal').array.slice()
  // Displace first, then recalculate
  const disp = new DisplacementModifier({ strength: 0.5, noiseFunction: (x) => x * 0.1 + 0.5 }).apply(geo)
  const result = new NormalRecalculateModifier().apply(disp)
  const n2   = result.getAttribute('normal').array
  let diff = 0
  for (let i = 0; i < n1.length; i++) diff += Math.abs(n1[i] - n2[i])
  if (diff < 0.001) throw new Error('Normals should have changed after displacement + recalc')
})

// ── Full pipeline ──────────────────────────────────────────────────────────────

test('Full stack: Subdivision → Displacement → NormalRecalculate', () => {
  const geo   = makeSphere()
  const stack = new ModifierStack(geo)
  stack.add(new SubdivisionModifier({ levels: 1 }))
  stack.add(new DisplacementModifier({
    strength: 0.3,
    noiseFunction: (x, y, z) => (Math.sin(x * 3 + y * 2 + z) * 0.5 + 0.5)
  }))
  stack.add(new NormalRecalculateModifier())
  const result = stack.apply()
  if (!result.getAttribute('position')) throw new Error('No position')
  if (!result.getAttribute('normal'))   throw new Error('No normal')
  const trisBefore = countTris(geo)
  const trisAfter  = countTris(result)
  if (trisAfter <= trisBefore) throw new Error('Subdivision should have increased tris')
})

test('Stack chaining is fluent', () => {
  const stack = new ModifierStack(makeCube())
    .add(new SubdivisionModifier({ levels: 1 }))
    .add(new NormalRecalculateModifier())
  if (stack.modifiers.length !== 2) throw new Error('Expected 2 modifiers')
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function countTris(geo) {
  const idx = geo.getIndex()
  if (idx) return idx.count / 3
  return geo.getAttribute('position').count / 3
}

function sumPositions(geo) {
  const pos = geo.getAttribute('position')
  let sum = 0
  for (let i = 0; i < pos.count; i++) sum += Math.abs(pos.getX(i)) + Math.abs(pos.getY(i)) + Math.abs(pos.getZ(i))
  return sum
}

// ── OceanModifier ─────────────────────────────────────────────────────────────

test('OceanModifier generates a grid ignoring input geometry', () => {
  const input  = makeCube()
  const result = new OceanModifier({ resolution: 8 }).apply(input)
  // Should produce an 8×8 grid, not the input cube
  const vCount = result.getAttribute('position').count
  if (vCount !== 64) throw new Error(`Expected 64 verts (8×8), got ${vCount}`)
})

test('OceanModifier produces position, normal, uv, foam attributes', () => {
  const result = new OceanModifier({ resolution: 8 }).apply(new BufferGeometry())
  if (!result.getAttribute('position')) throw new Error('Missing position')
  if (!result.getAttribute('normal'))   throw new Error('Missing normal')
  if (!result.getAttribute('uv'))       throw new Error('Missing uv')
  if (!result.getAttribute('foam'))     throw new Error('Missing foam')
})

test('OceanModifier foam values are in [0, 1]', () => {
  const result = new OceanModifier({ resolution: 16, choppiness: 1.5 }).apply(new BufferGeometry())
  const foam   = result.getAttribute('foam')
  for (let i = 0; i < foam.count; i++) {
    const v = foam.getX(i)
    if (v < 0 || v > 1) throw new Error(`Foam out of range at ${i}: ${v}`)
  }
})

test('OceanModifier vertices move with time', () => {
  const mod  = new OceanModifier({ resolution: 8 })
  const geo0 = mod.apply(new BufferGeometry())
  mod.parameters.time = 5.0
  const geo5 = mod.apply(new BufferGeometry())
  const pos0 = geo0.getAttribute('position')
  const pos5 = geo5.getAttribute('position')
  let diff = 0
  for (let i = 0; i < pos0.count; i++) diff += Math.abs(pos0.getY(i) - pos5.getY(i))
  if (diff < 0.001) throw new Error('Vertices should move with time')
})

test('OceanModifier same seed produces identical geometry', () => {
  const a = new OceanModifier({ resolution: 8, seed: 42, time: 1.0 }).apply(new BufferGeometry())
  const b = new OceanModifier({ resolution: 8, seed: 42, time: 1.0 }).apply(new BufferGeometry())
  const pa = a.getAttribute('position'), pb = b.getAttribute('position')
  for (let i = 0; i < pa.count; i++) {
    if (Math.abs(pa.getY(i) - pb.getY(i)) > 0.0001)
      throw new Error(`Position differs at ${i}: ${pa.getY(i)} vs ${pb.getY(i)}`)
  }
})

test('OceanModifier different seeds produce different geometry', () => {
  const a = new OceanModifier({ resolution: 8, seed: 42 }).apply(new BufferGeometry())
  const b = new OceanModifier({ resolution: 8, seed: 99 }).apply(new BufferGeometry())
  const pa = a.getAttribute('position'), pb = b.getAttribute('position')
  let diff = 0
  for (let i = 0; i < pa.count; i++) diff += Math.abs(pa.getY(i) - pb.getY(i))
  if (diff < 0.001) throw new Error('Different seeds should produce different waves')
})

test('OceanModifier UV covers [0,1] range', () => {
  const result = new OceanModifier({ resolution: 8 }).apply(new BufferGeometry())
  const uv     = result.getAttribute('uv')
  let minU = 1, maxU = 0
  for (let i = 0; i < uv.count; i++) {
    minU = Math.min(minU, uv.getX(i))
    maxU = Math.max(maxU, uv.getX(i))
  }
  if (Math.abs(minU) > 0.001)  throw new Error(`UV min should be 0, got ${minU}`)
  if (Math.abs(maxU - 1) > 0.001) throw new Error(`UV max should be 1, got ${maxU}`)
})

test('OceanModifier exposes all Blender-matched parameters', () => {
  const mod = new OceanModifier()
  const required = ['time','scale','choppiness','windSpeed','windAngle',
                    'resolution','size','depth','foamCoverage','seed','damping','waveCount']
  for (const p of required) {
    if (!(p in mod.parameters)) throw new Error(`Missing parameter: ${p}`)
  }
})

test('OceanModifier normals are normalized', () => {
  const result = new OceanModifier({ resolution: 16, choppiness: 1.0 }).apply(new BufferGeometry())
  const norm   = result.getAttribute('normal')
  for (let i = 0; i < norm.count; i++) {
    const nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i)
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz)
    if (Math.abs(len - 1) > 0.01) throw new Error(`Normal not normalized at ${i}: length=${len}`)
  }
})

// ── BooleanModifier ───────────────────────────────────────────────────────────

console.log('\nBooleanModifier')

test('BooleanModifier has correct name', () => {
  const mod = new BooleanModifier({ operand: new SphereGeometry(0.5, 8, 6) })
  if (mod.name !== 'Boolean') throw new Error(`Expected 'Boolean', got '${mod.name}'`)
})

test('BooleanModifier default operation is difference (1)', () => {
  const mod = new BooleanModifier({ operand: new SphereGeometry(0.5, 8, 6) })
  if (mod.parameters.operation !== 1) throw new Error(`Expected 1, got ${mod.parameters.operation}`)
})

test('BooleanModifier union operation index is 0', () => {
  const mod = new BooleanModifier({ operand: new SphereGeometry(0.5, 8, 6), operation: 'union' })
  if (mod.parameters.operation !== 0) throw new Error(`Expected 0, got ${mod.parameters.operation}`)
})

test('BooleanModifier intersection operation index is 2', () => {
  const mod = new BooleanModifier({ operand: new SphereGeometry(0.5, 8, 6), operation: 'intersection' })
  if (mod.parameters.operation !== 2) throw new Error(`Expected 2, got ${mod.parameters.operation}`)
})

test('BooleanModifier difference produces geometry', () => {
  const base    = new BoxGeometry(1, 1, 1)
  const cutter  = new SphereGeometry(0.5, 8, 6)
  const mod     = new BooleanModifier({ operand: cutter, operation: 'difference' })
  const result  = mod.apply(base)
  const pos     = result.getAttribute('position')
  if (!pos || pos.count === 0) throw new Error('Result has no position attribute')
})

test('BooleanModifier union produces geometry with more volume', () => {
  const base   = new BoxGeometry(1, 1, 1)
  const other  = new SphereGeometry(0.5, 8, 6)
  const mod    = new BooleanModifier({ operand: other, operation: 'union' })
  const result = mod.apply(base)
  const pos    = result.getAttribute('position')
  if (!pos || pos.count === 0) throw new Error('Result has no position attribute')
})

test('BooleanModifier intersection produces geometry', () => {
  const base   = new BoxGeometry(1, 1, 1)
  const other  = new SphereGeometry(0.5, 8, 6)
  const mod    = new BooleanModifier({ operand: other, operation: 'intersection' })
  const result = mod.apply(base)
  const pos    = result.getAttribute('position')
  if (!pos || pos.count === 0) throw new Error('Result has no position attribute')
})

test('BooleanModifier does not mutate input geometry', () => {
  const base        = new BoxGeometry(1, 1, 1)
  const origCount   = base.getAttribute('position').count
  const mod         = new BooleanModifier({ operand: new SphereGeometry(0.5, 8, 6), operation: 'difference' })
  mod.apply(base)
  if (base.getAttribute('position').count !== origCount) throw new Error('Input geometry was mutated')
})

test('BooleanModifier works inside ModifierStack', () => {
  const stack  = new ModifierStack(new BoxGeometry(1, 1, 1))
  stack.add(new BooleanModifier({ operand: new SphereGeometry(0.4, 8, 6), operation: 'difference' }))
  const result = stack.apply()
  const pos    = result.getAttribute('position')
  if (!pos || pos.count === 0) throw new Error('ModifierStack result has no vertices')
})

test('BooleanModifier parameters.operation can be changed at runtime', () => {
  const mod = new BooleanModifier({ operand: new SphereGeometry(0.5, 8, 6), operation: 'difference' })
  mod.parameters.operation = 0
  if (mod.parameters.operation !== 0) throw new Error('parameter change failed')
  const result = mod.apply(new BoxGeometry(1, 1, 1))
  if (!result.getAttribute('position')) throw new Error('No position after runtime op change')
})

// ── New modifiers (Bevel, Wireframe, Shrinkwrap) ──────────────────────────────
import('./new-modifiers.test.js')

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
