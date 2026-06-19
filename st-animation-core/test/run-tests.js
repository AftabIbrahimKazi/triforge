// st-animation-core tests — plain Node.js, no framework
// Run: npm run build && npm test

import {
  ShapeKeyMesh, shapeKeyFromGeometry, shapeKeyFromDeltas,
  PoseBone,
  Armature,
  SkinBinding, computeEnvelopeWeights,
  NLATrack, NLAEditor,
  TrackToConstraint, CopyRotationConstraint, CopyLocationConstraint,
} from '../dist/index.js'
import * as THREE from 'three'

let pass = 0, fail = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++ }
  catch(e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail++ }
}
function assert(c, m='assertion failed'){ if(!c) throw new Error(m) }
function approx(a,b,eps=1e-4){ if(Math.abs(a-b)>eps) throw new Error(`expected ~${b}, got ${a} (eps=${eps})`) }

// ── helpers ──────────────────────────────────────────────────────────────────

function makeGeo(verts) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geo.computeVertexNormals()
  return geo
}

function makeMat() { return new THREE.MeshStandardMaterial() }

// Simple 2-vertex geometry for shape key tests
const BASE_VERTS = [0,0,0, 1,0,0]  // v0=(0,0,0), v1=(1,0,0)
const KEY_VERTS  = [0,1,0, 1,1,0]  // v0=(0,1,0), v1=(1,1,0) — moved up by 1

// ── ShapeKey helpers ──────────────────────────────────────────────────────────
console.log('\nShapeKey helpers')

test('shapeKeyFromGeometry copies position array', () => {
  const geo = makeGeo(BASE_VERTS)
  const key = shapeKeyFromGeometry('test', geo)
  assert(key.name === 'test')
  approx(key.positions[0], 0)
  approx(key.positions[1], 0)
  approx(key.positions[2], 0)
  approx(key.positions[3], 1)
})

test('shapeKeyFromDeltas adds delta to base positions', () => {
  const geo    = makeGeo(BASE_VERTS)
  const deltas = new Float32Array([0,1,0, 0,1,0])  // push both verts up by 1
  const key    = shapeKeyFromDeltas('up', geo, deltas)
  approx(key.positions[1], 1)   // y of v0 = 0 + 1
  approx(key.positions[4], 1)   // y of v1 = 0 + 1
})

test('shapeKeyFromDeltas name is correct', () => {
  const geo    = makeGeo(BASE_VERTS)
  const deltas = new Float32Array(6)
  const key    = shapeKeyFromDeltas('smile', geo, deltas)
  assert(key.name === 'smile')
})

// ── ShapeKeyMesh ─────────────────────────────────────────────────────────────
console.log('\nShapeKeyMesh')

test('parameters starts empty', () => {
  const mesh = new ShapeKeyMesh(makeGeo(BASE_VERTS), makeMat())
  assert(Object.keys(mesh.parameters).length === 0)
})

test('addShapeKey adds to parameters with default influence 0', () => {
  const mesh = new ShapeKeyMesh(makeGeo(BASE_VERTS), makeMat())
  mesh.addShapeKey({ name: 'smile', positions: new Float32Array(KEY_VERTS) })
  assert('smile' in mesh.parameters)
  approx(mesh.parameters.smile, 0)
})

test('addShapeKey stores the key', () => {
  const mesh = new ShapeKeyMesh(makeGeo(BASE_VERTS), makeMat())
  mesh.addShapeKey({ name: 'blink', positions: new Float32Array(KEY_VERTS) })
  assert(mesh.shapeKeys.length === 1)
  assert(mesh.shapeKeys[0].name === 'blink')
})

test('update at influence=0: positions unchanged', () => {
  const geo  = makeGeo(BASE_VERTS)
  const mesh = new ShapeKeyMesh(geo, makeMat())
  mesh.addShapeKey({ name: 'up', positions: new Float32Array(KEY_VERTS) })
  mesh.parameters.up = 0
  mesh.update()
  const pos = geo.getAttribute('position')
  approx(pos.getY(0), 0)  // basis y=0
})

test('update at influence=1: positions become key positions', () => {
  const geo  = makeGeo(BASE_VERTS)
  const mesh = new ShapeKeyMesh(geo, makeMat())
  mesh.addShapeKey({ name: 'up', positions: new Float32Array(KEY_VERTS) })
  mesh.parameters.up = 1
  mesh.update()
  const pos = geo.getAttribute('position')
  approx(pos.getY(0), 1)
  approx(pos.getY(1), 1)
})

test('update at influence=0.5: positions halfway', () => {
  const geo  = makeGeo(BASE_VERTS)
  const mesh = new ShapeKeyMesh(geo, makeMat())
  mesh.addShapeKey({ name: 'up', positions: new Float32Array(KEY_VERTS) })
  mesh.parameters.up = 0.5
  mesh.update()
  const pos = geo.getAttribute('position')
  approx(pos.getY(0), 0.5)
})

test('two shape keys blend independently', () => {
  const geo   = makeGeo([0,0,0])
  const mesh  = new ShapeKeyMesh(geo, makeMat())
  mesh.addShapeKey({ name: 'up',    positions: new Float32Array([0,2,0]) })
  mesh.addShapeKey({ name: 'right', positions: new Float32Array([3,0,0]) })
  mesh.parameters.up    = 0.5
  mesh.parameters.right = 1.0
  mesh.update()
  const pos = geo.getAttribute('position')
  approx(pos.getY(0), 1)   // 0.5 * 2
  approx(pos.getX(0), 3)   // 1.0 * 3
})

test('addShapeKey Basis replaces rest pose', () => {
  const geo  = makeGeo(BASE_VERTS)
  const mesh = new ShapeKeyMesh(geo, makeMat())
  mesh.addShapeKey({ name: 'Basis', positions: new Float32Array([5,5,5, 6,6,6]) })
  // Adding a key relative to new basis
  mesh.addShapeKey({ name: 'up', positions: new Float32Array([5,6,5, 6,7,6]) })
  mesh.parameters.up = 1
  mesh.update()
  const pos = geo.getAttribute('position')
  approx(pos.getY(0), 6)  // new basis y=5, key y=6
})

test('removeShapeKey removes from parameters and shapeKeys', () => {
  const mesh = new ShapeKeyMesh(makeGeo(BASE_VERTS), makeMat())
  mesh.addShapeKey({ name: 'blink', positions: new Float32Array(6) })
  mesh.removeShapeKey('blink')
  assert(mesh.shapeKeys.length === 0)
  assert(!('blink' in mesh.parameters))
})

test('sample does not modify geometry', () => {
  const geo  = makeGeo(BASE_VERTS)
  const mesh = new ShapeKeyMesh(geo, makeMat())
  mesh.addShapeKey({ name: 'up', positions: new Float32Array(KEY_VERTS) })
  mesh.sample({ up: 1 })
  const pos = geo.getAttribute('position')
  approx(pos.getY(0), 0)  // unchanged
})

test('sample returns blended positions', () => {
  const geo  = makeGeo(BASE_VERTS)
  const mesh = new ShapeKeyMesh(geo, makeMat())
  mesh.addShapeKey({ name: 'up', positions: new Float32Array(KEY_VERTS) })
  const out  = mesh.sample({ up: 0.5 })
  approx(out[1], 0.5)  // y of v0
})

// ── PoseBone ─────────────────────────────────────────────────────────────────
console.log('\nPoseBone')

test('parameters has all 9 channels', () => {
  const b = new PoseBone('test')
  const keys = Object.keys(b.parameters)
  assert(keys.includes('locationX') && keys.includes('rotationY') && keys.includes('scaleZ'))
  assert(keys.length === 9)
})

test('default location is 0,0,0', () => {
  const b = new PoseBone('test')
  approx(b.parameters.locationX, 0)
  approx(b.parameters.locationY, 0)
  approx(b.parameters.locationZ, 0)
})

test('default scale is 1,1,1', () => {
  const b = new PoseBone('test')
  approx(b.parameters.scaleX, 1)
  approx(b.parameters.scaleY, 1)
  approx(b.parameters.scaleZ, 1)
})

test('setQuaternion / getQuaternion round-trips', () => {
  const b = new PoseBone('test')
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.5, 0.1))
  b.setQuaternion(q)
  const q2 = b.getQuaternion()
  approx(q.x, q2.x, 0.001)
  approx(q.y, q2.y, 0.001)
  approx(q.z, q2.z, 0.001)
  approx(q.w, q2.w, 0.001)
})

test('buildLocalMatrix reflects translation', () => {
  const b = new PoseBone('test')
  b.parameters.locationX = 5
  b.buildLocalMatrix()
  approx(b.localMatrix.elements[12], 5)
})

// ── Armature ─────────────────────────────────────────────────────────────────
console.log('\nArmature')

const simpleBones = [
  { name: 'root',  head: new THREE.Vector3(0,0,0), tail: new THREE.Vector3(0,1,0) },
  { name: 'child', head: new THREE.Vector3(0,1,0), tail: new THREE.Vector3(0,2,0), parent: 'root' },
]

test('armature creates pose bones for each definition', () => {
  const arm = new Armature(simpleBones)
  assert('root'  in arm.pose)
  assert('child' in arm.pose)
})

test('boneNames contains all bone names', () => {
  const arm = new Armature(simpleBones)
  assert(arm.boneNames.includes('root'))
  assert(arm.boneNames.includes('child'))
})

test('boneNames: parent appears before child', () => {
  const arm = new Armature(simpleBones)
  const ri = arm.boneNames.indexOf('root')
  const ci = arm.boneNames.indexOf('child')
  assert(ri < ci, `root(${ri}) should precede child(${ci})`)
})

test('update does not throw', () => {
  const arm = new Armature(simpleBones)
  arm.update()
})

test('getBoneMatrices returns one matrix per bone', () => {
  const arm = new Armature(simpleBones)
  arm.update()
  const mats = arm.getBoneMatrices()
  assert(mats.length === 2)
})

test('getBoneWorldPosition returns a Vector3', () => {
  const arm = new Armature(simpleBones)
  arm.update()
  const pos = arm.getBoneWorldPosition('root')
  assert(typeof pos.x === 'number')
})

test('rotating root bone changes child world matrix', () => {
  const arm = new Armature(simpleBones)
  arm.update()
  const before = arm.pose.child.worldMatrix.clone()
  arm.pose.root.parameters.rotationZ = Math.PI / 4
  arm.update()
  const after = arm.pose.child.worldMatrix
  // At least one element should have changed
  let changed = false
  for (let i = 0; i < 16; i++) {
    if (Math.abs(before.elements[i] - after.elements[i]) > 0.001) { changed = true; break }
  }
  assert(changed, 'child world matrix should change when root rotates')
})

test('multi-bone armature topological sort', () => {
  const arm = new Armature([
    { name: 'hips',    head: new THREE.Vector3(0,0,0),   tail: new THREE.Vector3(0,1,0) },
    { name: 'spine',   head: new THREE.Vector3(0,1,0),   tail: new THREE.Vector3(0,2,0), parent: 'hips' },
    { name: 'chest',   head: new THREE.Vector3(0,2,0),   tail: new THREE.Vector3(0,3,0), parent: 'spine' },
    { name: 'upperL',  head: new THREE.Vector3(-1,2.5,0),tail: new THREE.Vector3(-2,2,0), parent: 'chest' },
    { name: 'forearmL',head: new THREE.Vector3(-2,2,0),  tail: new THREE.Vector3(-3,1.5,0), parent: 'upperL' },
  ])
  const names = arm.boneNames
  assert(names.indexOf('hips')     < names.indexOf('spine'))
  assert(names.indexOf('spine')    < names.indexOf('chest'))
  assert(names.indexOf('chest')    < names.indexOf('upperL'))
  assert(names.indexOf('upperL')   < names.indexOf('forearmL'))
})

// ── SkinBinding / computeEnvelopeWeights ─────────────────────────────────────
console.log('\nSkinBinding')

test('computeEnvelopeWeights returns one entry per vertex', () => {
  const geo = makeGeo([0,0.5,0, 0,1.5,0])  // v0 near root, v1 near child
  const arm = new Armature(simpleBones)
  const w   = computeEnvelopeWeights(geo, arm)
  assert(w.length === 2, `expected 2, got ${w.length}`)
})

test('computeEnvelopeWeights assigns nearest bone', () => {
  const geo = makeGeo([0,0.2,0, 0,1.8,0])  // v0 near root head, v1 near child tail
  const arm = new Armature(simpleBones)
  const w   = computeEnvelopeWeights(geo, arm)
  assert(w[0][0].bone === 'root',  `v0 should be root, got ${w[0][0].bone}`)
  assert(w[1][0].bone === 'child', `v1 should be child, got ${w[1][0].bone}`)
})

test('SkinBinding.apply does not throw', () => {
  const geo     = makeGeo([0,0.5,0])
  const arm     = new Armature(simpleBones)
  const weights = computeEnvelopeWeights(geo, arm)
  const skin    = new SkinBinding(arm, geo, weights)
  arm.update()
  skin.apply()
})

test('SkinBinding: identity pose leaves positions unchanged', () => {
  const geo     = makeGeo([0,0.5,0])
  const arm     = new Armature(simpleBones)
  const weights = computeEnvelopeWeights(geo, arm)
  const skin    = new SkinBinding(arm, geo, weights)
  // No pose changes — apply should give same result
  arm.update()
  skin.apply()
  const pos = geo.getAttribute('position')
  // Position should be near original (0, 0.5, 0)
  approx(pos.getX(0), 0, 0.1)
})

// ── NLATrack ──────────────────────────────────────────────────────────────────
console.log('\nNLATrack')

function makeClip(dur, fn) {
  return { duration: dur, evaluate: fn }
}

test('empty track evaluates without error', () => {
  const track = new NLATrack('test')
  track.evaluate(1)
})

test('strip active within its time range', () => {
  let called = false
  const clip = makeClip(2, () => { called = true })
  const track = new NLATrack('t', [{ name:'s', clip, start:0, end:4, influence:1, repeat:false, extrapolation:'nothing' }])
  track.evaluate(2)
  assert(called)
})

test('strip not active outside its time range (nothing extrapolation)', () => {
  let called = false
  const clip = makeClip(2, () => { called = true })
  const track = new NLATrack('t', [{ name:'s', clip, start:2, end:4, influence:1, repeat:false, extrapolation:'nothing' }])
  track.evaluate(0)
  assert(!called)
})

test('strip active at exact start time', () => {
  let called = false
  const clip = makeClip(1, () => { called = true })
  const track = new NLATrack('t', [{ name:'s', clip, start:1, end:2, influence:1, repeat:false, extrapolation:'nothing' }])
  track.evaluate(1)
  assert(called)
})

test('hold extrapolation: strip active before start', () => {
  let called = false
  const clip = makeClip(1, () => { called = true })
  const track = new NLATrack('t', [{ name:'s', clip, start:2, end:3, influence:1, repeat:false, extrapolation:'hold' }])
  track.evaluate(0)  // before start
  assert(called)
})

test('muted track does not evaluate', () => {
  let called = false
  const clip = makeClip(1, () => { called = true })
  const track = new NLATrack('t', [{ name:'s', clip, start:0, end:2, influence:1, repeat:false, extrapolation:'nothing' }])
  track.muted = true
  track.evaluate(1)
  assert(!called)
})

test('addStrip and removeStrip work', () => {
  const track = new NLATrack('t')
  const strip = { name:'s', clip:makeClip(1,()=>{}), start:0, end:1, influence:1, repeat:false, extrapolation:'nothing' }
  track.addStrip(strip)
  assert(track.strips.length === 1)
  track.removeStrip(strip)
  assert(track.strips.length === 0)
})

test('repeat: clip loops within strip', () => {
  const vals = []
  const clip = makeClip(1, t => vals.push(t))
  // strip: start=0, end=4, clipDur=1
  // local = ((t-0)/(4-0))*1 % 1
  const track = new NLATrack('t', [{ name:'s', clip, start:0, end:4, influence:1, repeat:true, extrapolation:'nothing' }])
  track.evaluate(0.5)   // local = (0.5/4)*1 = 0.125
  track.evaluate(2.0)   // local = (2.0/4)*1 = 0.5
  assert(vals.length === 2)
  approx(vals[0], 0.125, 0.01)
  approx(vals[1], 0.5,   0.01)
})

// ── NLAEditor ─────────────────────────────────────────────────────────────────
console.log('\nNLAEditor')

test('update advances time', () => {
  const nla = new NLAEditor()
  nla.update(0.5)
  approx(nla.time, 0.5)
})

test('update with timeScale=2 advances double', () => {
  const nla = new NLAEditor()
  nla.timeScale = 2
  nla.update(1)
  approx(nla.time, 2)
})

test('playing=false: time does not advance', () => {
  const nla = new NLAEditor()
  nla.playing = false
  nla.update(1)
  approx(nla.time, 0)
})

test('evaluate calls all tracks', () => {
  let calls = 0
  const clip = makeClip(10, () => { calls++ })
  const track1 = new NLATrack('a', [{ name:'s', clip, start:0, end:10, influence:1, repeat:false, extrapolation:'hold' }])
  const track2 = new NLATrack('b', [{ name:'s', clip, start:0, end:10, influence:1, repeat:false, extrapolation:'hold' }])
  const nla = new NLAEditor()
  nla.addTrack(track1); nla.addTrack(track2)
  nla.evaluate(5)
  assert(calls === 2)
})

test('duration = end of last strip', () => {
  const clip   = makeClip(1, ()=>{})
  const track  = new NLATrack('t', [
    { name:'a', clip, start:0, end:3, influence:1, repeat:false, extrapolation:'nothing' },
    { name:'b', clip, start:5, end:8, influence:1, repeat:false, extrapolation:'nothing' },
  ])
  const nla = new NLAEditor()
  nla.addTrack(track)
  approx(nla.duration, 8)
})

test('removeTrack removes correctly', () => {
  const nla   = new NLAEditor()
  const track = new NLATrack('t')
  nla.addTrack(track)
  nla.removeTrack(track)
  assert(nla.tracks.length === 0)
})

// ── BoneConstraints ───────────────────────────────────────────────────────────
console.log('\nBoneConstraints')

// Helper: make a simple 2-bone armature
function makeSimpleArm() {
  return new Armature([
    { name: 'root',  head: new THREE.Vector3(0,0,0), tail: new THREE.Vector3(0,1,0) },
    { name: 'child', head: new THREE.Vector3(0,1,0), tail: new THREE.Vector3(0,2,0), parent: 'root' },
  ])
}

// ── TrackToConstraint ─────────────────────────────────────────────────────────

test('TrackToConstraint: has parameters.influence default 1', () => {
  const arm = makeSimpleArm()
  arm.update()
  const c = new TrackToConstraint(arm.pose.root, { targetPosition: new THREE.Vector3(1, 0, 0) })
  approx(c.parameters.influence, 1.0)
})

test('TrackToConstraint: influence=0 does not modify rotation', () => {
  const arm = makeSimpleArm()
  arm.update()
  const bone = arm.pose.root
  const beforeX = bone.parameters.rotationX
  const beforeY = bone.parameters.rotationY
  const beforeZ = bone.parameters.rotationZ
  const c = new TrackToConstraint(bone, {
    targetPosition: new THREE.Vector3(5, 5, 5),
    influence: 0,
  })
  c.apply(bone, new THREE.Matrix4())
  approx(bone.parameters.rotationX, beforeX)
  approx(bone.parameters.rotationY, beforeY)
  approx(bone.parameters.rotationZ, beforeZ)
})

test('TrackToConstraint: influence=1 rotates bone toward target', () => {
  const arm = makeSimpleArm()
  arm.update()
  const bone = arm.pose.root
  // Bone starts at origin, target is at (10, 0, 0)
  const c = new TrackToConstraint(bone, {
    targetPosition: new THREE.Vector3(10, 0, 0),
    trackAxis: 'Y',
    influence: 1,
  })
  c.apply(bone, new THREE.Matrix4())
  // After apply, rotation should be non-identity (bone has turned)
  const rotated = Math.abs(bone.parameters.rotationX) + Math.abs(bone.parameters.rotationY) + Math.abs(bone.parameters.rotationZ)
  assert(rotated > 0.01, `Expected non-zero rotation, got ${rotated}`)
})

test('TrackToConstraint: accepts callback for targetPosition', () => {
  const arm = makeSimpleArm()
  arm.update()
  const bone = arm.pose.root
  let called = false
  const c = new TrackToConstraint(bone, {
    targetPosition: () => { called = true; return new THREE.Vector3(1, 0, 0) },
    influence: 1,
  })
  c.apply(bone, new THREE.Matrix4())
  assert(called, 'targetPosition callback should be called')
})

test('TrackToConstraint: addConstraint integrates with Armature.update()', () => {
  const arm = makeSimpleArm()
  const target = new THREE.Vector3(10, 0, 0)
  arm.addConstraint('root', new TrackToConstraint(arm.pose.root, { targetPosition: target, trackAxis: 'Y', influence: 1 }))
  arm.update()
  // If constraint ran, root rotation should differ from identity
  const rotated = Math.abs(arm.pose.root.parameters.rotationX) + Math.abs(arm.pose.root.parameters.rotationY) + Math.abs(arm.pose.root.parameters.rotationZ)
  assert(rotated > 0.01, `Expected constraint to affect rotation, got ${rotated}`)
})

// ── CopyRotationConstraint ────────────────────────────────────────────────────

test('CopyRotationConstraint: has parameters.influence default 1', () => {
  const src = new PoseBone('src')
  const c   = new CopyRotationConstraint(src)
  approx(c.parameters.influence, 1.0)
})

test('CopyRotationConstraint: parameters.mix=0 for replace by default', () => {
  const src = new PoseBone('src')
  const c   = new CopyRotationConstraint(src)
  approx(c.parameters.mix, 0)
})

test('CopyRotationConstraint: parameters.mix=1 for add mode', () => {
  const src = new PoseBone('src')
  const c   = new CopyRotationConstraint(src, { mix: 'add' })
  approx(c.parameters.mix, 1)
})

test('CopyRotationConstraint: influence=0 does not change rotation', () => {
  const src = new PoseBone('src')
  src.parameters.rotationZ = Math.PI / 2
  src.buildLocalMatrix()
  // Force worldMatrix to have a rotation
  src.worldMatrix.makeRotationZ(Math.PI / 2)

  const dst = new PoseBone('dst')
  const c   = new CopyRotationConstraint(src, { influence: 0 })
  c.apply(dst)
  approx(dst.parameters.rotationX, 0)
  approx(dst.parameters.rotationY, 0)
  approx(dst.parameters.rotationZ, 0)
})

test('CopyRotationConstraint: replace mode copies source rotation at influence=1', () => {
  const src = new PoseBone('src')
  // Directly set worldMatrix to a pure Y rotation
  const angle = Math.PI / 4
  src.worldMatrix.makeRotationY(angle)

  const dst = new PoseBone('dst')
  const c   = new CopyRotationConstraint(src, { influence: 1, mix: 'replace' })
  c.apply(dst)

  // dst rotation should now match a Y rotation of angle
  const q = dst.getQuaternion()
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), angle)
  approx(q.x, expected.x, 0.01)
  approx(q.y, expected.y, 0.01)
  approx(q.z, expected.z, 0.01)
  approx(q.w, expected.w, 0.01)
})

test('CopyRotationConstraint: invert inverts the quaternion', () => {
  const src = new PoseBone('src')
  const angle = Math.PI / 3
  src.worldMatrix.makeRotationY(angle)

  const dst1 = new PoseBone('dst1')
  const dst2 = new PoseBone('dst2')
  new CopyRotationConstraint(src, { influence: 1, invert: false }).apply(dst1)
  new CopyRotationConstraint(src, { influence: 1, invert: true  }).apply(dst2)

  const q1 = dst1.getQuaternion()
  const q2 = dst2.getQuaternion()
  // Inverted quaternion has negated x,y,z (or negated w — just check they differ)
  assert(Math.abs(q1.y - q2.y) > 0.01, `Expected inverted quaternion to differ, y1=${q1.y} y2=${q2.y}`)
})

// ── CopyLocationConstraint ────────────────────────────────────────────────────

test('CopyLocationConstraint: has parameters.influence default 1', () => {
  const src = new PoseBone('src')
  const c   = new CopyLocationConstraint(src)
  approx(c.parameters.influence, 1.0)
})

test('CopyLocationConstraint: all axes enabled by default', () => {
  const src = new PoseBone('src')
  const c   = new CopyLocationConstraint(src)
  approx(c.parameters.axisX, 1)
  approx(c.parameters.axisY, 1)
  approx(c.parameters.axisZ, 1)
})

test('CopyLocationConstraint: influence=0 does not change location', () => {
  const src = new PoseBone('src')
  src.worldMatrix.setPosition(new THREE.Vector3(5, 5, 5))

  const dst = new PoseBone('dst')
  const c   = new CopyLocationConstraint(src, { influence: 0 })
  c.apply(dst, new THREE.Matrix4())
  approx(dst.parameters.locationX, 0)
  approx(dst.parameters.locationY, 0)
  approx(dst.parameters.locationZ, 0)
})

test('CopyLocationConstraint: copies world position at influence=1', () => {
  const src = new PoseBone('src')
  src.worldMatrix.setPosition(new THREE.Vector3(3, 7, 2))

  const dst = new PoseBone('dst')
  const c   = new CopyLocationConstraint(src, { influence: 1 })
  c.apply(dst, new THREE.Matrix4())  // parent = identity, so local = world

  approx(dst.parameters.locationX, 3, 0.01)
  approx(dst.parameters.locationY, 7, 0.01)
  approx(dst.parameters.locationZ, 2, 0.01)
})

test('CopyLocationConstraint: axis masking — only Y copied', () => {
  const src = new PoseBone('src')
  src.worldMatrix.setPosition(new THREE.Vector3(5, 9, 3))

  const dst = new PoseBone('dst')
  dst.parameters.locationX = 1
  dst.parameters.locationZ = 2
  const c = new CopyLocationConstraint(src, { influence: 1, axes: [false, true, false] })
  c.apply(dst, new THREE.Matrix4())

  approx(dst.parameters.locationX, 1, 0.01)   // unchanged
  approx(dst.parameters.locationY, 9, 0.01)   // copied
  approx(dst.parameters.locationZ, 2, 0.01)   // unchanged
})

test('CopyLocationConstraint: offset mode adds to current position', () => {
  const src = new PoseBone('src')
  src.worldMatrix.setPosition(new THREE.Vector3(2, 3, 1))

  const dst = new PoseBone('dst')
  dst.parameters.locationX = 10
  dst.parameters.locationY = 10
  dst.parameters.locationZ = 10
  const c = new CopyLocationConstraint(src, { influence: 1, offset: true })
  c.apply(dst, new THREE.Matrix4())

  approx(dst.parameters.locationX, 12, 0.01)
  approx(dst.parameters.locationY, 13, 0.01)
  approx(dst.parameters.locationZ, 11, 0.01)
})

test('CopyLocationConstraint: partial influence interpolates', () => {
  const src = new PoseBone('src')
  src.worldMatrix.setPosition(new THREE.Vector3(10, 0, 0))

  const dst = new PoseBone('dst')  // starts at 0,0,0
  const c   = new CopyLocationConstraint(src, { influence: 0.5 })
  c.apply(dst, new THREE.Matrix4())

  approx(dst.parameters.locationX, 5, 0.01)
})

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
