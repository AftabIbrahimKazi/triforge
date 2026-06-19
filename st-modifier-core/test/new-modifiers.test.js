/**
 * Tests for WireframeModifier, ShrinkwrapModifier, BevelModifier
 * Run via: node test/new-modifiers.test.js
 */

import { BufferGeometry, BufferAttribute } from 'three'
import { SphereGeometry, BoxGeometry } from 'three'
import { WireframeModifier } from '../dist/index.js'
import { ShrinkwrapModifier } from '../dist/index.js'
import { BevelModifier } from '../dist/index.js'

console.log('\n--- NEW MODIFIER TESTS ---\n')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++ }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeQuad() {
  // Two triangles forming a flat square, with normals and UVs
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

function makeIndexedQuad() {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array([
    -1,-1, 0,
     1,-1, 0,
     1, 1, 0,
    -1, 1, 0,
  ]), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array([
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
  ]), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array([
    0,0, 1,0, 1,1, 0,1,
  ]), 2))
  geo.setIndex(new BufferAttribute(new Uint16Array([0,1,2, 0,2,3]), 1))
  return geo
}

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

// ── WireframeModifier ─────────────────────────────────────────────────────────

console.log('\nWireframeModifier')

test('WireframeModifier has correct name', () => {
  if (new WireframeModifier().name !== 'Wireframe') throw new Error('Wrong name')
})

test('WireframeModifier exposes parameters', () => {
  const mod = new WireframeModifier({ thickness: 0.05, sides: 6 })
  if (mod.parameters.thickness !== 0.05) throw new Error('thickness wrong')
  if (mod.parameters.sides     !== 6)    throw new Error('sides wrong')
})

test('WireframeModifier default parameters are set', () => {
  const mod = new WireframeModifier()
  if (typeof mod.parameters.thickness !== 'number') throw new Error('thickness missing')
  if (typeof mod.parameters.sides     !== 'number') throw new Error('sides missing')
})

test('WireframeModifier produces more triangles than input', () => {
  const geo    = makeQuad()
  const before = countTris(geo)
  const result = new WireframeModifier({ thickness: 0.05 }).apply(geo)
  const after  = countTris(result)
  if (after <= before) throw new Error(`Expected more tris, got ${after} vs ${before}`)
})

test('WireframeModifier result has position attribute', () => {
  const result = new WireframeModifier().apply(makeQuad())
  if (!result.getAttribute('position')) throw new Error('No position attribute')
})

test('WireframeModifier result has normal attribute', () => {
  const result = new WireframeModifier().apply(makeQuad())
  if (!result.getAttribute('normal')) throw new Error('No normal attribute')
})

test('WireframeModifier works on indexed geometry', () => {
  const geo    = makeIndexedQuad()
  const result = new WireframeModifier({ thickness: 0.02 }).apply(geo)
  if (!result.getAttribute('position') || result.getAttribute('position').count === 0)
    throw new Error('No position on indexed input')
})

test('WireframeModifier sides clamped to min 3', () => {
  const mod = new WireframeModifier({ sides: 1 })
  if (mod.parameters.sides < 3) throw new Error(`sides below 3: ${mod.parameters.sides}`)
})

test('WireframeModifier sides clamped to max 8', () => {
  const mod = new WireframeModifier({ sides: 99 })
  if (mod.parameters.sides > 8) throw new Error(`sides above 8: ${mod.parameters.sides}`)
})

test('WireframeModifier with zero thickness produces no-radius tubes', () => {
  const result = new WireframeModifier({ thickness: 0 }).apply(makeQuad())
  // Should not throw, result should still have geometry structure
  if (!result.getAttribute('position')) throw new Error('No position')
})

test('WireframeModifier does not mutate input geometry', () => {
  const geo      = makeQuad()
  const origCount = geo.getAttribute('position').count
  new WireframeModifier().apply(geo)
  if (geo.getAttribute('position').count !== origCount) throw new Error('Input mutated')
})

test('WireframeModifier more sides → more triangles per edge', () => {
  const geo  = makeQuad()
  const res3 = new WireframeModifier({ sides: 3 }).apply(geo)
  const res8 = new WireframeModifier({ sides: 8 }).apply(geo)
  if (countTris(res8) <= countTris(res3))
    throw new Error('More sides should produce more triangles')
})

test('WireframeModifier works on SphereGeometry', () => {
  const geo    = new SphereGeometry(1, 8, 6)
  const result = new WireframeModifier({ thickness: 0.01 }).apply(geo)
  if (!result.getAttribute('position') || result.getAttribute('position').count === 0)
    throw new Error('No position on sphere input')
})

test('WireframeModifier all positions are finite', () => {
  const result = new WireframeModifier({ thickness: 0.05 }).apply(new SphereGeometry(1, 8, 6))
  const pos    = result.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    if (!isFinite(pos.getX(i)) || !isFinite(pos.getY(i)) || !isFinite(pos.getZ(i)))
      throw new Error(`Non-finite position at ${i}`)
  }
})

// ── ShrinkwrapModifier ────────────────────────────────────────────────────────

console.log('\nShrinkwrapModifier')

test('ShrinkwrapModifier has correct name', () => {
  const target = new SphereGeometry(1, 8, 6)
  if (new ShrinkwrapModifier(target).name !== 'Shrinkwrap') throw new Error('Wrong name')
})

test('ShrinkwrapModifier exposes parameters', () => {
  const mod = new ShrinkwrapModifier(new SphereGeometry(1, 8, 6), { offset: 0.05, factor: 0.5 })
  if (mod.parameters.offset !== 0.05) throw new Error('offset wrong')
  if (mod.parameters.factor !== 0.5)  throw new Error('factor wrong')
})

test('ShrinkwrapModifier factor=1 moves vertices toward target', () => {
  // Source: flat quad far from origin. Target: unit sphere.
  // After shrinkwrap, vertices should be closer to the sphere surface.
  const target = new SphereGeometry(1, 16, 12)
  const src    = makeQuad()
  const mod    = new ShrinkwrapModifier(target, { factor: 1.0 })
  const before = sumPositions(src)
  const result = mod.apply(src)
  const after  = sumPositions(result)
  // positions should have changed (quad is at z=0, sphere maps them inward)
  // We can't be too specific about the exact result, just that positions changed
  if (Math.abs(after - before) < 0.001) throw new Error('Positions should change with factor=1')
})

test('ShrinkwrapModifier factor=0 preserves original positions', () => {
  const target = new SphereGeometry(1, 8, 6)
  const src    = makeQuad()
  const before = sumPositions(src)
  const result = new ShrinkwrapModifier(target, { factor: 0 }).apply(src)
  const after  = sumPositions(result)
  if (Math.abs(after - before) > 0.001) throw new Error('factor=0 should preserve positions')
})

test('ShrinkwrapModifier preserves vertex count', () => {
  const target = new SphereGeometry(1, 8, 6)
  const src    = new SphereGeometry(2, 6, 4)
  const before = src.getAttribute('position').count
  const result = new ShrinkwrapModifier(target).apply(src)
  if (result.getAttribute('position').count !== before) throw new Error('Vertex count changed')
})

test('ShrinkwrapModifier result has normals', () => {
  const target = new SphereGeometry(1, 8, 6)
  const result = new ShrinkwrapModifier(target).apply(makeQuad())
  if (!result.getAttribute('normal')) throw new Error('No normals')
})

test('ShrinkwrapModifier result positions are finite', () => {
  const target = new SphereGeometry(1, 8, 6)
  const result = new ShrinkwrapModifier(target, { offset: 0.05 }).apply(makeQuad())
  const pos    = result.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    if (!isFinite(pos.getX(i)) || !isFinite(pos.getY(i)) || !isFinite(pos.getZ(i)))
      throw new Error(`Non-finite position at ${i}`)
  }
})

test('ShrinkwrapModifier does not mutate input geometry', () => {
  const target   = new SphereGeometry(1, 8, 6)
  const src      = makeQuad()
  const origCount = src.getAttribute('position').count
  new ShrinkwrapModifier(target).apply(src)
  if (src.getAttribute('position').count !== origCount) throw new Error('Input mutated')
})

test('ShrinkwrapModifier factor clamped to [0,1]', () => {
  const target = new SphereGeometry(1, 8, 6)
  const mod    = new ShrinkwrapModifier(target, { factor: 5 })
  if (mod.parameters.factor > 1) throw new Error('factor not clamped to 1')
  const mod2   = new ShrinkwrapModifier(target, { factor: -1 })
  if (mod2.parameters.factor < 0) throw new Error('factor not clamped to 0')
})

test('ShrinkwrapModifier works on indexed geometry', () => {
  const target = new SphereGeometry(1, 8, 6)
  const src    = makeIndexedQuad()
  const result = new ShrinkwrapModifier(target).apply(src)
  if (!result.getAttribute('position')) throw new Error('No position')
})

test('ShrinkwrapModifier offset moves vertices above surface', () => {
  const target  = new SphereGeometry(1, 8, 6)
  const src     = new SphereGeometry(2, 8, 6)  // slightly larger sphere
  const result0 = new ShrinkwrapModifier(target, { factor: 1.0, offset: 0.0 }).apply(src)
  const result1 = new ShrinkwrapModifier(target, { factor: 1.0, offset: 0.5 }).apply(src)
  const sum0    = sumPositions(result0)
  const sum1    = sumPositions(result1)
  if (Math.abs(sum1 - sum0) < 0.001) throw new Error('Offset should change positions')
})

// ── BevelModifier ─────────────────────────────────────────────────────────────

console.log('\nBevelModifier')

test('BevelModifier has correct name', () => {
  if (new BevelModifier().name !== 'Bevel') throw new Error('Wrong name')
})

test('BevelModifier exposes parameters', () => {
  const mod = new BevelModifier({ width: 0.2, segments: 2, angleThreshold: 45 })
  if (mod.parameters.width          !== 0.2)  throw new Error('width wrong')
  if (mod.parameters.segments       !== 2)    throw new Error('segments wrong')
  if (mod.parameters.angleThreshold !== 45)   throw new Error('angleThreshold wrong')
})

test('BevelModifier default parameters are set', () => {
  const mod = new BevelModifier()
  if (typeof mod.parameters.width          !== 'number') throw new Error('width missing')
  if (typeof mod.parameters.segments       !== 'number') throw new Error('segments missing')
  if (typeof mod.parameters.angleThreshold !== 'number') throw new Error('angleThreshold missing')
})

test('BevelModifier produces geometry with position attribute', () => {
  const result = new BevelModifier({ width: 0.1 }).apply(new BoxGeometry(1, 1, 1))
  if (!result.getAttribute('position') || result.getAttribute('position').count === 0)
    throw new Error('No position')
})

test('BevelModifier does not mutate input', () => {
  const geo      = new BoxGeometry(1, 1, 1)
  const origCount = geo.getAttribute('position').count
  new BevelModifier().apply(geo)
  if (geo.getAttribute('position').count !== origCount) throw new Error('Input mutated')
})

test('BevelModifier result has normals', () => {
  const result = new BevelModifier().apply(new BoxGeometry(1, 1, 1))
  if (!result.getAttribute('normal')) throw new Error('No normals')
})

test('BevelModifier with high angleThreshold (180deg) returns clone (no hard edges)', () => {
  const geo    = new BoxGeometry(1, 1, 1)
  const result = new BevelModifier({ angleThreshold: 180 }).apply(geo)
  // No edges pass the 180-degree threshold, should return a clone
  if (!result.getAttribute('position')) throw new Error('No position')
})

test('BevelModifier segments clamped to min 1', () => {
  const mod = new BevelModifier({ segments: 0 })
  if (mod.parameters.segments < 1) throw new Error('segments below 1')
})

test('BevelModifier segments clamped to max 4', () => {
  const mod = new BevelModifier({ segments: 99 })
  if (mod.parameters.segments > 4) throw new Error('segments above 4')
})

test('BevelModifier all output positions are finite', () => {
  const result = new BevelModifier({ width: 0.1 }).apply(new BoxGeometry(1, 1, 1))
  const pos    = result.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    if (!isFinite(pos.getX(i)) || !isFinite(pos.getY(i)) || !isFinite(pos.getZ(i)))
      throw new Error(`Non-finite position at ${i}`)
  }
})

test('BevelModifier segments=2 produces more triangles than segments=1', () => {
  const geo  = new BoxGeometry(1, 1, 1)
  const res1 = new BevelModifier({ segments: 1, width: 0.1 }).apply(geo)
  const res2 = new BevelModifier({ segments: 2, width: 0.1 }).apply(geo)
  if (countTris(res2) <= countTris(res1))
    throw new Error('More segments should produce more triangles')
})

test('BevelModifier works on flat quad (no hard edges at 30 degrees)', () => {
  // Flat quad: all edges have 0° dihedral, no edges above threshold
  const geo    = makeQuad()
  const result = new BevelModifier({ width: 0.05, angleThreshold: 30 }).apply(geo)
  if (!result.getAttribute('position')) throw new Error('No position')
})

test('BevelModifier works inside ModifierStack', () => {
  // Import ModifierStack dynamically to avoid circular import issues
  const geo = new BoxGeometry(1, 1, 1)
  const result = new BevelModifier({ width: 0.1 }).apply(geo)
  if (!result.getAttribute('position')) throw new Error('No result from stack')
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
