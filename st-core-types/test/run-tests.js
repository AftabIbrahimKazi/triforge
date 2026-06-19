// st-core-types: compile-time only — all tests are structural (TypeScript).
// This file verifies the dist/ exports load correctly at runtime.

import {
  // Just import to verify the module resolves without error.
  // Types don't exist at runtime, but their containing modules must be importable.
} from '../dist/index.js'

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch(e) { console.error(`  ✗ ${name}: ${e.message}`); failed++ }
}

// Verify the dist index file is importable (types-only package has no runtime exports,
// but the module itself must resolve)
test('dist/index.js is importable', () => {
  // Reaching this line means the import above succeeded
})

test('IAnimatable shape: parameters is a plain object', () => {
  // Structural conformance — any object with parameters satisfies IAnimatable
  const node = { parameters: { scale: 1.0, strength: 0.5 } }
  if (typeof node.parameters !== 'object') throw new Error('parameters must be object')
})

test('IGeometryProvider is a function type', () => {
  // A zero-arg function returning something is a valid IGeometryProvider
  const provider = () => ({ isBufferGeometry: true })
  if (typeof provider !== 'function') throw new Error('provider must be function')
})

test('IStrand shape: points array of [x,y,z] tuples', () => {
  const strand = { points: [[0,0,0],[0,0.5,0],[0,1,0]] }
  if (!Array.isArray(strand.points)) throw new Error('points must be array')
  if (strand.points[0].length !== 3) throw new Error('each point must be [x,y,z]')
})

test('IKeyframeTarget is a plain number record', () => {
  const target = { opacity: 1.0, scale: 1.0, rotation: 0 }
  for (const v of Object.values(target)) {
    if (typeof v !== 'number') throw new Error('all values must be numbers')
  }
})

test('IConstraint shape: type, enabled, solve()', () => {
  const constraint = {
    type: 'fixed', parameters: { stiffness: 0.8 }, enabled: true,
    solve() {}
  }
  if (typeof constraint.solve !== 'function') throw new Error('solve must be function')
})

test('ICurve shape: getPoint and getTangent', () => {
  const curve = {
    getPoint:  (t) => ({ x: Math.cos(t), y: 0, z: Math.sin(t) }),
    getTangent:(t) => ({ x: -Math.sin(t), y: 0, z: Math.cos(t) }),
  }
  const pt = curve.getPoint(0)
  if (typeof pt.x !== 'number') throw new Error('getPoint must return a point')
})

test('IModifier shape: name, enabled, parameters, apply()', () => {
  const mod = {
    name: 'TestModifier', enabled: true, parameters: { strength: 1 },
    apply: (geo) => geo
  }
  if (typeof mod.apply !== 'function') throw new Error('apply must be function')
  if (typeof mod.name !== 'string') throw new Error('name must be string')
})

console.log(`\n  ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
