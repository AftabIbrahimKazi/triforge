import { strict as assert } from 'assert'
import { BufferGeometry, BufferAttribute } from 'three'
import {
  PlaneCollider,
  SphereCollider,
  CapsuleCollider,
  WindForce,
  ClothSimulator,
  SoftBodySimulator,
  RigidBodyWorld,
  RigidBody,
  BallSocketConstraint,
  ConeTwistConstraint,
} from '../dist/index.js'

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch(e) { console.error(`  ✗ ${name}: ${e.message}`); failed++ }
}
function approx(a, b, tol = 1e-5) {
  assert(Math.abs(a - b) < tol, `Expected ${a} ≈ ${b} (tol ${tol})`)
}

function makeGeometry(segsX, segsY) {
  const cols = segsX + 1, rows = segsY + 1
  const pos = new Float32Array(cols * rows * 3)
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 3
      pos[i] = x / segsX; pos[i+1] = y / segsY; pos[i+2] = 0
    }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  return geo
}

// ── PlaneCollider ─────────────────────────────────────────────────────────────
console.log('\nPlaneCollider')

test('no collision above plane', () => {
  const p = new PlaneCollider()
  assert(p.resolve(0, 1, 0) === null)
})
test('pushes point below ground to surface', () => {
  const p = new PlaneCollider({ point: [0,0,0], normal: [0,1,0] })
  const r = p.resolve(0, -0.5, 0)
  assert(r !== null)
  approx(r[1], 0)
})
test('tilted plane', () => {
  const p = new PlaneCollider({ point: [0,0,0], normal: [1,0,0] })
  const r = p.resolve(-1, 0, 0)
  assert(r !== null)
  approx(r[0], 0)
})
test('disabled collider returns null', () => {
  const p = new PlaneCollider()
  p.enabled = false
  assert(p.resolve(0, -1, 0) === null)
})
test('parameters exposed', () => {
  const p = new PlaneCollider({ friction: 0.3 })
  approx(p.parameters.friction, 0.3)
})

// ── SphereCollider ────────────────────────────────────────────────────────────
console.log('\nSphereCollider')

test('outside sphere — no collision', () => {
  const s = new SphereCollider({ center: [0,0,0], radius: 1 })
  assert(s.resolve(2, 0, 0) === null)
})
test('inside sphere — pushed to surface', () => {
  const s = new SphereCollider({ center: [0,0,0], radius: 1 })
  const r = s.resolve(0.3, 0, 0)
  assert(r !== null)
  const d = Math.sqrt(r[0]**2 + r[1]**2 + r[2]**2)
  approx(d, 1, 1e-4)
})
test('offset center', () => {
  const s = new SphereCollider({ center: [5,0,0], radius: 1 })
  assert(s.resolve(5.5, 0, 0) !== null)
  assert(s.resolve(0, 0, 0) === null)
})
test('disabled collider', () => {
  const s = new SphereCollider()
  s.enabled = false
  assert(s.resolve(0, 0, 0) === null)
})

// ── CapsuleCollider ───────────────────────────────────────────────────────────
console.log('\nCapsuleCollider')

test('outside capsule — no collision', () => {
  const c = new CapsuleCollider({ a: [0,-1,0], b: [0,1,0], radius: 0.5 })
  assert(c.resolve(2, 0, 0) === null)
})
test('inside capsule body — pushed out', () => {
  const c = new CapsuleCollider({ a: [0,-1,0], b: [0,1,0], radius: 0.5 })
  const r = c.resolve(0.2, 0, 0)
  assert(r !== null)
  approx(Math.sqrt(r[0]**2 + r[2]**2), 0.5, 1e-4)
})
test('inside capsule cap — pushed out', () => {
  const c = new CapsuleCollider({ a: [0,-1,0], b: [0,1,0], radius: 0.5 })
  const r = c.resolve(0, 1.3, 0)
  assert(r !== null)
})
test('parameters exposed', () => {
  const c = new CapsuleCollider({ radius: 0.7 })
  approx(c.parameters.radius, 0.7)
})

// ── WindForce ─────────────────────────────────────────────────────────────────
console.log('\nWindForce')

test('default direction X axis', () => {
  const w = new WindForce({ strength: 5, turbulence: 0 })
  const [ax, ay, az] = w.getAcceleration(0, 0, 0, 0)
  approx(ax, 5, 0.01)
  approx(ay, 0, 0.01)
  approx(az, 0, 0.01)
})
test('turbulence changes output', () => {
  const w1 = new WindForce({ strength: 5, turbulence: 0 })
  const w2 = new WindForce({ strength: 5, turbulence: 0.5 })
  const [a1] = w1.getAcceleration(3.7, 1.2, 0.5, 1.0)
  const [a2] = w2.getAcceleration(3.7, 1.2, 0.5, 1.0)
  assert(a1 !== a2)
})
test('advance increments internal time', () => {
  const w = new WindForce()
  w.advance(0.5)
  approx(w.time, 0.5)
  w.advance(0.1)
  approx(w.time, 0.6)
})
test('normalized direction', () => {
  const w = new WindForce({ direction: [3, 4, 0], strength: 5, turbulence: 0 })
  const [ax, ay] = w.getAcceleration(0, 0, 0, 0)
  approx(ax, 3, 0.01)
  approx(ay, 4, 0.01)
})
test('parameters object exposed', () => {
  const w = new WindForce({ strength: 7, turbulence: 0.4, frequency: 2 })
  approx(w.parameters.strength, 7)
  approx(w.parameters.turbulence, 0.4)
  approx(w.parameters.frequency, 2)
})

// ── ClothSimulator ────────────────────────────────────────────────────────────
console.log('\nClothSimulator')

test('vertex count correct', () => {
  const c = new ClothSimulator(4, 4)
  assert(c.vertexCount === 25)
})
test('setFromGeometry — positions read', () => {
  const c = new ClothSimulator(2, 2)
  c.setFromGeometry(makeGeometry(2, 2))
  const p = c.getPositions()
  approx(p[0], 0)
  approx(p[3], 0.5)
})
test('pinRow pins top row', () => {
  const c = new ClothSimulator(4, 4)
  c.pinRow(4)
  for (let x = 0; x <= 4; x++) assert(c.isPinned(4 * 5 + x))
  assert(!c.isPinned(0))
})
test('pinColumn pins first column', () => {
  const c = new ClothSimulator(4, 4)
  c.pinColumn(0)
  for (let y = 0; y <= 4; y++) assert(c.isPinned(y * 5))
})
test('pinned vertices do not move', () => {
  const c = new ClothSimulator(4, 4, { substeps: 1, iterations: 1 })
  c.setFromGeometry(makeGeometry(4, 4))
  c.pin(0)
  const y0 = c.getPositions()[1]
  c.step(1/60)
  approx(c.getPositions()[1], y0)
})
test('gravity pulls free vertices down', () => {
  const c = new ClothSimulator(2, 2, { substeps: 1, iterations: 0 })
  c.setFromGeometry(makeGeometry(2, 2))
  const y0 = c.getPositions()[1]
  c.step(0.1)
  assert(c.getPositions()[1] < y0)
})
test('floor collider prevents penetration', () => {
  const c = new ClothSimulator(2, 2, { substeps: 4, iterations: 4, gravity: 9.8 })
  c.setFromGeometry(makeGeometry(2, 2))
  const floor = new PlaneCollider({ point: [0,-3,0], normal: [0,1,0] })
  c.addCollider(floor)
  for (let i = 0; i < 120; i++) c.step(1/60)
  const p = c.getPositions()
  for (let v = 0; v < c.vertexCount; v++) {
    assert(p[v*3+1] >= -3 - 0.01, `vertex ${v} below floor: y=${p[v*3+1]}`)
  }
})
test('sphere collider pushes cloth out', () => {
  const c = new ClothSimulator(4, 4, { substeps: 4, iterations: 8, gravity: 0 })
  // place cloth at z=0 plane passing through sphere center offset — all particles offset from center
  const arr = new Array(c.vertexCount * 3).fill(0)
  for (let v = 0; v < c.vertexCount; v++) {
    arr[v*3]   = 0.1 + v * 0.01  // slight X offset so normal is defined
    arr[v*3+1] = 0
    arr[v*3+2] = 0
  }
  c.setFromArray(arr)
  const sphere = new SphereCollider({ center: [0,0,0], radius: 2 })
  c.addCollider(sphere)
  for (let i = 0; i < 30; i++) c.step(1/60)
  const p = c.getPositions()
  for (let v = 0; v < c.vertexCount; v++) {
    const x = p[v*3], y = p[v*3+1], z = p[v*3+2]
    const d = Math.sqrt(x*x + y*y + z*z)
    assert(d >= 2 - 0.05, `vertex ${v} inside sphere: d=${d}`)
  }
})
test('apply writes positions to geometry', () => {
  const c = new ClothSimulator(2, 2)
  const geo = makeGeometry(2, 2)
  c.setFromGeometry(geo)
  c.step(1/60)
  c.apply(geo)
  const attr = geo.getAttribute('position')
  assert(attr.getY(0) < 0)
})
test('setPosition teleports particle', () => {
  const c = new ClothSimulator(2, 2)
  c.setFromGeometry(makeGeometry(2, 2))
  c.setPosition(0, 99, 88, 77)
  const p = c.getPositions()
  approx(p[0], 99); approx(p[1], 88); approx(p[2], 77)
})
test('setFromArray seeds positions', () => {
  const c = new ClothSimulator(2, 2)
  const arr = new Array(c.vertexCount * 3).fill(0)
  arr[0] = 5; arr[1] = 6; arr[2] = 7
  c.setFromArray(arr)
  approx(c.getPositions()[0], 5)
  approx(c.getPositions()[1], 6)
})
test('time advances with step', () => {
  const c = new ClothSimulator(2, 2)
  c.setFromGeometry(makeGeometry(2, 2))
  c.step(0.5)
  approx(c.time, 0.5)
  c.step(0.25)
  approx(c.time, 0.75)
})
test('wind pushes cloth', () => {
  const c = new ClothSimulator(2, 2, { substeps: 1, iterations: 0, gravity: 0 })
  c.setFromGeometry(makeGeometry(2, 2))
  const w = new WindForce({ direction: [1,0,0], strength: 10, turbulence: 0 })
  c.setWind(w)
  const x0 = c.getPositions()[0]
  c.step(0.1)
  assert(c.getPositions()[0] > x0)
})
test('removeCollider and clearColliders', () => {
  const c = new ClothSimulator(2, 2)
  const p = new PlaneCollider()
  c.addCollider(p)
  c.removeCollider(p)
  c.clearColliders()
  assert(true)
})
test('unpin restores movement', () => {
  const c = new ClothSimulator(2, 2, { substeps: 1, iterations: 0 })
  c.setFromGeometry(makeGeometry(2, 2))
  c.pin(0)
  c.unpin(0)
  const y0 = c.getPositions()[1]
  c.step(0.1)
  assert(c.getPositions()[1] < y0)
})

// ── SoftBodySimulator ─────────────────────────────────────────────────────

console.log('\nSoftBodySimulator')

test('SoftBodySimulator: constructs with defaults', () => {
  const sb = new SoftBodySimulator()
  assert(sb.parameters.stiffness === 0.9)
  assert(sb.parameters.gravity === 9.8)
})

test('SoftBodySimulator: setFromGeometry builds springs', () => {
  const sb = new SoftBodySimulator()
  const geo = makeGeometry(2, 2)
  // Add index for a simple 2x2 grid
  geo.setIndex([0,1,3, 0,3,2, 1,4,3, 2,3,5, 3,4,6, 4,7,6, 4,5,8, 5,6,8])  // rough tris
  sb.setFromGeometry(geo)
  assert(sb.vertexCount === 9)
})

test('SoftBodySimulator: step() falls under gravity', () => {
  const sb = new SoftBodySimulator({ substeps: 1, iterations: 0 })
  const geo = makeGeometry(1, 1)
  geo.setIndex([0,1,2, 1,3,2])
  sb.setFromGeometry(geo)
  const y0 = sb['_pos'][1]
  sb.step(0.1)
  assert(sb['_pos'][1] < y0, 'particle fell')
})

test('SoftBodySimulator: pinned vertex does not move', () => {
  const sb = new SoftBodySimulator({ substeps: 1, iterations: 0 })
  const geo = makeGeometry(1, 1)
  geo.setIndex([0,1,2, 1,3,2])
  sb.setFromGeometry(geo)
  sb.pin(0)
  const y0 = sb['_pos'][1]
  sb.step(0.1)
  assert(sb['_pos'][1] === y0, 'pinned vertex did not move')
})

test('SoftBodySimulator: apply() updates geometry', () => {
  const sb = new SoftBodySimulator({ substeps: 1, iterations: 0 })
  const geo = makeGeometry(1, 1)
  geo.setIndex([0,1,2, 1,3,2])
  sb.setFromGeometry(geo)
  const y0 = geo.getAttribute('position').getY(0)
  sb.step(0.1)
  sb.apply(geo)
  const y1 = geo.getAttribute('position').getY(0)
  assert(y1 < y0, 'position attribute was written back')
})

test('SoftBodySimulator: collider pushes vertex back', () => {
  const sb = new SoftBodySimulator({ substeps: 2, iterations: 1, gravity: 50 })
  const geo = makeGeometry(1, 1)
  geo.setIndex([0,1,2, 1,3,2])
  sb.setFromGeometry(geo)
  const floor = new PlaneCollider()
  sb.addCollider(floor)
  sb.step(0.5)
  // floor at y=0 — all y coords should be >= 0
  for (let i = 0; i < sb.vertexCount; i++) {
    assert(sb['_pos'][i*3+1] >= -0.001)
  }
})

// ── RigidBodyWorld ────────────────────────────────────────────────────────

console.log('\nRigidBodyWorld')

test('RigidBodyWorld: constructs and exposes parameters', () => {
  const w = new RigidBodyWorld()
  assert(w.parameters.gravityY === -9.8)
  assert(w.bodies.length === 0)
})

test('RigidBodyWorld: createBody adds to bodies list', () => {
  const w = new RigidBodyWorld()
  const b = w.createBody({ shape: 'sphere', mass: 1 })
  assert(w.bodies.length === 1)
  assert(b instanceof RigidBody)
})

test('RigidBodyWorld: removeBody removes from list', () => {
  const w = new RigidBodyWorld()
  const b = w.createBody()
  w.removeBody(b)
  assert(w.bodies.length === 0)
})

test('RigidBodyWorld: static body does not move under gravity', () => {
  const w = new RigidBodyWorld()
  const floor = w.createBody({ mass: 0, shape: 'box', position: [0,-1,0] })
  const y0 = floor.position.y
  w.step(0.1)
  assert(floor.position.y === y0)
})

test('RigidBodyWorld: dynamic sphere falls under gravity', () => {
  const w = new RigidBodyWorld({ gravity: [0,-9.8,0] })
  const ball = w.createBody({ shape: 'sphere', mass: 1, position: [0, 10, 0] })
  const y0 = ball.position.y
  w.step(0.1)
  assert(ball.position.y < y0, 'ball fell')
})

test('RigidBodyWorld: sphere–sphere collision resolves overlap', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ shape: 'sphere', mass: 1, size: 1, position: [0,0,0] })
  const b = w.createBody({ shape: 'sphere', mass: 1, size: 1, position: [1,0,0] })
  // Initially overlapping (distance 1, sum of radii 2)
  w.step(0.016)
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  const dz = b.position.z - a.position.z
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
  assert(dist > 1, `spheres separated, dist=${dist.toFixed(3)}`)
})

test('RigidBodyWorld: applyForce accelerates body', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const b = w.createBody({ shape: 'sphere', mass: 1, position: [0,0,0] })
  b.applyForce(100, 0, 0)
  w.step(0.1)
  assert(b.position.x > 0, 'body moved in +X from force')
})

test('RigidBodyWorld: applyImpulse changes velocity immediately', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const b = w.createBody({ shape: 'sphere', mass: 1 })
  b.applyImpulse(5, 0, 0)
  assert(b.velocity.x === 5)
})

test('RigidBodyWorld: box shape has correct bounding radius', () => {
  const b = new RigidBody({ shape: 'box', size: [1, 2, 3] })
  const r = Math.sqrt(1+4+9)
  approx(b.boundingRadius, r, 0.001)
})

test('RigidBodyWorld: capsule shape bounding radius includes halfHeight', () => {
  const b = new RigidBody({ shape: 'capsule', size: 0.5, halfHeight: 2 })
  assert(b.boundingRadius === 2.5)
})

// ── BallSocketConstraint ──────────────────────────────────────────────────────

console.log('\nBallSocketConstraint')

test('BallSocketConstraint: type is ballsocket', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ shape: 'sphere', mass: 1, position: [0,0,0] })
  const b = w.createBody({ shape: 'sphere', mass: 1, position: [2,0,0] })
  const c = new BallSocketConstraint(a, b, [1,0,0])
  assert(c.type === 'ballsocket')
})

test('BallSocketConstraint: parameters exposed', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [1,0,0] })
  const c = new BallSocketConstraint(a, b, [0.5,0,0], { stiffness: 0.5, damping: 0.2 })
  approx(c.parameters.stiffness, 0.5)
  approx(c.parameters.damping, 0.2)
})

test('BallSocketConstraint: enabled flag prevents solve', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [10,0,0] })
  const c = new BallSocketConstraint(a, b, [5,0,0])
  c.enabled = false
  const bx0 = b.position.x
  c.solve()
  approx(b.position.x, bx0)  // no movement when disabled
})

test('BallSocketConstraint: corrects anchor point mismatch between bodies', () => {
  // Two bodies start at rest. Then one is displaced. Constraint should pull it back.
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [2,0,0] })
  const c = new BallSocketConstraint(a, b, [1,0,0])
  w.addConstraint(c)
  // Teleport b far away to create anchor mismatch
  b.position.set(8, 0, 0)
  const dist0 = b.position.distanceTo(a.position)
  for (let i = 0; i < 10; i++) w.step(0.016)
  const dist1 = b.position.distanceTo(a.position)
  assert(dist1 < dist0, `anchor mismatch should be corrected: was ${dist0.toFixed(3)}, now ${dist1.toFixed(3)}`)
})

test('BallSocketConstraint: one static body — only dynamic body moves', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 0, position: [0,0,0] })   // static
  const b = w.createBody({ mass: 1, position: [2,0,0] })
  // Pivot at a's position; b's anchor should coincide with pivot
  const c = new BallSocketConstraint(a, b, [0,0,0])
  w.addConstraint(c)
  // Displace b to create mismatch
  b.position.set(8, 0, 0)
  const ax0 = a.position.x
  const bx0 = b.position.x
  for (let i = 0; i < 20; i++) w.step(0.016)
  approx(a.position.x, ax0)       // static must not move
  assert(b.position.x < bx0, 'dynamic body moved toward pivot')
})

test('BallSocketConstraint: pivot getter returns correct Vector3', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [2,0,0] })
  const c = new BallSocketConstraint(a, b, [1,2,3])
  approx(c.pivot.x, 1); approx(c.pivot.y, 2); approx(c.pivot.z, 3)
})

// ── ConeTwistConstraint ───────────────────────────────────────────────────────

console.log('\nConeTwistConstraint')

test('ConeTwistConstraint: type is conetwist', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [2,0,0] })
  const c = new ConeTwistConstraint(a, b, [1,0,0], [0,1,0])
  assert(c.type === 'conetwist')
})

test('ConeTwistConstraint: parameters exposed with defaults', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [1,0,0] })
  const c = new ConeTwistConstraint(a, b, [0.5,0,0], [0,1,0])
  approx(c.parameters.stiffness, 0.8)
  approx(c.parameters.damping, 0.1)
  approx(c.parameters.swingLimit, Math.PI / 4, 1e-4)
  approx(c.parameters.twistLimit, Math.PI / 6, 1e-4)
})

test('ConeTwistConstraint: custom parameters stored', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [1,0,0] })
  const c = new ConeTwistConstraint(a, b, [0.5,0,0], [0,1,0], {
    stiffness: 0.6, damping: 0.05, swingLimit: 0.3, twistLimit: 0.1,
  })
  approx(c.parameters.swingLimit, 0.3)
  approx(c.parameters.twistLimit, 0.1)
})

test('ConeTwistConstraint: enabled=false skips solve', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [10,0,0] })
  const c = new ConeTwistConstraint(a, b, [5,0,0], [0,1,0])
  c.enabled = false
  const bx0 = b.position.x
  c.solve()
  approx(b.position.x, bx0)
})

test('ConeTwistConstraint: corrects anchor mismatch between bodies', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [2,0,0] })
  const c = new ConeTwistConstraint(a, b, [1,0,0], [0,1,0])
  w.addConstraint(c)
  b.position.set(8, 0, 0)
  const dist0 = b.position.distanceTo(a.position)
  for (let i = 0; i < 10; i++) w.step(0.016)
  const dist1 = b.position.distanceTo(a.position)
  assert(dist1 < dist0, `anchor mismatch should be corrected: was ${dist0.toFixed(3)}, now ${dist1.toFixed(3)}`)
})

test('ConeTwistConstraint: axis getter is unit vector', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [1,0,0] })
  const c = new ConeTwistConstraint(a, b, [0.5,0,0], [3,4,0])
  approx(c.axis.length(), 1, 1e-6)
})

test('ConeTwistConstraint: both static bodies — solve is no-op for position', () => {
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 0, position: [0,0,0] })
  const b = w.createBody({ mass: 0, position: [5,0,0] })
  const c = new ConeTwistConstraint(a, b, [2.5,0,0], [0,1,0])
  const ax0 = a.position.x, bx0 = b.position.x
  c.solve()
  approx(a.position.x, ax0)
  approx(b.position.x, bx0)
})

test('ConeTwistConstraint: AnyConstraint union includes new types', () => {
  // Type-level test — just verify the objects can be added to the world constraint list
  const w = new RigidBodyWorld({ gravity: [0,0,0] })
  const a = w.createBody({ mass: 1, position: [0,0,0] })
  const b = w.createBody({ mass: 1, position: [1,0,0] })
  const bs = new BallSocketConstraint(a, b, [0.5,0,0])
  const ct = new ConeTwistConstraint(a, b, [0.5,0,0], [0,1,0])
  w.addConstraint(bs)
  w.addConstraint(ct)
  assert(w.constraints.length === 2)
})

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
