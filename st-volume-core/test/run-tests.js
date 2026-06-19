// st-volume-core tests — plain Node.js, no framework
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { VolumeBox } from '../dist/index.js'

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch(e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++ }
}

console.log('\nVolumeBox')

test('constructs with defaults', () => {
  const v = new VolumeBox()
  assert.equal(v.parameters.density, 1)
  assert.equal(v.parameters.noiseScale, 1.5)
  assert.equal(v.parameters.steps, 48)
})

test('constructs with custom options', () => {
  const v = new VolumeBox({ type: 'smoke', density: 2, steps: 64, noiseScale: 2 })
  assert.equal(v.parameters.density, 2)
  assert.equal(v.parameters.steps, 64)
  assert.equal(v.parameters.noiseScale, 2)
})

test('mesh is a THREE.Mesh', () => {
  const v = new VolumeBox()
  assert.ok(v.mesh instanceof THREE.Mesh)
})

test('material is a THREE.ShaderMaterial', () => {
  const v = new VolumeBox()
  assert.ok(v.material instanceof THREE.ShaderMaterial)
})

test('all three volume types construct', () => {
  for (const type of ['fog', 'smoke', 'fire']) {
    const v = new VolumeBox({ type })
    assert.ok(v.mesh)
  }
})

test('tick updates uTime uniform', () => {
  const v = new VolumeBox()
  v.tick(1.5)
  assert.equal(v.material.uniforms['uTime'].value, 1.5)
})

test('tick syncs density parameter to uniform', () => {
  const v = new VolumeBox({ density: 0.5 })
  v.parameters.density = 2.0
  v.tick(0)
  assert.equal(v.material.uniforms['uDensity'].value, 2.0)
})

test('setCameraPosition writes to uCameraLocalPos uniform', () => {
  const v = new VolumeBox()
  // Identity world matrix → local pos equals world pos
  v.mesh.updateWorldMatrix(false, false)
  v.setCameraPosition(1, 2, 3)
  const cp = v.material.uniforms['uCameraLocalPos'].value
  // With identity transform, local pos ≈ world pos
  assert.ok(Math.abs(cp.x - 1) < 0.001)
  assert.ok(Math.abs(cp.y - 2) < 0.001)
  assert.ok(Math.abs(cp.z - 3) < 0.001)
})

test('fire type uses additive blending', () => {
  const fire = new VolumeBox({ type: 'fire' })
  assert.equal(fire.material.blending, THREE.AdditiveBlending)
})

test('fog type uses normal blending', () => {
  const fog = new VolumeBox({ type: 'fog' })
  assert.equal(fog.material.blending, THREE.NormalBlending)
})

test('dispose does not throw', () => {
  const v = new VolumeBox()
  v.dispose()
})

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
