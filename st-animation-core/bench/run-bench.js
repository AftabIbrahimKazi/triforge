import * as THREE from 'three'
import { ShapeKeyMesh, Armature, SkinBinding, computeEnvelopeWeights, NLATrack, NLAEditor } from '../dist/index.js'

function bench(label, fn, iters = 10_000) {
  fn()
  const t0 = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const ms = performance.now() - t0
  console.log(`  ${label}: ${(ms / iters * 1000).toFixed(1)} µs/op  (${iters} iters)`)
}

console.log('\n── st-animation-core benchmark ──\n')

// 1. ShapeKeyMesh.update — 1000 vertices, 3 keys
const vCount = 1000
const baseArr = new Float32Array(vCount * 3).fill(0)
const geo = new THREE.BufferGeometry()
geo.setAttribute('position', new THREE.BufferAttribute(baseArr.slice(), 3))
const mat = new THREE.MeshStandardMaterial()
const mesh = new ShapeKeyMesh(geo, mat)

for (let k = 0; k < 3; k++) {
  const kpos = new Float32Array(vCount * 3)
  for (let i = 0; i < kpos.length; i++) kpos[i] = Math.random()
  mesh.addShapeKey({ name: `key${k}`, positions: kpos })
  mesh.parameters[`key${k}`] = 0.3 + k * 0.2
}
bench(`ShapeKeyMesh.update       (${vCount} verts, 3 keys)`, () => mesh.update())

// 2. Armature.update — 20 bones
const bones = Array.from({ length: 20 }, (_, i) => ({
  name: `bone${i}`,
  head: new THREE.Vector3(0, i, 0),
  tail: new THREE.Vector3(0, i + 1, 0),
  parent: i > 0 ? `bone${i - 1}` : undefined,
}))
const arm = new Armature(bones)
arm.pose.bone5.parameters.rotationX = 0.3
bench('Armature.update           (20 bones, chain)', () => arm.update())

// 3. SkinBinding.apply — 500 vertices
const geo2 = new THREE.BufferGeometry()
const pos2  = new Float32Array(500 * 3)
for (let i = 0; i < 500; i++) { pos2[i*3+1] = i / 500 * 20 }
geo2.setAttribute('position', new THREE.BufferAttribute(pos2.slice(), 3))
const arm2    = new Armature(bones)
const weights = computeEnvelopeWeights(geo2, arm2)
const skin    = new SkinBinding(arm2, geo2, weights)
arm2.update()
bench('SkinBinding.apply         (500 verts, 20 bones)', () => { arm2.update(); skin.apply() })

// 4. NLAEditor.update — 4 tracks, 2 strips each
const clip = { duration: 10, evaluate: () => {} }
const nla  = new NLAEditor()
for (let t = 0; t < 4; t++) {
  const track = new NLATrack(`t${t}`, [
    { name:'a', clip, start:0,  end:5,  influence:1, repeat:false, extrapolation:'hold' },
    { name:'b', clip, start:5,  end:10, influence:1, repeat:false, extrapolation:'hold' },
  ])
  nla.addTrack(track)
}
bench('NLAEditor.update          (4 tracks, 2 strips)', () => nla.update(1/60))

console.log()
