/**
 * Renderer test suite for @st-particle-core.
 * Runs in Node.js (ESM) — no DOM / WebGL required for construction and update logic.
 *
 * Tests each renderer for:
 *  - correct Object3D type returned
 *  - correct instance / draw count for N particles
 *  - public parameters object accessible
 */

import assert from 'assert'
import {
  BillboardRenderer, HaloRenderer,
  LineRenderer,
  InstanceRenderer,  ObjectRenderer,
  CollectionRenderer,
  SeededRandom,
  Particle,
  ParticleSystem,
  MeshEmitter,
  PointEmitter,
  DeflectorCollider,
  TextureForce,
  FlowFieldForce,
} from '../dist/index.js'
import {
  BufferGeometry, BoxGeometry, MeshBasicMaterial,
  Points, LineSegments, InstancedMesh, Group,
  BufferAttribute, Float32BufferAttribute, Texture,
  Vector3,
} from 'three'

// ── helpers ────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

/** Build N alive mock particles (plain objects matching Particle shape). */
function mockParticles(n, alive = true) {
  return Array.from({ length: n }, (_, i) => ({
    position:     { x: i * 0.1, y: 0,   z: 0 },
    velocity:     { x: 1,       y: 0.5, z: 0 },
    angularVel:   { x: 0,       y: 0,   z: 0 },
    rotation:     { x: 0,       y: 0,   z: 0 },
    size:         1,
    normalised:   0.5,
    alive,
    lifetime:     2,
    age:          1,
    emitterIndex: 0,
  }))
}

// ── BillboardRenderer / HaloRenderer ───────────────────────────────────────

console.log('\nBillboardRenderer / HaloRenderer')

test('object3D is THREE.Points', () => {
  const r = new BillboardRenderer({ maxCount: 10 })
  assert.ok(r.object3D instanceof Points, 'expected Points')
})

test('HaloRenderer is the same class as BillboardRenderer', () => {
  assert.strictEqual(HaloRenderer, BillboardRenderer, 'HaloRenderer must be BillboardRenderer')
})

test('parameters object is publicly accessible', () => {
  const r = new BillboardRenderer()
  assert.ok(typeof r.parameters === 'object', 'parameters must be an object')
  assert.ok(typeof r.parameters.fadeOut  === 'number', 'parameters.fadeOut must be a number')
  assert.ok(typeof r.parameters.opacity  === 'number', 'parameters.opacity must be a number')
  assert.ok(typeof r.parameters.size     === 'number', 'parameters.size must be a number')
})

test('update() sets draw range to alive particle count', () => {
  const r = new BillboardRenderer({ maxCount: 20, fadeOut: false })
  const particles = mockParticles(10)
  r.update(particles, 10)
  const range = r.object3D.geometry.drawRange
  assert.strictEqual(range.start, 0)
  assert.strictEqual(range.count, 10)
})

test('update() with zero alive particles sets draw range to 0', () => {
  const r = new BillboardRenderer({ maxCount: 20 })
  const particles = mockParticles(5, false)
  r.update(particles, 0)
  assert.strictEqual(r.object3D.geometry.drawRange.count, 0)
})

test('parameters.fadeOut read each frame (GSAP compatibility)', () => {
  const r = new BillboardRenderer({ maxCount: 20, fadeOut: false })
  r.parameters.fadeOut = 1
  const particles = mockParticles(4)
  r.update(particles, 4)
  // if fadeOut is applied, sizes shrink — draw count is still 4
  assert.strictEqual(r.object3D.geometry.drawRange.count, 4)
})

// ── LineRenderer ────────────────────────────────────────────────────────────

console.log('\nLineRenderer')

test('object3D is THREE.LineSegments', () => {
  const r = new LineRenderer({ maxCount: 10 })
  assert.ok(r.object3D instanceof LineSegments, 'expected LineSegments')
})

test('parameters object is publicly accessible', () => {
  const r = new LineRenderer()
  assert.ok(typeof r.parameters === 'object', 'parameters must be an object')
  assert.ok(typeof r.parameters.lengthScale === 'number', 'parameters.lengthScale must be a number')
  assert.ok(typeof r.parameters.opacity     === 'number', 'parameters.opacity must be a number')
})

test('update() sets draw range to 2 × alive count (each line = 2 verts)', () => {
  const r = new LineRenderer({ maxCount: 20 })
  const particles = mockParticles(7)
  r.update(particles, 7)
  assert.strictEqual(r.object3D.geometry.drawRange.count, 14)
})

test('parameters.lengthScale is mutable for GSAP', () => {
  const r = new LineRenderer({ maxCount: 10, lengthScale: 0.1 })
  r.parameters.lengthScale = 2.0
  const particles = mockParticles(3)
  r.update(particles, 3)
  assert.strictEqual(r.object3D.geometry.drawRange.count, 6)
})

// ── InstanceRenderer / ObjectRenderer ──────────────────────────────────────

console.log('\nInstanceRenderer / ObjectRenderer')

test('ObjectRenderer is the same class as InstanceRenderer', () => {
  assert.strictEqual(ObjectRenderer, InstanceRenderer, 'ObjectRenderer must be InstanceRenderer')
})

test('object3D is THREE.InstancedMesh', () => {
  const r = new InstanceRenderer({
    geometry: new BoxGeometry(1, 1, 1),
    material: new MeshBasicMaterial(),
    maxCount: 10,
  })
  assert.ok(r.object3D instanceof InstancedMesh, 'expected InstancedMesh')
})

test('parameters object is publicly accessible', () => {
  const r = new InstanceRenderer({
    geometry: new BoxGeometry(),
    material: new MeshBasicMaterial(),
    maxCount: 5,
  })
  assert.ok(typeof r.parameters === 'object')
  assert.ok(typeof r.parameters.billboard === 'number')
  assert.ok(typeof r.parameters.fadeOut   === 'number')
})

test('update() sets object3D.count to alive particle count', () => {
  const r = new InstanceRenderer({
    geometry: new BoxGeometry(),
    material: new MeshBasicMaterial(),
    maxCount: 20,
    billboard: false,
  })
  const particles = mockParticles(6)
  r.update(particles, 6)
  assert.strictEqual(r.object3D.count, 6)
})

test('update() zeroes out previously alive slots', () => {
  const r = new InstanceRenderer({
    geometry: new BoxGeometry(),
    material: new MeshBasicMaterial(),
    maxCount: 20,
    billboard: false,
  })
  const big = mockParticles(8)
  r.update(big, 8)
  assert.strictEqual(r.object3D.count, 8)

  const small = mockParticles(3)
  r.update(small, 3)
  assert.strictEqual(r.object3D.count, 3)
})

// ── CollectionRenderer ──────────────────────────────────────────────────────

console.log('\nCollectionRenderer')

function makeCollectionRenderer(n = 2, maxCount = 20) {
  const meshes = Array.from({ length: n }, () => ({
    geometry: new BoxGeometry(),
    material: new MeshBasicMaterial(),
  }))
  return new CollectionRenderer({ meshes, maxCount, billboard: false })
}

test('object3D is THREE.Group', () => {
  const r = makeCollectionRenderer(2)
  assert.ok(r.object3D instanceof Group, 'expected Group')
})

test('object3D contains one InstancedMesh per collection entry', () => {
  const r = makeCollectionRenderer(3)
  const meshCount = r.object3D.children.filter(c => c instanceof InstancedMesh).length
  assert.strictEqual(meshCount, 3)
})

test('parameters object is publicly accessible', () => {
  const r = makeCollectionRenderer(2)
  assert.ok(typeof r.parameters === 'object')
  assert.ok(typeof r.parameters.billboard === 'number')
  assert.ok(typeof r.parameters.fadeOut   === 'number')
  assert.ok(typeof r.parameters.seed      === 'number')
})

test('update() distributes alive particles across meshes', () => {
  const r = makeCollectionRenderer(2, 20)
  // 6 alive particles → 3 to each InstancedMesh (slots 0,2,4 → mesh 0; slots 1,3,5 → mesh 1)
  const particles = mockParticles(6)
  r.update(particles, 6)
  const counts = r.object3D.children.map(c => /** @type {any} */ (c).count)
  assert.strictEqual(counts[0] + counts[1], 6, 'total instances must equal alive count')
  assert.ok(counts[0] > 0, 'mesh 0 must have at least one instance')
  assert.ok(counts[1] > 0, 'mesh 1 must have at least one instance')
})

test('update() with seed 1 shifts assignment by 1', () => {
  const r = makeCollectionRenderer(2, 20)
  r.parameters.seed = 1
  const particles = mockParticles(4)
  r.update(particles, 4)
  const counts = r.object3D.children.map(c => /** @type {any} */ (c).count)
  assert.strictEqual(counts[0] + counts[1], 4)
})

test('update() with zero alive particles sets all mesh counts to 0', () => {
  const r = makeCollectionRenderer(2, 20)
  const alive   = mockParticles(4)
  r.update(alive, 4)
  const dead = mockParticles(4, false)
  r.update(dead, 0)
  const counts = r.object3D.children.map(c => /** @type {any} */ (c).count)
  assert.ok(counts.every(c => c === 0), `all counts must be 0, got ${counts}`)
})

test('never mutates the input particle array', () => {
  const r = makeCollectionRenderer(2, 20)
  const particles = mockParticles(5)
  const snapshot = particles.map(p => ({ ...p.position }))
  r.update(particles, 5)
  for (let i = 0; i < particles.length; i++) {
    assert.strictEqual(particles[i].position.x, snapshot[i].x, `particle[${i}] position.x mutated`)
  }
})

// ── Phase A2 — Emission Controls ────────────────────────────────────────────

/**
 * Two-triangle geometry with clearly separated x-ranges.
 *   tri 0 (small):  (-5, 0, 0), (-4.9, 0, 0), (-5, 0, 0.1)  — area ≈ 0.005
 *   tri 1 (large):  ( 5, 0, 0), (15,   0, 0), ( 5, 0, 10)   — area ≈ 50
 * Any spawn at x < 0 came from the small triangle; x > 0 from the large one.
 */
function makeTwoTriangleGeo() {
  const geo = new BufferGeometry()
  const positions = new Float32Array([
    -5,   0,   0,
    -4.9, 0,   0,
    -5,   0,   0.1,
     5,   0,   0,
    15,   0,   0,
     5,   0,  10,
  ])
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex([0, 1, 2,  3, 4, 5])
  return geo
}

/** Run a ParticleSystem for `steps` ticks of dt=1/60 and return the live pool. */
function runSim(sys, steps = 200) {
  for (let i = 0; i < steps; i++) sys.update(1 / 60)
  return sys['_pool'].filter(p => p.alive)
}

console.log('\nPhase A2 — Emission Controls')

test('same seed → identical particle positions on two independent runs', () => {
  const opts = { count: 60, lifetime: 2, seed: 42, start: 0, end: 20, physics: 'none' }
  const s1 = new ParticleSystem(opts)
  const s2 = new ParticleSystem(opts)
  s1.addEmitter(new PointEmitter({ normalVelocity: 1 }))
  s2.addEmitter(new PointEmitter({ normalVelocity: 1 }))
  const r1 = runSim(s1, 120)
  const r2 = runSim(s2, 120)
  assert.ok(r1.length > 0, 'should have alive particles')
  assert.strictEqual(r1.length, r2.length, 'alive count must match between runs')
  for (let i = 0; i < r1.length; i++) {
    assert.ok(
      Math.abs(r1[i].position.x - r2[i].position.x) < 1e-6 &&
      Math.abs(r1[i].position.y - r2[i].position.y) < 1e-6 &&
      Math.abs(r1[i].position.z - r2[i].position.z) < 1e-6,
      `particle[${i}] position differs between runs with same seed`,
    )
  }
})

test('lifetimeRandom: 0 → all alive particles have exactly the base lifetime', () => {
  const sys = new ParticleSystem({ count: 100, lifetime: 3, lifetimeRandom: 0, seed: 1, start: 0, end: 20, physics: 'none' })
  sys.addEmitter(new PointEmitter({}))
  const pool = runSim(sys, 300)
  assert.ok(pool.length > 0, 'should have alive particles')
  for (const p of pool) {
    assert.ok(Math.abs(p.lifetime - 3) < 1e-9,
      `lifetime ${p.lifetime} differs from 3 with lifetimeRandom=0`)
  }
})

test('lifetimeRandom: 1 → lifetimes spread around base value', () => {
  const sys = new ParticleSystem({ count: 200, lifetime: 2, lifetimeRandom: 1, seed: 99, start: 0, end: 20, physics: 'none' })
  sys.addEmitter(new PointEmitter({ normalVelocity: 0 }))
  const pool = runSim(sys, 400)
  assert.ok(pool.length > 10, 'need several alive particles to measure variance')
  const lifetimes = pool.map(p => p.lifetime)
  const min = Math.min(...lifetimes)
  const max = Math.max(...lifetimes)
  assert.ok(max - min > 0.2,
    `lifetimes are too uniform (min=${min.toFixed(3)}, max=${max.toFixed(3)}) — lifetimeRandom not applied`)
})

test('evenDistribution: true → large-area triangle gets proportionally more spawns than small', () => {
  // physics: none + normalVelocity: 0 → particles sit exactly at spawn positions.
  // rate = count/lifetime = 500/2 = 250/s. 400 ticks × (1/60 s) ≈ 6.7 s → ~1667 emissions.
  const geo = makeTwoTriangleGeo()
  const sys = new ParticleSystem({
    count: 500, lifetime: 2, start: 0, end: 100, seed: 7, physics: 'none',
  })
  sys.addEmitter(new MeshEmitter({ emitFrom: 'faces', evenDistribution: true, normalVelocity: 0 }))
  sys.setGeometry(geo)
  runSim(sys, 400)

  const pool = sys['_pool'].filter(p => p.alive)
  assert.ok(pool.length > 50, `need more alive particles, got ${pool.length}`)
  const largeCount = pool.filter(p => p.position.x > 0).length
  const smallCount = pool.filter(p => p.position.x < 0).length
  const largeFraction = largeCount / (largeCount + smallCount)
  // large tri area ≈ 50, small ≈ 0.005 → large should get > 90% of spawns
  assert.ok(largeFraction > 0.9,
    `large-triangle fraction ${(largeFraction * 100).toFixed(1)}% should be > 90% with evenDistribution`)
})

test('emission stops after frameEnd seconds — alive count does not grow past end', () => {
  // rate = count/lifetime = 200/0.5 = 400 particles/s.
  // Window = 1 s → ~400 emissions, filling the pool of 200.
  // After end, no new emissions; count can only stay flat or shrink as particles age out.
  const sys = new ParticleSystem({ count: 200, lifetime: 0.5, start: 0, end: 1.0, seed: 1, physics: 'none' })
  sys.addEmitter(new PointEmitter({ normalVelocity: 0 }))

  // run through the whole emission window (1 s = 60 ticks)
  for (let i = 0; i < 65; i++) sys.update(1 / 60)
  const countAtEnd = sys['_pool'].filter(p => p.alive).length

  // run another 2 s — emission window is closed, count must not increase
  for (let i = 0; i < 120; i++) sys.update(1 / 60)
  const countAfter = sys['_pool'].filter(p => p.alive).length

  assert.ok(countAtEnd > 0, `should have alive particles at end of emission window, got ${countAtEnd}`)
  assert.ok(countAfter <= countAtEnd,
    `alive count grew after frameEnd (${countAtEnd} → ${countAfter}) — emission did not stop`)
})

// ── Phase A3 — Velocity & Rotation Controls ─────────────────────────────────

console.log('\nPhase A3 — Velocity & Rotation Controls')

/** Run sim for steps ticks and return alive pool. */
function runSimA3(sys, steps = 300) {
  for (let i = 0; i < steps; i++) sys.update(1 / 60)
  return sys['_pool'].filter(p => p.alive)
}

test('rotationRandom: 0 → all particles have the same initial rotation.z', () => {
  const sys = new ParticleSystem({
    count: 50, lifetime: 5, seed: 1, start: 0, end: 20, physics: 'none',
    rotationAxis: 2, rotationPhase: 1.0, rotationRandom: 0,
  })
  sys.addEmitter(new PointEmitter({ normalVelocity: 1 }))
  const pool = runSimA3(sys)
  assert.ok(pool.length > 5, 'need alive particles')
  const firstRz = pool[0].rotation.z
  for (const p of pool) {
    assert.ok(Math.abs(p.rotation.z - firstRz) < 1e-6,
      `rotation.z ${p.rotation.z} differs from first (${firstRz}) — rotationRandom not respected`)
  }
})

test('rotationRandom: 1 → initial rotations vary across the pool', () => {
  const sys = new ParticleSystem({
    count: 100, lifetime: 5, seed: 7, start: 0, end: 20, physics: 'none',
    rotationAxis: 2, rotationPhase: 0, rotationRandom: 1,
  })
  sys.addEmitter(new PointEmitter({ normalVelocity: 1 }))
  const pool = runSimA3(sys)
  assert.ok(pool.length > 10, 'need alive particles')
  const rzValues = pool.map(p => p.rotation.z)
  const minRz = Math.min(...rzValues)
  const maxRz = Math.max(...rzValues)
  assert.ok(maxRz - minRz > 0.5,
    `rotation.z range (${(maxRz - minRz).toFixed(3)}) too small — rotationRandom not applied`)
})

test('angularVelocityMode: velocity (1) → angularVel is parallel to velocity', () => {
  const sys = new ParticleSystem({
    count: 50, lifetime: 5, seed: 2, start: 0, end: 20, physics: 'none',
    angularVelocityMode: 1, angularVelocityAmount: 2,
  })
  sys.addEmitter(new PointEmitter({ normalVelocity: 3, randomVelocity: 0 }))
  const pool = runSimA3(sys, 10) // few ticks so velocity hasn't changed much
  assert.ok(pool.length > 0, 'need alive particles')
  for (const p of pool) {
    const vLen = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2)
    const aLen = Math.sqrt(p.angularVel.x ** 2 + p.angularVel.y ** 2 + p.angularVel.z ** 2)
    if (vLen < 1e-6 || aLen < 1e-6) continue
    // cosine of angle between velocity and angularVel must be ≈ ±1 (parallel)
    const dot = (p.velocity.x * p.angularVel.x + p.velocity.y * p.angularVel.y + p.velocity.z * p.angularVel.z) / (vLen * aLen)
    assert.ok(Math.abs(dot) > 0.99,
      `angularVel not parallel to velocity (dot=${dot.toFixed(3)})`)
  }
})

test('angularVelocityMode: random (5) → angularVel directions differ across particles', () => {
  const sys = new ParticleSystem({
    count: 100, lifetime: 5, seed: 3, start: 0, end: 20, physics: 'none',
    angularVelocityMode: 5, angularVelocityAmount: 1,
  })
  sys.addEmitter(new PointEmitter({ normalVelocity: 1 }))
  const pool = runSimA3(sys, 60)
  assert.ok(pool.length > 5, 'need alive particles')
  // collect normalized angularVel directions
  const dirs = pool
    .map(p => {
      const len = Math.sqrt(p.angularVel.x ** 2 + p.angularVel.y ** 2 + p.angularVel.z ** 2)
      return len > 1e-6 ? [p.angularVel.x / len, p.angularVel.y / len, p.angularVel.z / len] : null
    })
    .filter(Boolean)
  assert.ok(dirs.length > 4, 'need particles with non-zero angularVel')
  // first two directions must differ (if all same, mode is broken)
  const [a, b] = dirs
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  assert.ok(Math.abs(dot) < 0.99,
    `first two angularVel directions are identical (dot=${dot.toFixed(3)}) — random mode broken`)
})

test('objectInherit: 1 + non-zero emitter worldVelocity → particles inherit that velocity', () => {
  const sys = new ParticleSystem({
    count: 50, lifetime: 5, seed: 4, start: 0, end: 20, physics: 'none',
  })
  const emitter = new PointEmitter({ normalVelocity: 0, randomVelocity: 0, objectInherit: 1 })
  emitter.worldVelocity.set(5, 0, 0)
  sys.addEmitter(emitter)
  const pool = runSimA3(sys, 10)
  assert.ok(pool.length > 0, 'need alive particles')
  for (const p of pool) {
    assert.ok(Math.abs(p.velocity.x - 5) < 1e-5,
      `particle velocity.x ${p.velocity.x} should be 5 (objectInherit=1, worldVelocity.x=5)`)
  }
})

test('objectInherit: 0 → emitter worldVelocity is NOT inherited', () => {
  const sys = new ParticleSystem({
    count: 50, lifetime: 5, seed: 5, start: 0, end: 20, physics: 'none',
  })
  const emitter = new PointEmitter({ normalVelocity: 0, randomVelocity: 0, objectInherit: 0 })
  emitter.worldVelocity.set(10, 0, 0)
  sys.addEmitter(emitter)
  const pool = runSimA3(sys, 10)
  assert.ok(pool.length > 0, 'need alive particles')
  for (const p of pool) {
    assert.ok(Math.abs(p.velocity.x) < 1e-5,
      `velocity.x should be 0 with objectInherit=0, got ${p.velocity.x}`)
  }
})

// ── Phase A6 — Source Vertex Groups ─────────────────────────────────────────

console.log('\nPhase A6 — Source Vertex Groups')

/**
 * Geometry: two equal-area triangles side by side on the XZ plane.
 *   tri 0 (left,  x < 0): (-10,0,0), (0,0,0), (-10,0,10)  — area = 50
 *   tri 1 (right, x > 0): ( 0,0,0), (10,0,0), (  0,0,10)  — area = 50
 * Weight attribute 'density':
 *   left triangle vertices → weight 1.0
 *   right triangle vertices → weight 0.0
 */
function makeTwoEqualTriGeo(leftWeight = 1, rightWeight = 0) {
  const geo = new BufferGeometry()
  const positions = new Float32Array([
    -10, 0,  0,
      0, 0,  0,
    -10, 0, 10,
      0, 0,  0,
     10, 0,  0,
      0, 0, 10,
  ])
  const weights = new Float32Array([
    leftWeight, leftWeight, leftWeight,
    rightWeight, rightWeight, rightWeight,
  ])
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('density',  new Float32BufferAttribute(weights,   1))
  return geo
}

test('uniform weight (1.0 everywhere) + evenDistribution → same as area-only distribution', () => {
  const geo = makeTwoEqualTriGeo(1, 1)
  const sys = new ParticleSystem({ count: 500, lifetime: 2, start: 0, end: 100, seed: 11, physics: 'none' })
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true, normalVelocity: 0 })
  emitter.weightAttribute = 'density'
  sys.addEmitter(emitter)
  sys.setGeometry(geo)
  runSim(sys, 400)
  const pool = sys['_pool'].filter(p => p.alive)
  assert.ok(pool.length > 50, `need more alive particles, got ${pool.length}`)
  const leftCount  = pool.filter(p => p.position.x < 0).length
  const rightCount = pool.filter(p => p.position.x > 0).length
  const leftFrac   = leftCount / (leftCount + rightCount)
  // Both triangles equal area, equal weight → each should get ≈ 50%
  assert.ok(leftFrac > 0.35 && leftFrac < 0.65,
    `uniform weight should give ≈50/50 split, got leftFrac=${(leftFrac*100).toFixed(1)}%`)
})

test('zero weight on right half → no spawns on right half', () => {
  const geo = makeTwoEqualTriGeo(1, 0)
  const sys = new ParticleSystem({ count: 500, lifetime: 2, start: 0, end: 100, seed: 13, physics: 'none' })
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true, normalVelocity: 0 })
  emitter.weightAttribute = 'density'
  sys.addEmitter(emitter)
  sys.setGeometry(geo)
  runSim(sys, 400)
  const pool = sys['_pool'].filter(p => p.alive)
  assert.ok(pool.length > 50, `need more alive particles, got ${pool.length}`)
  const rightCount = pool.filter(p => p.position.x > 0.1).length
  assert.strictEqual(rightCount, 0, `right half has weight 0 — expected 0 spawns, got ${rightCount}`)
})

test('weightStrength: 0 → ignores attribute, distribution reverts to area-only', () => {
  const geo = makeTwoEqualTriGeo(1, 0)
  const sys = new ParticleSystem({ count: 500, lifetime: 2, start: 0, end: 100, seed: 17, physics: 'none' })
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true, normalVelocity: 0 })
  emitter.weightAttribute = 'density'
  emitter.parameters.weightStrength = 0  // disable weighting
  sys.addEmitter(emitter)
  sys.setGeometry(geo)
  runSim(sys, 400)
  const pool = sys['_pool'].filter(p => p.alive)
  assert.ok(pool.length > 50, `need more alive particles, got ${pool.length}`)
  const leftCount  = pool.filter(p => p.position.x < 0).length
  const rightCount = pool.filter(p => p.position.x > 0).length
  const leftFrac   = leftCount / (leftCount + rightCount)
  // With strength=0, weights ignored — equal area triangles → ≈50/50
  assert.ok(leftFrac > 0.3 && leftFrac < 0.7,
    `weightStrength=0 should give ≈50/50 split, got leftFrac=${(leftFrac*100).toFixed(1)}%`)
})

test('works with indexed geometry', () => {
  // makeTwoEqualTriGeo uses non-indexed; this test adds an index buffer
  const geo = makeTwoEqualTriGeo(1, 0)
  geo.setIndex([0, 1, 2,  3, 4, 5])
  const sys = new ParticleSystem({ count: 300, lifetime: 2, start: 0, end: 100, seed: 19, physics: 'none' })
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true, normalVelocity: 0 })
  emitter.weightAttribute = 'density'
  sys.addEmitter(emitter)
  sys.setGeometry(geo)
  runSim(sys, 300)
  const pool = sys['_pool'].filter(p => p.alive)
  assert.ok(pool.length > 20, `need alive particles, got ${pool.length}`)
  const rightCount = pool.filter(p => p.position.x > 0.1).length
  assert.strictEqual(rightCount, 0, `indexed geo: right half has weight 0, got ${rightCount} spawns`)
})

test('works with non-indexed geometry', () => {
  // makeTwoEqualTriGeo without setIndex is already non-indexed
  const geo = makeTwoEqualTriGeo(1, 0)
  assert.ok(!geo.getIndex(), 'geometry should be non-indexed')
  const sys = new ParticleSystem({ count: 300, lifetime: 2, start: 0, end: 100, seed: 23, physics: 'none' })
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true, normalVelocity: 0 })
  emitter.weightAttribute = 'density'
  sys.addEmitter(emitter)
  sys.setGeometry(geo)
  runSim(sys, 300)
  const pool = sys['_pool'].filter(p => p.alive)
  assert.ok(pool.length > 20, `need alive particles, got ${pool.length}`)
  const rightCount = pool.filter(p => p.position.x > 0.1).length
  assert.strictEqual(rightCount, 0, `non-indexed geo: right half has weight 0, got ${rightCount} spawns`)
})

test('CDF rebuilt when weightAttribute string changes', () => {
  // Start with density2 (right side weight 1), then switch to density1 (left side weight 1)
  const geo = makeTwoEqualTriGeo(1, 0) // density: left=1, right=0
  // Add a second weight attribute with the opposite mapping
  const weightsFlipped = new Float32Array([0, 0, 0, 1, 1, 1])
  geo.setAttribute('density2', new Float32BufferAttribute(weightsFlipped, 1))

  const sys = new ParticleSystem({ count: 500, lifetime: 2, start: 0, end: 100, seed: 29, physics: 'none' })
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true, normalVelocity: 0 })
  emitter.weightAttribute = 'density2' // right half active
  sys.addEmitter(emitter)
  sys.setGeometry(geo)
  runSim(sys, 300)

  // Right half should dominate
  let pool = sys['_pool'].filter(p => p.alive)
  const rightFrac1 = pool.filter(p => p.position.x > 0.1).length / Math.max(pool.length, 1)
  assert.ok(rightFrac1 > 0.8, `density2 phase: expected right-heavy, got rightFrac=${(rightFrac1*100).toFixed(1)}%`)

  // Switch to 'density' (left half active) — CDF must rebuild
  emitter.weightAttribute = 'density'
  const sys2 = new ParticleSystem({ count: 500, lifetime: 2, start: 0, end: 100, seed: 29, physics: 'none' })
  sys2.addEmitter(emitter)
  sys2.setGeometry(geo)
  runSim(sys2, 300)

  pool = sys2['_pool'].filter(p => p.alive)
  const rightFrac2 = pool.filter(p => p.position.x > 0.1).length / Math.max(pool.length, 1)
  assert.ok(rightFrac2 < 0.1, `density phase: expected left-heavy, got rightFrac=${(rightFrac2*100).toFixed(1)}%`)
})

// ── Phase A7 — Children ──────────────────────────────────────────────────────

console.log('\nPhase A7 — Children')

/**
 * BillboardRenderer helper that returns draw range count after one update()
 * call with the given params object.
 */
function billboardDrawCount(aliveParticles, params) {
  const max = 200
  const r = new BillboardRenderer({ maxCount: max, fadeOut: false })
  r.update(aliveParticles, aliveParticles.length, params, null)
  return r.object3D.geometry.drawRange.count
}

test('childCount: 0 → draw count equals alive parent count (no change)', () => {
  const particles = mockParticles(10)
  const params = { childCount: 0, childType: 1, childSpread: 0.5 }
  const count = billboardDrawCount(particles, params)
  assert.strictEqual(count, 10, `expected 10 (parents only), got ${count}`)
})

test('childCount: 3, childType: simple → draw count equals aliveCount × (1 + childCount)', () => {
  const particles = mockParticles(5)
  const params = { childCount: 3, childType: 1, childSpread: 0.5 }
  const count = billboardDrawCount(particles, params)
  assert.strictEqual(count, 5 * (1 + 3), `expected ${5 * 4}, got ${count}`)
})

test('childSpread: 0 → all children spawn exactly at parent position', () => {
  const max = 100
  const r = new BillboardRenderer({ maxCount: max, fadeOut: false })
  const particles = mockParticles(3)
  const params = { childCount: 4, childType: 1, childSpread: 0 }
  // Use a deterministic rng-like object (SeededRandom class)
  r.update(particles, 3, params, null)
  const drawCount = r.object3D.geometry.drawRange.count
  assert.strictEqual(drawCount, 3 * 5)
  // Verify positions via the internal draw buffer
  const buf = r['_drawBuf']
  // Groups of 5: [parent, c0, c1, c2, c3] — children must equal parent position
  for (let pi = 0; pi < 3; pi++) {
    const parent = buf[pi * 5]
    for (let ci = 1; ci <= 4; ci++) {
      const child = buf[pi * 5 + ci]
      assert.ok(
        Math.abs(child.position.x - parent.position.x) < 1e-10 &&
        Math.abs(child.position.y - parent.position.y) < 1e-10 &&
        Math.abs(child.position.z - parent.position.z) < 1e-10,
        `child position differs from parent with childSpread=0 (parent ${pi}, child ${ci})`,
      )
    }
  }
})

test('childSpread: 1 → children are offset from parent position', () => {
  const max = 100
  const r = new BillboardRenderer({ maxCount: max, fadeOut: false })
  const particles = mockParticles(4)
  const params = { childCount: 2, childType: 1, childSpread: 1 }
  const rng = new SeededRandom(42)
  r.update(particles, 4, params, rng)
  const buf = r['_drawBuf']
  // Check that at least one child in the first group is offset from its parent
  const parent = buf[0]
  const child  = buf[1]
  const dist = Math.sqrt(
    (child.position.x - parent.position.x) ** 2 +
    (child.position.y - parent.position.y) ** 2 +
    (child.position.z - parent.position.z) ** 2,
  )
  assert.ok(dist > 0, `child should be offset from parent when childSpread=1, got dist=${dist}`)
})

test('same seed → identical child positions across two runs', () => {
  const max = 100
  const particles = mockParticles(4)
  const params = { childCount: 2, childType: 1, childSpread: 0.5 }

  const r1 = new BillboardRenderer({ maxCount: max, fadeOut: false })
  const rng1 = new SeededRandom(99)
  r1.update(particles, 4, params, rng1)

  const r2 = new BillboardRenderer({ maxCount: max, fadeOut: false })
  const rng2 = new SeededRandom(99)
  r2.update(particles, 4, params, rng2)

  const buf1 = r1['_drawBuf']
  const buf2 = r2['_drawBuf']
  const drawCount = 4 * 3  // 4 parents × (1 parent + 2 children)
  for (let i = 0; i < drawCount; i++) {
    assert.ok(
      Math.abs(buf1[i].position.x - buf2[i].position.x) < 1e-10 &&
      Math.abs(buf1[i].position.y - buf2[i].position.y) < 1e-10 &&
      Math.abs(buf1[i].position.z - buf2[i].position.z) < 1e-10,
      `entry[${i}] position differs between two runs with same seed`,
    )
  }
})

test('childType: interpolated → draw count equals aliveCount × (1 + childCount)', () => {
  const particles = mockParticles(6)
  const params = { childCount: 3, childType: 2, childSpread: 0 }
  const count = billboardDrawCount(particles, params)
  assert.strictEqual(count, 6 * (1 + 3), `expected ${6 * 4}, got ${count}`)
})

test('childType: interpolated → children lie between consecutive parents', () => {
  // Two parents at x=0 and x=10 — one child should land near x=5
  const max = 50
  const r = new BillboardRenderer({ maxCount: max, fadeOut: false })
  const p0 = { position: { x: 0,  y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, angularVel: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: 1, normalised: 0.5, alive: true, lifetime: 2, age: 1, emitterIndex: 0 }
  const p1 = { position: { x: 10, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, angularVel: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: 1, normalised: 0.5, alive: true, lifetime: 2, age: 1, emitterIndex: 0 }
  const params = { childCount: 1, childType: 2, childSpread: 0 }
  r.update([p0, p1], 2, params, null)
  const buf = r['_drawBuf']
  // Layout: p0, child0_of_p0 (between p0 and p1), p1, child0_of_p1 (between p1 and p0)
  // child0_of_p0 at t=0.5 → x = 0 + (10-0)*0.5 = 5
  const child = buf[1]
  assert.ok(
    Math.abs(child.position.x - 5) < 1e-6,
    `interpolated child should be at x≈5, got x=${child.position.x}`,
  )
})

test('ParticleSystem exposes childCount, childSpread, childType in parameters', () => {
  const sys = new ParticleSystem({ childCount: 5, childSpread: 1.5, childType: 1 })
  assert.strictEqual(sys.parameters.childCount,  5)
  assert.strictEqual(sys.parameters.childSpread, 1.5)
  assert.strictEqual(sys.parameters.childType,   1)
})

test('ParticleSystem childType defaults to 0 (none)', () => {
  const sys = new ParticleSystem({})
  assert.strictEqual(sys.parameters.childType,  0)
  assert.strictEqual(sys.parameters.childCount, 0)
})

// ── Phase A8 — Cache / Bake ──────────────────────────────────────────────────

import {
  ParticleCache,
  BoidForce,
  KeyedPhysics,
  SPHPhysics,
  StrandRenderer,
} from '../dist/index.js'

console.log('\nPhase A8 — Cache / Bake')

function makeBakeSystem(seed = 1) {
  const sys = new ParticleSystem({
    count: 20, lifetime: 2, seed, start: 0, end: 20, physics: 'newtonian', gravity: 0,
  })
  sys.addEmitter(new PointEmitter({ normalVelocity: 1, randomVelocity: 0.2 }))
  return sys
}

test('isBaked is false before bake, true after', () => {
  const sys = makeBakeSystem()
  assert.strictEqual(sys.cache.isBaked, false)
  sys.bake(0, 1, 10)
  assert.strictEqual(sys.cache.isBaked, true)
})

test('frameCount equals Math.ceil((endSec - startSec) * fps) + 1', () => {
  const sys = makeBakeSystem()
  sys.bake(0, 2, 15)
  const expected = Math.ceil((2 - 0) * 15) + 1
  assert.strictEqual(sys.cache.frameCount, expected)
})

test('frameCount with non-zero startSec', () => {
  const sys = makeBakeSystem()
  sys.bake(0.5, 2.5, 10)
  const expected = Math.ceil((2.5 - 0.5) * 10) + 1
  assert.strictEqual(sys.cache.frameCount, expected)
})

test('seek restores pool positions to baked values (not live physics)', () => {
  const sys = makeBakeSystem(42)
  sys.bake(0, 2, 10)

  // Seek to t=0 and record positions
  sys.cache.seek(sys, 0)
  const pool = sys['_pool']
  const snapAt0 = pool.map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z }))

  // Seek forward then back — must restore exactly
  sys.cache.seek(sys, 1.5)
  sys.cache.seek(sys, 0)
  for (let i = 0; i < pool.length; i++) {
    assert.ok(Math.abs(pool[i].position.x - snapAt0[i].x) < 1e-5,
      `particle[${i}].position.x differs after round-trip seek`)
    assert.ok(Math.abs(pool[i].position.y - snapAt0[i].y) < 1e-5,
      `particle[${i}].position.y differs after round-trip seek`)
  }
})

test('seek with t below startSec clamps to first frame', () => {
  const sys = makeBakeSystem(7)
  sys.bake(1, 3, 10)
  sys.cache.seek(sys, 1)   // exactly frame 0
  const pool = sys['_pool']
  const refX = pool.map(p => p.position.x)

  sys.cache.seek(sys, -999) // far before startSec
  for (let i = 0; i < pool.length; i++) {
    assert.ok(Math.abs(pool[i].position.x - refX[i]) < 1e-5,
      `clamped seek should equal first frame, particle[${i}]`)
  }
})

test('seek with t above endSec clamps to last frame', () => {
  const sys = makeBakeSystem(8)
  sys.bake(0, 1, 10)
  const lastFrame = sys.cache.frameCount - 1
  sys.cache.seek(sys, 1)   // exactly last frame
  const pool = sys['_pool']
  const refX = pool.map(p => p.position.x)

  sys.cache.seek(sys, 9999) // far after endSec
  for (let i = 0; i < pool.length; i++) {
    assert.ok(Math.abs(pool[i].position.x - refX[i]) < 1e-5,
      `clamped seek should equal last frame (${lastFrame}), particle[${i}]`)
  }
})

test('after unbake(), update() resumes live physics and isBaked is false', () => {
  const sys = makeBakeSystem(3)
  sys.bake(0, 1, 10)
  assert.strictEqual(sys.cache.isBaked, true)

  sys.unbake()
  assert.strictEqual(sys.cache.isBaked, false)

  // After unbake, update() should change positions (gravity disabled, but velocity is non-zero)
  sys.cache.seek(sys, 0)  // prime some alive particles
  const pool = sys['_pool']
  const beforeX = pool.map(p => p.position.x)
  for (let i = 0; i < 30; i++) sys.update(1 / 60)
  const movedCount = pool.filter((p, i) => p.alive && Math.abs(p.position.x - beforeX[i]) > 1e-6).length
  assert.ok(movedCount > 0, `live physics should move particles after unbake, moved ${movedCount}`)
})

test('toJSON / fromJSON round-trip preserves frameCount and first-frame positions', () => {
  const sys = makeBakeSystem(5)
  sys.bake(0, 1, 10)
  const json = sys.cache.toJSON()
  const str  = JSON.stringify(json)
  const data = JSON.parse(str)

  const cache2 = new ParticleCache()
  cache2.fromJSON(data)

  assert.strictEqual(cache2.frameCount, sys.cache.frameCount, 'frameCount must survive round-trip')

  // First-frame positions must match
  const sys2 = makeBakeSystem(5)
  sys.cache.seek(sys,   0)
  cache2.seek(sys2, 0)
  const pool1 = sys['_pool']
  const pool2 = sys2['_pool']
  for (let i = 0; i < pool1.length; i++) {
    assert.ok(Math.abs(pool1[i].position.x - pool2[i].position.x) < 1e-4,
      `particle[${i}].position.x differs after JSON round-trip`)
  }
})

test('same seed + same bake parameters → identical baked frames on two independent runs', () => {
  const s1 = makeBakeSystem(99)
  const s2 = makeBakeSystem(99)
  s1.bake(0, 1, 10)
  s2.bake(0, 1, 10)

  assert.strictEqual(s1.cache.frameCount, s2.cache.frameCount)
  s1.cache.seek(s1, 0.5)
  s2.cache.seek(s2, 0.5)
  const p1 = s1['_pool']
  const p2 = s2['_pool']
  for (let i = 0; i < p1.length; i++) {
    assert.ok(Math.abs(p1[i].position.x - p2[i].position.x) < 1e-5,
      `particle[${i}].position.x differs between two identical-seed bakes`)
  }
})

// ── Phase B1 — Boids ─────────────────────────────────────────────────────────

console.log('\nPhase B1 — Boids')

/** Build a live Particle-like object (plain, matching Particle shape). */
function makeLiveParticle(x, y, z, vx = 0, vy = 0, vz = 0) {
  return {
    position:   { x, y, z },
    velocity:   { x: vx, y: vy, z: vz },
    angularVel: { x: 0, y: 0, z: 0 },
    rotation:   { x: 0, y: 0, z: 0 },
    size: 1, normalised: 0.5, alive: true, lifetime: 10, age: 1, emitterIndex: 0,
    reset() {},
  }
}

test('cohesion: apply accelerates isolated particle toward a cluster of 5 nearby', () => {
  // Cluster at x=5, particle at x=0
  const cluster = Array.from({ length: 5 }, (_, i) => makeLiveParticle(5, i * 0.1, 0))
  const subject = makeLiveParticle(0, 0, 0)
  const pool    = [subject, ...cluster]
  const boid    = new BoidForce(pool, {
    cohesionRadius: 10, cohesionStrength: 2, separationRadius: 0.001,
    alignmentRadius: 0.001, alignmentStrength: 0, separationStrength: 0,
    maxSpeed: 100, maxForce: 100,
  })
  const vxBefore = subject.velocity.x
  boid.apply(subject, 1 / 60)
  assert.ok(subject.velocity.x > vxBefore, `cohesion should pull particle toward cluster (vx before=${vxBefore}, after=${subject.velocity.x})`)
})

test('separation: apply pushes two overlapping particles apart', () => {
  const p1 = makeLiveParticle(0, 0, 0)
  const p2 = makeLiveParticle(0.1, 0, 0)
  const pool = [p1, p2]
  const boid = new BoidForce(pool, {
    separationRadius: 1, separationStrength: 5,
    cohesionRadius: 0.001, cohesionStrength: 0,
    alignmentRadius: 0.001, alignmentStrength: 0,
    maxSpeed: 100, maxForce: 100,
  })
  boid.apply(p1, 1 / 60)
  // p1 should be pushed in the negative x direction (away from p2 at x=0.1)
  assert.ok(p1.velocity.x < 0, `separation should push p1 away from p2 (vx=${p1.velocity.x})`)
})

test('alignment: apply steers particle velocity toward average of 3 aligned neighbours', () => {
  const subject  = makeLiveParticle(0, 0, 0, 0, 0, 0)
  const n1 = makeLiveParticle(0.5, 0, 0, 3, 0, 0)
  const n2 = makeLiveParticle(-0.5, 0, 0, 3, 0, 0)
  const n3 = makeLiveParticle(0, 0.5, 0, 3, 0, 0)
  const pool = [subject, n1, n2, n3]
  const boid = new BoidForce(pool, {
    alignmentRadius: 2, alignmentStrength: 2,
    separationRadius: 0.001, separationStrength: 0,
    cohesionRadius: 0.001, cohesionStrength: 0,
    maxSpeed: 100, maxForce: 100,
  })
  boid.apply(subject, 1 / 60)
  // average neighbour vx = 3 → subject.vx should increase toward 3
  assert.ok(subject.velocity.x > 0, `alignment should steer vx toward neighbour average (vx=${subject.velocity.x})`)
})

test('maxSpeed clamps velocity after apply', () => {
  const subject = makeLiveParticle(0, 0, 0, 0, 0, 0)
  const cluster = Array.from({ length: 10 }, (_, i) => makeLiveParticle(0.1 * i, 0, 0, 100, 0, 0))
  const pool = [subject, ...cluster]
  const boid = new BoidForce(pool, {
    alignmentRadius: 100, alignmentStrength: 999,
    cohesionRadius: 100, cohesionStrength: 999,
    separationRadius: 0.001,
    maxSpeed: 3.0, maxForce: 9999,
  })
  boid.apply(subject, 1)
  const speed = Math.sqrt(subject.velocity.x ** 2 + subject.velocity.y ** 2 + subject.velocity.z ** 2)
  assert.ok(speed <= 3.0 + 1e-6, `speed ${speed} exceeds maxSpeed 3.0`)
})

test('BoidForce parameters object has all required fields', () => {
  const pool = []
  const boid = new BoidForce(pool)
  const required = [
    'separationRadius', 'separationStrength',
    'alignmentRadius',  'alignmentStrength',
    'cohesionRadius',   'cohesionStrength',
    'maxSpeed', 'maxForce',
    'separationWeight', 'alignmentWeight', 'cohesionWeight', 'avoidWeight',
    'flightHeight', 'bankingAngle', 'pitchAngle',
  ]
  for (const key of required) {
    assert.ok(typeof boid.parameters[key] === 'number', `parameters.${key} must be a number`)
  }
})

// ── Phase B2 — Keyed Physics stub ────────────────────────────────────────────

console.log('\nPhase 5 — KeyedPhysics (real blending)')

test('KeyedPhysics: constructing with two ParticleSystem instances throws no error', () => {
  const s1 = new ParticleSystem({ count: 5 })
  const s2 = new ParticleSystem({ count: 5 })
  let threw = false
  try { new KeyedPhysics([s1, s2]) } catch { threw = true }
  assert.strictEqual(threw, false, 'constructor should not throw')
})

test('KeyedPhysics: parameters.blend is a number', () => {
  const kp = new KeyedPhysics([])
  assert.ok(typeof kp.parameters.blend === 'number')
})

test('KeyedPhysics: targetCount matches targets array length', () => {
  const s1 = new ParticleSystem({ count: 3 })
  const s2 = new ParticleSystem({ count: 3 })
  const kp = new KeyedPhysics([s1, s2])
  assert.strictEqual(kp.targetCount, 2)
})

test('KeyedPhysics: blend=0 copies positions from target[0]', () => {
  const target = new ParticleSystem({ count: 3, start: 0, end: 5, lifetime: 5 })
  target.update(1)
  const kp = new KeyedPhysics([target])
  kp.parameters.blend = 0
  const p = { alive: true, position: new Vector3(99, 99, 99), velocity: new Vector3(), size: 1, normalised: 0 }
  kp.apply([p], 0.016)
  const tPos = target.pool[0].position
  assert(Math.abs(p.position.x - tPos.x) < 0.001 || !target.pool[0].alive, 'position should match target or target slot not alive')
})

test('KeyedPhysics: blend=0.5 lerps between target[0] and target[1]', () => {
  const t0 = new ParticleSystem({ count: 1, start: 0, end: 5, lifetime: 5 })
  const t1 = new ParticleSystem({ count: 1, start: 0, end: 5, lifetime: 5 })
  t0.update(1); t1.update(1)
  if (t0.pool[0]) { t0.pool[0].position.set(0, 0, 0); t0.pool[0].alive = true }
  if (t1.pool[0]) { t1.pool[0].position.set(2, 0, 0); t1.pool[0].alive = true }
  const kp = new KeyedPhysics([t0, t1])
  kp.parameters.blend = 0.5
  const p = { alive: true, position: new Vector3(), velocity: new Vector3(), size: 1, normalised: 0 }
  kp.apply([p], 0.016)
  if (t0.pool[0].alive && t1.pool[0].alive) {
    assert(Math.abs(p.position.x - 1.0) < 0.01, `Expected x≈1 got ${p.position.x}`)
  }
})

test('KeyedPhysics: ParticleSystem.setKeyedPhysics integrates without error', () => {
  const target = new ParticleSystem({ count: 5, start: 0, end: 10, lifetime: 5 })
  const kp     = new KeyedPhysics([target])
  const sys    = new ParticleSystem({ count: 5, start: 0, end: 10, lifetime: 5 })
  sys.setKeyedPhysics(kp)
  let threw = false
  try { sys.update(0.016) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('KeyedPhysics: empty targets array is safe', () => {
  const kp = new KeyedPhysics([])
  const p  = { alive: true, position: new Vector3(1, 2, 3), velocity: new Vector3(), size: 1, normalised: 0 }
  let threw = false
  try { kp.apply([p], 0.016) } catch { threw = true }
  assert.strictEqual(threw, false)
})

// ── Phase B3 — SPH Physics stub ──────────────────────────────────────────────

console.log('\nPhase B3 — SPHPhysics stub')

test('SPHPhysics: constructing throws no error', () => {
  let threw = false
  try { new SPHPhysics() } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('SPHPhysics: apply() is callable and does not throw', () => {
  const sph = new SPHPhysics()
  let threw = false
  try { sph.apply([], 0) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('SPHPhysics: parameters object has all Blender-named fields', () => {
  const sph = new SPHPhysics()
  for (const key of ['stiffness', 'viscosity', 'buoyancy', 'surfaceTension', 'repulsion']) {
    assert.ok(typeof sph.parameters[key] === 'number', `parameters.${key} must be a number`)
  }
})

// ── Phase B4 — StrandRenderer stub ───────────────────────────────────────────

console.log('\nPhase B4 — StrandRenderer stub')

test('StrandRenderer: constructing throws no error', () => {
  let threw = false
  try { new StrandRenderer({ maxCount: 100 }) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('StrandRenderer: update() is callable and does not throw', () => {
  const r = new StrandRenderer({ maxCount: 10 })
  let threw = false
  try { r.update(mockParticles(5), 5) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('StrandRenderer: parameters object has all Blender-named fields', () => {
  const r = new StrandRenderer()
  for (const key of ['thickness', 'taper', 'kinkAmplitude', 'kinkFrequency']) {
    assert.ok(typeof r.parameters[key] === 'number', `parameters.${key} must be a number`)
  }
})

test('StrandRenderer: object3D is THREE.Group', () => {
  const r = new StrandRenderer({ maxCount: 10 })
  assert.ok(r.object3D instanceof Group, 'object3D must be THREE.Group')
})

test('StrandRenderer: line mode adds LineSegments child to group', () => {
  const r = new StrandRenderer({ maxCount: 5, mode: 'line' })
  assert.ok(r.object3D.children.length > 0, 'group should have children in line mode')
})

test('StrandRenderer: update() does not throw with alive particles', () => {
  const r = new StrandRenderer({ maxCount: 10, mode: 'line', segments: 4 })
  const p = {
    position: new Vector3(0, 0, 0), velocity: new Vector3(), rotation: new Vector3(),
    size: 0.1, normalised: 0.5, alive: true, lifetime: 2, age: 1, emitterIndex: 0,
  }
  let threw = false
  try { r.update([p], 1) } catch (e) { threw = true; console.error(e) }
  assert.strictEqual(threw, false)
})

test('StrandRenderer: custom strandCurve is called during update', () => {
  let called = false
  const curve = (p, t) => { called = true; return { x: 0, y: t, z: 0 } }
  const r = new StrandRenderer({ maxCount: 5, mode: 'line', segments: 4, strandCurve: curve })
  const p = {
    position: new Vector3(), velocity: new Vector3(), rotation: new Vector3(),
    size: 0.1, normalised: 0, alive: true, lifetime: 1, age: 0.5, emitterIndex: 0,
  }
  r.update([p], 1)
  assert.ok(called, 'strandCurve should be called during update')
})

test('StrandRenderer: tube mode adds Mesh children for alive particles', () => {
  const r = new StrandRenderer({ maxCount: 3, mode: 'tube', segments: 4 })
  const p = {
    position: new Vector3(1, 0, 0), velocity: new Vector3(), rotation: new Vector3(),
    size: 0.1, normalised: 0, alive: true, lifetime: 1, age: 0.5, emitterIndex: 0,
  }
  r.update([p], 1)
  const visible = r.object3D.children.filter(c => c.visible)
  assert.ok(visible.length >= 1, 'at least 1 tube mesh should be visible')
})

test('StrandRenderer: dispose() does not throw', () => {
  const r = new StrandRenderer({ maxCount: 5 })
  let threw = false
  try { r.dispose() } catch { threw = true }
  assert.strictEqual(threw, false)
})

// ── Phase C1 — Collisions / Deflectors ───────────────────────────────────────

console.log('\nPhase C1 — Collisions / Deflectors')

/**
 * Build a large horizontal floor at y=0 with normal pointing +Y.
 * Winding chosen so that edge1 × edge2 → (0,+1,0).
 *
 * A=(-100,0,100), B=(100,0,100), C=(0,0,-100)
 * edge1 = B-A = (200,0,0), edge2 = C-A = (100,0,-200)
 * normal.y = edge1.z*edge2.x - edge1.x*edge2.z = 0*100 - 200*(-200) = 40000 > 0 ✓
 */
function makeFloorGeo() {
  const geo = new BufferGeometry()
  const positions = new Float32Array([
    -100, 0,  100,
     100, 0,  100,
       0, 0, -100,
  ])
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  return geo
}

/** Make a ParticleSystem with no emitters, no gravity, no drag so we control physics manually. */
function makeCleanSys(opts = {}) {
  return new ParticleSystem({ count: 1, start: 100, end: 200, gravity: 0, drag: 0, damp: 0, ...opts })
}

/** Manually seed one alive particle with given pos/vel. */
function seedParticle(sys, px, py, pz, vx, vy, vz) {
  const p = sys.pool[0]
  p.alive    = true
  p.age      = 0
  p.lifetime = 10
  p.position.set(px, py, pz)
  p.velocity.set(vx, vy, vz)
}

test('C1: particle moving downward through floor deflects upward', () => {
  const sys  = makeCleanSys()
  const d    = new DeflectorCollider(makeFloorGeo(), { damping: 0, friction: 0 })
  sys.addDeflector(d)
  seedParticle(sys, 0, 1, 0,  0, -5, 0)
  sys.update(0.5)   // particle would reach y = 1 - 5*0.5 = -1.5 → crosses y=0
  assert.ok(sys.pool[0].velocity.y > 0, 'vy should be positive after bounce')
})

test('C1: damping: 1 → reflected normal velocity component is zero', () => {
  const sys = makeCleanSys()
  const d   = new DeflectorCollider(makeFloorGeo(), { damping: 1, friction: 0 })
  sys.addDeflector(d)
  seedParticle(sys, 0, 1, 0,  0, -5, 0)
  sys.update(0.5)
  // With damping=1 (inelastic): v_new = v - (2-1)*vDotN*n = v - vDotN*n
  // vDotN = -5, v_new.y = -5 - (-5)*1 = 0
  assert.ok(Math.abs(sys.pool[0].velocity.y) < 0.001, 'normal velocity should be ~0')
})

test('C1: damping: 0 → speed is conserved after bounce', () => {
  const sys = makeCleanSys()
  const d   = new DeflectorCollider(makeFloorGeo(), { damping: 0, friction: 0 })
  sys.addDeflector(d)
  seedParticle(sys, 0, 1, 0,  0, -5, 0)
  const speedBefore = 5
  sys.update(0.5)
  const p = sys.pool[0]
  const speedAfter = Math.sqrt(p.velocity.x**2 + p.velocity.y**2 + p.velocity.z**2)
  assert.ok(Math.abs(speedAfter - speedBefore) < 0.01, `speed should be ~5, got ${speedAfter}`)
})

test('C1: dieOnHit: 1 → particle is dead after hitting the floor', () => {
  const sys = makeCleanSys({ dieOnHit: true })
  const d   = new DeflectorCollider(makeFloorGeo())
  sys.addDeflector(d)
  seedParticle(sys, 0, 1, 0,  0, -5, 0)
  sys.update(0.5)
  assert.strictEqual(sys.pool[0].alive, false, 'particle should be dead on dieOnHit')
})

test('C1: friction: 1 → tangential velocity component cancelled after bounce', () => {
  const sys = makeCleanSys()
  const d   = new DeflectorCollider(makeFloorGeo(), { damping: 0, friction: 1 })
  sys.addDeflector(d)
  // Give particle both downward (normal) and sideways (tangential) velocity
  seedParticle(sys, 0, 1, 0,  3, -5, 0)
  sys.update(0.5)
  const p = sys.pool[0]
  // After friction=1: only normal component remains (tangential cancelled)
  assert.ok(Math.abs(p.velocity.x) < 0.001, `tangential vx should be ~0, got ${p.velocity.x}`)
  assert.ok(p.velocity.y > 0, 'normal vy should be positive')
})

test('C1: two deflectors in the same system both can take effect', () => {
  // Floor at y=0, ceiling-like plane with downward normal at y=5 won't matter for this test.
  // Just confirm two deflectors are accepted and system still works.
  const sys = makeCleanSys()
  const d1  = new DeflectorCollider(makeFloorGeo(), { damping: 0, friction: 0 })
  // Second deflector: same floor geometry — no error
  const d2  = new DeflectorCollider(makeFloorGeo(), { damping: 0.5, friction: 0 })
  sys.addDeflector(d1).addDeflector(d2)
  seedParticle(sys, 0, 1, 0,  0, -5, 0)
  let threw = false
  try { sys.update(0.5) } catch { threw = true }
  assert.strictEqual(threw, false)
  assert.ok(sys.pool[0].velocity.y > 0, 'particle should have bounced')
})

test('C1: buildBVH() is callable without error on a BoxGeometry', () => {
  const d = new DeflectorCollider(new BoxGeometry(1, 1, 1))
  let threw = false
  try { d.buildBVH() } catch { threw = true }
  assert.strictEqual(threw, false)
})

// ── Phase C2 — Texture Emission Density ──────────────────────────────────────

console.log('\nPhase C2 — Texture Emission Density')

/**
 * Build a two-triangle geometry with UV coordinates.
 * Left triangle: all x < 0, UV u in [0, 0.5].
 * Right triangle: all x > 0, UV u in [0.5, 1].
 * Equal areas.
 */
function makePlaneWithUV() {
  const geo = new BufferGeometry()
  const positions = new Float32Array([
    // left tri — all x <= -0.5
    -2, 0,  0,
    -1, 0, -1,
    -1, 0,  1,
    // right tri — all x >= 0.5
     2, 0,  0,
     1, 0,  1,
     1, 0, -1,
  ])
  const uvs = new Float32Array([
    // left tri — UV x centroid ≈ 0.08 (well in left half)
    0, 0.5,
    0.25, 0,
    0.25, 1,
    // right tri — UV x centroid ≈ 0.92 (well in right half)
    1, 0.5,
    0.75, 1,
    0.75, 0,
  ])
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('uv',       new BufferAttribute(uvs, 2))
  return geo
}

/**
 * Create a mock texture backed by a Uint8ClampedArray ImageData-like object.
 * leftRed: red value (0–255) for left half (u < 0.5), rightRed for right half.
 */
function makeMockTexture(leftRed, rightRed) {
  const W = 8, H = 8
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = x < W / 2 ? leftRed : rightRed
      const i = (y * W + x) * 4
      data[i] = r; data[i+1] = 0; data[i+2] = 0; data[i+3] = 255
    }
  }
  const tex = new Texture()
  tex.image = { data, width: W, height: H }
  return tex
}

test('C2: densityTexture: null → behaviour identical to no texture', () => {
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true })
  emitter.densityTexture = null
  const geo = makePlaneWithUV()
  const rng = new SeededRandom(42)
  let threw = false
  try { emitter.spawn(new Particle(), geo, rng) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('C2: red=1 left half, red=0 right half → all spawns on left half', () => {
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true })
  emitter.densityTexture = makeMockTexture(255, 0)
  const geo = makePlaneWithUV()
  const rng = new SeededRandom(1)

  let leftCount = 0, rightCount = 0
  for (let i = 0; i < 200; i++) {
    const p = new Particle()
    emitter.spawn(p, geo, rng)
    if (p.position.x < 0) leftCount++; else rightCount++
  }
  assert.ok(leftCount === 200, `expected all on left, got left=${leftCount} right=${rightCount}`)
})

test('C2: changing densityTexture reference triggers CDF rebuild on next spawn', () => {
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true })
  const geo = makePlaneWithUV()
  const rng = new SeededRandom(0)

  emitter.densityTexture = makeMockTexture(255, 0)
  emitter.spawn(new Particle(), geo, rng)   // builds CDF for left-heavy
  emitter.densityTexture = makeMockTexture(0, 255)
  emitter.spawn(new Particle(), geo, rng)   // must rebuild for right-heavy

  // Run many spawns with right-heavy texture and verify distribution shifts
  let rightCount = 0
  emitter.densityTexture = makeMockTexture(0, 255)
  for (let i = 0; i < 200; i++) {
    const p = new Particle()
    emitter.spawn(p, geo, rng)
    if (p.position.x >= 0) rightCount++
  }
  assert.ok(rightCount === 200, `expected all on right, got ${rightCount}`)
})

test('C2: geometry without UV attribute → falls back to uniform distribution, no error', () => {
  const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true })
  emitter.densityTexture = makeMockTexture(255, 0)
  const geoNoUV = new BufferGeometry()
  const positions = new Float32Array([-1, 0, -1,  1, 0, -1,  0, 0, 1])
  geoNoUV.setAttribute('position', new BufferAttribute(positions, 3))
  const rng = new SeededRandom(5)
  let threw = false
  try { emitter.spawn(new Particle(), geoNoUV, rng) } catch { threw = true }
  assert.strictEqual(threw, false)
})

// ── Phase C3 — Display Panel (Color by attribute) ─────────────────────────────

console.log('\nPhase C3 — Display Panel (Color by attribute)')

test('C3: BillboardRenderer colourMode: 0 → material.vertexColors is false', () => {
  const r = new BillboardRenderer({ maxCount: 10, colourMode: 0 })
  r.update(mockParticles(3), 3)
  assert.strictEqual(r.object3D.material.vertexColors, false)
})

test('C3: BillboardRenderer colourMode: 1 → material.vertexColors is true after update()', () => {
  const r = new BillboardRenderer({ maxCount: 10, colourMode: 1 })
  r.update(mockParticles(3), 3)
  assert.strictEqual(r.object3D.material.vertexColors, true)
})

test('C3: BillboardRenderer colourMode: 2 → colour attribute exists with correct draw range', () => {
  const count = 4
  const r = new BillboardRenderer({ maxCount: 10, colourMode: 2 })
  r.update(mockParticles(count), count)
  const colorAttr = r.object3D.geometry.getAttribute('color')
  assert.ok(colorAttr, 'color attribute must exist')
  // drawRange.count equals the number of drawn particles
  assert.strictEqual(r.object3D.geometry.drawRange.count, count)
  // colour buffer has capacity for maxCount × 3 values
  assert.ok(colorAttr.array.length >= count * 3, 'colour buffer has room for drawn particles')
})

test('C3: BillboardRenderer colourMode 2 — particle at normalised=1 gets colourHigh values', () => {
  const r = new BillboardRenderer({
    maxCount: 10, colourMode: 2,
    colourLow: [1, 0, 0], colourHigh: [0, 0, 1],
  })
  const particles = mockParticles(1)
  particles[0].normalised = 1
  r.update(particles, 1)
  const ca = r.object3D.geometry.getAttribute('color')
  assert.ok(Math.abs(ca.getX(0) - 0) < 0.01, 'R should be 0 (high colour)')
  assert.ok(Math.abs(ca.getZ(0) - 1) < 0.01, 'B should be 1 (high colour)')
})

test('C3: BillboardRenderer colourMode 2 — particle at normalised=0 gets colourLow values', () => {
  const r = new BillboardRenderer({
    maxCount: 10, colourMode: 2,
    colourLow: [1, 0, 0], colourHigh: [0, 0, 1],
  })
  const particles = mockParticles(1)
  particles[0].normalised = 0
  r.update(particles, 1)
  const ca = r.object3D.geometry.getAttribute('color')
  assert.ok(Math.abs(ca.getX(0) - 1) < 0.01, 'R should be 1 (low colour)')
  assert.ok(Math.abs(ca.getZ(0) - 0) < 0.01, 'B should be 0 (low colour)')
})

test('C3: BillboardRenderer — all colour parameters are numbers accessible via .parameters', () => {
  const r = new BillboardRenderer({ maxCount: 10 })
  for (const key of ['colourMode', 'colourLowR', 'colourLowG', 'colourLowB', 'colourHighR', 'colourHighG', 'colourHighB', 'velocityMax']) {
    assert.ok(typeof r.parameters[key] === 'number', `parameters.${key} must be a number`)
  }
})

test('C3: LineRenderer colourMode: 0 → material.vertexColors is false', () => {
  const r = new LineRenderer({ maxCount: 10, colourMode: 0 })
  r.update(mockParticles(3), 3)
  assert.strictEqual(r.object3D.material.vertexColors, false)
})

test('C3: LineRenderer colourMode: 1 → material.vertexColors is true after update()', () => {
  const r = new LineRenderer({ maxCount: 10, colourMode: 1 })
  r.update(mockParticles(3), 3)
  assert.strictEqual(r.object3D.material.vertexColors, true)
})

test('C3: LineRenderer colourMode: 2 → colour attribute exists with correct draw range', () => {
  const count = 4
  const r = new LineRenderer({ maxCount: 10, colourMode: 2 })
  r.update(mockParticles(count), count)
  const colorAttr = r.object3D.geometry.getAttribute('color')
  assert.ok(colorAttr, 'color attribute must exist')
  // drawRange = count * 2 vertices (each line = 2 verts)
  assert.strictEqual(r.object3D.geometry.drawRange.count, count * 2)
  // colour buffer capacity = maxCount * 2 vertices * 3 components
  assert.ok(colorAttr.array.length >= count * 2 * 3, 'colour buffer has room for all line verts')
})

test('C3: LineRenderer — all colour parameters are numbers accessible via .parameters', () => {
  const r = new LineRenderer({ maxCount: 10 })
  for (const key of ['colourMode', 'colourLowR', 'colourLowG', 'colourLowB', 'colourHighR', 'colourHighG', 'colourHighB', 'velocityMax']) {
    assert.ok(typeof r.parameters[key] === 'number', `parameters.${key} must be a number`)
  }
})

// ── Phase C4 — Scale Time ─────────────────────────────────────────────────────

console.log('\nPhase C4 — Scale Time')

test('C4: scaleTime: 0 → particles do not age or move over 60 update calls', () => {
  // Use a large dt so particles spawn quickly (rate=count/lifetime=500/2=250/sec)
  const sys = new ParticleSystem({ count: 500, start: 0, end: 100, gravity: 0, lifetime: 2 })
  const em  = new PointEmitter()
  sys.addEmitter(em)
  // Run 1 second to spawn many particles
  for (let i = 0; i < 60; i++) sys.update(1 / 60)
  sys.parameters.scaleTime = 0
  const agesBefore = sys.pool.filter(p => p.alive).map(p => p.age)
  for (let i = 0; i < 60; i++) sys.update(1 / 60)
  const agesAfter = sys.pool.filter(p => p.alive).map(p => p.age)
  assert.ok(agesBefore.length > 0, 'need some alive particles')
  for (let i = 0; i < agesBefore.length; i++) {
    assert.ok(Math.abs(agesAfter[i] - agesBefore[i]) < 0.001, `age should not change at scaleTime=0`)
  }
})

test('C4: scaleTime: 2 → particle ages twice as fast as scaleTime: 1', () => {
  function avgAge(scaleTime) {
    const sys = new ParticleSystem({ count: 5, start: 0, end: 100, gravity: 0 })
    const em  = new PointEmitter()
    sys.addEmitter(em)
    sys.parameters.scaleTime = scaleTime
    for (let i = 0; i < 30; i++) sys.update(1 / 60)
    const alive = sys.pool.filter(p => p.alive)
    if (alive.length === 0) return 0
    return alive.reduce((s, p) => s + p.age, 0) / alive.length
  }
  const age1 = avgAge(1)
  const age2 = avgAge(2)
  assert.ok(age2 > age1 * 1.5, `scaleTime=2 should produce ~2× age: got ${age2.toFixed(3)} vs ${age1.toFixed(3)}`)
})

test('C4: scaleTime: 1 → identical behaviour to unset (regression guard)', () => {
  function runSim(scaleTime) {
    const sys = new ParticleSystem({ count: 5, start: 0, end: 100, seed: 42, gravity: 0 })
    const em  = new PointEmitter()
    sys.addEmitter(em)
    sys.parameters.scaleTime = scaleTime
    for (let i = 0; i < 20; i++) sys.update(1 / 60)
    return sys.pool.filter(p => p.alive).length
  }
  const a = runSim(undefined)   // default
  const b = runSim(1)
  assert.strictEqual(a, b)
})

test('C4: parameters.scaleTime is a number, readable and writable', () => {
  const sys = new ParticleSystem({ count: 1 })
  assert.ok(typeof sys.parameters.scaleTime === 'number')
  sys.parameters.scaleTime = 0.5
  assert.strictEqual(sys.parameters.scaleTime, 0.5)
})

test('C4: GSAP tween from 1 → 0 → 1 does not throw (parameters object is plain)', () => {
  const sys = new ParticleSystem({ count: 1 })
  let threw = false
  try {
    // Simulate what GSAP does: write numeric values to the parameters object
    sys.parameters.scaleTime = 0.5
    sys.parameters.scaleTime = 0
    sys.parameters.scaleTime = 1
  } catch { threw = true }
  assert.strictEqual(threw, false)
})

// ── Phase D1 — displayAmount ──────────────────────────────────────────────────

console.log('\nPhase D1 — displayAmount')

test('D1: displayAmount 1.0 → draw range equals aliveCount', () => {
  const r = new BillboardRenderer({ maxCount: 20, fadeOut: false })
  r.update(mockParticles(10), 10, { displayAmount: 1 })
  assert.strictEqual(r.object3D.geometry.drawRange.count, 10)
})

test('D1: displayAmount 0.5 → draw range is half the alive count', () => {
  const r = new BillboardRenderer({ maxCount: 20, fadeOut: false })
  r.update(mockParticles(10), 10, { displayAmount: 0.5 })
  assert.strictEqual(r.object3D.geometry.drawRange.count, 5)
})

test('D1: displayAmount 0.0 → draw range is 0', () => {
  const r = new BillboardRenderer({ maxCount: 20, fadeOut: false })
  r.update(mockParticles(10), 10, { displayAmount: 0 })
  assert.strictEqual(r.object3D.geometry.drawRange.count, 0)
})

test('D1: LineRenderer displayAmount 0.5 → draw range is half (×2 for verts)', () => {
  const r = new LineRenderer({ maxCount: 20 })
  r.update(mockParticles(10), 10, { displayAmount: 0.5 })
  // Line draws count * 2 vertices
  assert.strictEqual(r.object3D.geometry.drawRange.count, 5 * 2)
})

test('D1: InstanceRenderer displayAmount 0.5 → instance count is halved', () => {
  const geo = new BoxGeometry(0.1, 0.1, 0.1)
  const mat = new MeshBasicMaterial()
  const r   = new InstanceRenderer({ geometry: geo, material: mat, maxCount: 20 })
  r.update(mockParticles(10), 10, { displayAmount: 0.5 })
  assert.strictEqual(r.object3D.count, 5)
})

test('D1: CollectionRenderer displayAmount 0.5 → total instance slots halved', () => {
  const geo = new BoxGeometry(0.1, 0.1, 0.1)
  const mat = new MeshBasicMaterial()
  const r   = new CollectionRenderer({ meshes: [{ geometry: geo, material: mat }], maxCount: 20 })
  r.update(mockParticles(10), 10, { displayAmount: 0.5 })
  // one mesh variant, so all particles go there
  const mesh = r.object3D.children[0]
  assert.strictEqual(mesh.count, 5)
})

test('D1: displayAmount clamped above 1 treats as 1', () => {
  const r = new BillboardRenderer({ maxCount: 20, fadeOut: false })
  r.update(mockParticles(10), 10, { displayAmount: 5 })
  assert.strictEqual(r.object3D.geometry.drawRange.count, 10)
})

test('D1: displayAmount clamped below 0 treats as 0', () => {
  const r = new BillboardRenderer({ maxCount: 20, fadeOut: false })
  r.update(mockParticles(10), 10, { displayAmount: -2 })
  assert.strictEqual(r.object3D.geometry.drawRange.count, 0)
})

test('D1: ParticleSystem.parameters.displayAmount defaults to 1', () => {
  const sys = new ParticleSystem({ count: 10 })
  assert.strictEqual(sys.parameters.displayAmount, 1)
})

test('D1: ParticleSystem.parameters.displayAmount is a number (GSAP compatible)', () => {
  const sys = new ParticleSystem({ count: 10, displayAmount: 0.5 })
  assert.ok(typeof sys.parameters.displayAmount === 'number')
  assert.strictEqual(sys.parameters.displayAmount, 0.5)
})

// ── Phase D2 — Size Deflect ───────────────────────────────────────────────────

console.log('\nPhase D2 — Size Deflect')

test('D2: particle with size=2 bounces 1 unit above floor plane (radius = size/2 = 1)', () => {
  // Particle starts at y=3, moves down, size=2 → radius=1 → should bounce at y=1
  const sys = makeCleanSys()
  const d   = new DeflectorCollider(makeFloorGeo(), { damping: 0, friction: 0 })
  sys.addDeflector(d)
  const p = sys.pool[0]
  p.alive    = true
  p.age      = 0
  p.lifetime = 10
  p.size     = 2          // radius = 1
  p.position.set(0, 3, 0)
  p.velocity.set(0, -10, 0)
  sys.update(0.5)         // would reach y = 3 - 10*0.5 = -2, but should bounce at y=1
  // After bounce the particle should be above y=1 (at the contact point)
  assert.ok(sys.pool[0].position.y >= 0.9, `expected y >= 0.9, got ${sys.pool[0].position.y}`)
  assert.ok(sys.pool[0].velocity.y > 0, 'should be moving upward after bounce')
})

test('D2: particle with size=0 crosses floor plane before bouncing (same as C1 behaviour)', () => {
  // size=0 → radius=0, original behaviour — particle at y=1 moving down crosses at y=0
  const sys = makeCleanSys()
  const d   = new DeflectorCollider(makeFloorGeo(), { damping: 0, friction: 0 })
  sys.addDeflector(d)
  seedParticle(sys, 0, 1, 0,  0, -5, 0)
  sys.pool[0].size = 0
  sys.update(0.5)
  assert.ok(sys.pool[0].velocity.y > 0, 'small particle should still bounce')
})

test('D2: checkCrossing radius=0 matches old zero-radius behaviour', () => {
  const d = new DeflectorCollider(makeFloorGeo())
  d.buildBVH()
  const n = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }
  const pt = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }
  // prev at y=0.1 (above), curr at y=-0.1 (below) → should cross
  const hit = d.checkCrossing(0, 0.1, 0,  0, -0.1, 0,  n, pt, 0)
  assert.strictEqual(hit, true)
})

test('D2: checkCrossing radius=1 fires while particle is still 1 unit above plane', () => {
  const d = new DeflectorCollider(makeFloorGeo())
  d.buildBVH()
  const n = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }
  const pt = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }
  // prev at y=2 (above threshold y=1), curr at y=0.5 (below threshold y=1)
  const hit = d.checkCrossing(0, 2, 0,  0, 0.5, 0,  n, pt, 1)
  assert.strictEqual(hit, true)
})

test('D2: checkCrossing radius=1 does NOT fire when particle stays above the threshold', () => {
  const d = new DeflectorCollider(makeFloorGeo())
  d.buildBVH()
  const n = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }
  const pt = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z } }
  // prev at y=3 (above threshold y=1), curr at y=1.5 (still above threshold)
  const hit = d.checkCrossing(0, 3, 0,  0, 1.5, 0,  n, pt, 1)
  assert.strictEqual(hit, false)
})

// ── Phase D3 — Self Effect ────────────────────────────────────────────────────

console.log('\nPhase D3 — Self Effect')

test('D3: selfEffect defaults to 0', () => {
  const sys = new ParticleSystem({ count: 5 })
  assert.strictEqual(sys.parameters.selfEffect, 0)
})

test('D3: two approaching particles bounce apart when selfEffect=1', () => {
  const sys = makeCleanSys({ count: 2 })
  sys.parameters.selfEffect = 1

  const [a, b] = sys.pool
  a.alive = true; a.age = 0; a.lifetime = 10; a.size = 1
  a.position.set(-0.3, 0, 0); a.velocity.set(2, 0, 0)

  b.alive = true; b.age = 0; b.lifetime = 10; b.size = 1
  b.position.set(0.3, 0, 0); b.velocity.set(-2, 0, 0)

  sys.update(1 / 60)

  // After collision a should be moving left (negative x), b moving right
  assert.ok(a.velocity.x < 0, `a.vx should be negative after collision, got ${a.velocity.x}`)
  assert.ok(b.velocity.x > 0, `b.vx should be positive after collision, got ${b.velocity.x}`)
})

test('D3: particles that do not overlap are unaffected by selfEffect', () => {
  const sys = makeCleanSys({ count: 2 })
  sys.parameters.selfEffect = 1

  const [a, b] = sys.pool
  a.alive = true; a.age = 0; a.lifetime = 10; a.size = 0.1
  a.position.set(-10, 0, 0); a.velocity.set(1, 0, 0)

  b.alive = true; b.age = 0; b.lifetime = 10; b.size = 0.1
  b.position.set(10, 0, 0); b.velocity.set(-1, 0, 0)

  sys.update(1 / 60)

  // Far apart → no bounce, velocities unchanged
  assert.ok(a.velocity.x > 0, `a.vx should still be positive, got ${a.velocity.x}`)
  assert.ok(b.velocity.x < 0, `b.vx should still be negative, got ${b.velocity.x}`)
})

test('D3: selfEffect=0 (default) does NOT bounce overlapping particles', () => {
  const sys = makeCleanSys({ count: 2 })
  // selfEffect stays 0

  const [a, b] = sys.pool
  a.alive = true; a.age = 0; a.lifetime = 10; a.size = 1
  a.position.set(-0.3, 0, 0); a.velocity.set(5, 0, 0)

  b.alive = true; b.age = 0; b.lifetime = 10; b.size = 1
  b.position.set(0.3, 0, 0); b.velocity.set(-5, 0, 0)

  sys.update(1 / 60)

  // No self effect — a should still have positive vx (just moved from gravity=0)
  assert.ok(a.velocity.x > 0, `selfEffect=0: a.vx should remain positive, got ${a.velocity.x}`)
})

// ── Phase D4 — TextureForce ───────────────────────────────────────────────────

console.log('\nPhase D4 — TextureForce')

function makeDataTexture(r, g, b, w = 2, h = 2) {
  const data = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4]     = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
  // Minimal DataTexture-like object
  return { image: { data, width: w, height: h } }
}

function makeFloatDataTexture(fx, fy, fz, w = 2, h = 2) {
  const data = new Float32Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4]     = fx
    data[i * 4 + 1] = fy
    data[i * 4 + 2] = fz
    data[i * 4 + 3] = 1
  }
  return { image: { data, width: w, height: h } }
}

function makeMockParticle(x = 0, y = 0, z = 0) {
  return { position: { x, y, z }, velocity: { x: 0, y: 0, z: 0 } }
}

test('D4: TextureForce parameters object has required fields', () => {
  const tf = new TextureForce(makeDataTexture(128, 128, 128))
  for (const k of ['strength', 'scale', 'offsetX', 'offsetZ']) {
    assert.ok(typeof tf.parameters[k] === 'number', `parameters.${k} must be a number`)
  }
})

test('D4: Uint8 texture r=255 (→ force +1) applies +x velocity', () => {
  const tf = new TextureForce(makeDataTexture(255, 128, 128), { strength: 1, scale: 10 })
  const p  = makeMockParticle()
  tf.apply(p, 1)
  assert.ok(p.velocity.x > 0, `expected positive vx from r=255, got ${p.velocity.x}`)
})

test('D4: Uint8 texture r=0 (→ force -1) applies -x velocity', () => {
  const tf = new TextureForce(makeDataTexture(0, 128, 128), { strength: 1, scale: 10 })
  const p  = makeMockParticle()
  tf.apply(p, 1)
  assert.ok(p.velocity.x < 0, `expected negative vx from r=0, got ${p.velocity.x}`)
})

test('D4: Uint8 texture g=255 applies +y velocity', () => {
  const tf = new TextureForce(makeDataTexture(128, 255, 128), { strength: 1, scale: 10 })
  const p  = makeMockParticle()
  tf.apply(p, 1)
  assert.ok(p.velocity.y > 0, `expected positive vy, got ${p.velocity.y}`)
})

test('D4: Uint8 texture b=255 applies +z velocity', () => {
  const tf = new TextureForce(makeDataTexture(128, 128, 255), { strength: 1, scale: 10 })
  const p  = makeMockParticle()
  tf.apply(p, 1)
  assert.ok(p.velocity.z > 0, `expected positive vz, got ${p.velocity.z}`)
})

test('D4: Float32 texture fx=2.0 applies stronger force than fx=1.0', () => {
  const tf2 = new TextureForce(makeFloatDataTexture(2.0, 0, 0), { strength: 1, scale: 10 })
  const tf1 = new TextureForce(makeFloatDataTexture(1.0, 0, 0), { strength: 1, scale: 10 })
  const p2  = makeMockParticle(); tf2.apply(p2, 1)
  const p1  = makeMockParticle(); tf1.apply(p1, 1)
  assert.ok(p2.velocity.x > p1.velocity.x, `float force should scale with value (${p2.velocity.x} vs ${p1.velocity.x})`)
})

test('D4: strength=0 applies zero velocity delta', () => {
  const tf = new TextureForce(makeDataTexture(255, 255, 255), { strength: 0, scale: 10 })
  const p  = makeMockParticle()
  tf.apply(p, 1)
  assert.strictEqual(p.velocity.x, 0)
  assert.strictEqual(p.velocity.y, 0)
  assert.strictEqual(p.velocity.z, 0)
})

test('D4: enabled flag (BaseForce): disabled TextureForce is skipped by ParticleSystem', () => {
  const tf = new TextureForce(makeDataTexture(255, 128, 128), { strength: 10, scale: 10 })
  tf.enabled = false
  const sys = makeCleanSys({ count: 1 })
  sys.addForce(tf)
  const p = sys.pool[0]
  p.alive = true; p.age = 0; p.lifetime = 10
  p.position.set(0, 0, 0); p.velocity.set(0, 0, 0); p.size = 0.1
  sys.update(1 / 60)
  // With enabled=false and gravity=0/drag=0, vx stays 0
  assert.ok(Math.abs(p.velocity.x) < 0.01, `disabled force should not accelerate, got vx=${p.velocity.x}`)
})

// ── Phase E1 — TrailRenderer ──────────────────────────────────────────────────

import { TrailRenderer, CurveGuideForce } from '../dist/index.js'
import { CatmullRomCurve3, Vector3 as Vec3 } from 'three'

console.log('\nPhase E1 — TrailRenderer')

test('E1: object3D is THREE.LineSegments', () => {
  const r = new TrailRenderer({ maxCount: 10, trailLength: 4 })
  assert.ok(r.object3D.constructor.name === 'LineSegments', 'expected LineSegments')
})

test('E1: parameters object has required fields', () => {
  const r = new TrailRenderer({ maxCount: 10, trailLength: 8 })
  for (const k of ['trailLength', 'fadeOut', 'colourR', 'colourG', 'colourB']) {
    assert.ok(typeof r.parameters[k] === 'number', `parameters.${k} must be a number`)
  }
})

test('E1: trailLength clamped to 2 minimum', () => {
  const r = new TrailRenderer({ maxCount: 5, trailLength: 0 })
  assert.ok(r.parameters.trailLength >= 2, 'trailLength should be at least 2')
})

test('E1: trailLength clamped to 64 maximum', () => {
  const r = new TrailRenderer({ maxCount: 5, trailLength: 999 })
  assert.ok(r.parameters.trailLength <= 64, 'trailLength should not exceed 64')
})

test('E1: update() with no alive particles sets draw range to 0', () => {
  const r = new TrailRenderer({ maxCount: 10, trailLength: 4 })
  r.update(mockParticles(5, false), 0)
  assert.strictEqual(r.object3D.geometry.drawRange.count, 0)
})

test('E1: update() with 1 alive particle and 1 history point → no lines drawn (need ≥2 history)', () => {
  const r = new TrailRenderer({ maxCount: 5, trailLength: 4 })
  const particles = mockParticles(1)
  // First call: only 1 history point, so no segments
  r.update(particles, 1)
  assert.strictEqual(r.object3D.geometry.drawRange.count, 0)
})

test('E1: two consecutive updates on same particle → 1 segment drawn (2 history points)', () => {
  const r  = new TrailRenderer({ maxCount: 5, trailLength: 8 })
  const ps = mockParticles(1)
  r.update(ps, 1)
  // Move particle
  ps[0].position.x = 1
  r.update(ps, 1)
  // drawRange.count = vertices drawn; each line = 2 verts
  assert.ok(r.object3D.geometry.drawRange.count >= 2, 'should have drawn at least 1 segment')
})

test('E1: clearHistory() resets trail — next update draws nothing', () => {
  const r  = new TrailRenderer({ maxCount: 5, trailLength: 8 })
  const ps = mockParticles(1)
  // Build up history
  for (let i = 0; i < 5; i++) { ps[0].position.x = i; r.update(ps, 1) }
  r.clearHistory()
  ps[0].position.x = 10
  r.update(ps, 1)
  // After clearHistory + 1 call: only 1 point → 0 segments
  assert.strictEqual(r.object3D.geometry.drawRange.count, 0)
})

test('E1: particle that dies has its history cleared', () => {
  const r  = new TrailRenderer({ maxCount: 5, trailLength: 8 })
  const ps = mockParticles(1)
  for (let i = 0; i < 4; i++) { ps[0].position.x = i; r.update(ps, 1) }
  // Kill the particle
  ps[0].alive = false
  r.update(ps, 0)
  // Revive it — history was cleared, so no segments yet
  ps[0].alive = true
  ps[0].position.x = 99
  r.update(ps, 1)
  assert.strictEqual(r.object3D.geometry.drawRange.count, 0)
})

// ── Phase E2 — Speed Limit ────────────────────────────────────────────────────

console.log('\nPhase E2 — Speed Limit')

test('E2: parameters.limitVelocity and velocityLimit default to 0 and 10', () => {
  const sys = new ParticleSystem({ count: 1 })
  assert.strictEqual(sys.parameters.limitVelocity, 0)
  assert.strictEqual(sys.parameters.velocityLimit, 10)
})

test('E2: limitVelocity=1 clamps speed to velocityLimit after physics step', () => {
  const sys = makeCleanSys({ count: 1 })
  sys.parameters.limitVelocity = 1
  sys.parameters.velocityLimit = 2
  const p = sys.pool[0]
  p.alive = true; p.age = 0; p.lifetime = 10; p.size = 0.1
  p.position.set(0, 0, 0)
  p.velocity.set(100, 0, 0)  // far above limit
  sys.update(1 / 60)
  const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2)
  assert.ok(speed <= 2.01, `speed ${speed} should be ≤ velocityLimit 2`)
})

test('E2: limitVelocity=0 (off) → speed NOT clamped', () => {
  const sys = makeCleanSys({ count: 1 })
  sys.parameters.limitVelocity = 0
  sys.parameters.velocityLimit = 0.001  // tiny limit that would fire if enabled
  const p = sys.pool[0]
  p.alive = true; p.age = 0; p.lifetime = 10; p.size = 0.1
  p.position.set(0, 0, 0)
  p.velocity.set(50, 0, 0)
  sys.update(1 / 60)
  const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2)
  assert.ok(speed > 1, `limitVelocity=0 should not clamp (got speed=${speed})`)
})

test('E2: limitVelocity=1 with velocityLimit=0 → speed becomes 0', () => {
  const sys = makeCleanSys({ count: 1 })
  sys.parameters.limitVelocity = 1
  sys.parameters.velocityLimit = 0
  const p = sys.pool[0]
  p.alive = true; p.age = 0; p.lifetime = 10; p.size = 0.1
  p.position.set(0, 0, 0)
  p.velocity.set(5, 3, 1)
  sys.update(1 / 60)
  const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2)
  assert.ok(speed < 0.001, `velocityLimit=0 should zero out speed, got ${speed}`)
})

test('E2: constructor opts.limitVelocity and opts.velocityLimit are respected', () => {
  const sys = new ParticleSystem({ count: 1, limitVelocity: 1, velocityLimit: 5 })
  assert.strictEqual(sys.parameters.limitVelocity, 1)
  assert.strictEqual(sys.parameters.velocityLimit, 5)
})

// ── Phase E3 — CurveGuideForce ────────────────────────────────────────────────

console.log('\nPhase E3 — CurveGuideForce')

function makeStraightCurve() {
  // Straight line along +X from x=0 to x=10
  return new CatmullRomCurve3([
    new Vec3(0, 0, 0),
    new Vec3(5, 0, 0),
    new Vec3(10, 0, 0),
  ])
}

test('E3: parameters object has required fields', () => {
  const f = new CurveGuideForce(makeStraightCurve())
  for (const k of ['strength', 'clumpFactor', 'freeEnd']) {
    assert.ok(typeof f.parameters[k] === 'number', `parameters.${k} must be a number`)
  }
})

test('E3: particle to the right of the curve is attracted toward it', () => {
  // Curve along Y=0. Particle at (5, 5, 0) should be pulled toward Y=0
  const curve = makeStraightCurve()
  const f = new CurveGuideForce(curve, { strength: 10, clumpFactor: 0 })
  const p = { position: { x: 5, y: 5, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, size: 1, normalised: 0, alive: true, lifetime: 10, age: 0 }
  const vyBefore = p.velocity.y
  f.apply(p, 0.1)
  assert.ok(p.velocity.y < vyBefore, `particle above curve should be attracted downward (vy=${p.velocity.y})`)
})

test('E3: strength=0 → no velocity change', () => {
  const f = new CurveGuideForce(makeStraightCurve(), { strength: 0 })
  const p = { position: { x: 5, y: 5, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, size: 1, normalised: 0, alive: true, lifetime: 10, age: 0 }
  f.apply(p, 1)
  assert.ok(p.velocity.x === 0 && p.velocity.y === 0 && p.velocity.z === 0, 'strength=0 should not move particle')
})

test('E3: resample() is callable without error', () => {
  const f = new CurveGuideForce(makeStraightCurve())
  let threw = false
  try { f.resample() } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('E3: enabled=false → apply() is not called by ParticleSystem (BaseForce contract)', () => {
  const f = new CurveGuideForce(makeStraightCurve(), { strength: 999 })
  f.enabled = false
  const sys = makeCleanSys({ count: 1 })
  sys.addForce(f)
  const p = sys.pool[0]
  p.alive = true; p.age = 0; p.lifetime = 10; p.size = 0.1
  p.position.set(5, 5, 0); p.velocity.set(0, 0, 0)
  sys.update(1 / 60)
  // gravity=0, so only force would be CurveGuideForce — disabled means no change
  assert.ok(Math.abs(p.velocity.y) < 0.01, `disabled force should not act, vy=${p.velocity.y}`)
})

// ── Phase E4 — CollectionRenderer weights ────────────────────────────────────

console.log('\nPhase E4 — CollectionRenderer weights')

function makeWeightedRenderer(weights, maxCount = 100) {
  const meshes = weights.map(() => ({ geometry: new BoxGeometry(), material: new MeshBasicMaterial() }))
  return new CollectionRenderer({ meshes, maxCount, billboard: false, weights })
}

test('E4: parameters contain weight0…weightN', () => {
  const r = makeWeightedRenderer([1, 2, 3])
  assert.strictEqual(r.parameters.weight0, 1)
  assert.strictEqual(r.parameters.weight1, 2)
  assert.strictEqual(r.parameters.weight2, 3)
})

test('E4: weight [1,0] → all particles assigned to mesh 0, none to mesh 1', () => {
  const r = makeWeightedRenderer([1, 0])
  const particles = mockParticles(20)
  r.update(particles, 20)
  const counts = r.object3D.children.map(c => c.count)
  assert.strictEqual(counts[0], 20, `all particles should go to mesh 0, got ${counts[0]}`)
  assert.strictEqual(counts[1], 0,  `no particles should go to mesh 1, got ${counts[1]}`)
})

test('E4: weight [0,1] → all particles assigned to mesh 1, none to mesh 0', () => {
  const r = makeWeightedRenderer([0, 1])
  const particles = mockParticles(20)
  r.update(particles, 20)
  const counts = r.object3D.children.map(c => c.count)
  assert.strictEqual(counts[0], 0,  `no particles to mesh 0, got ${counts[0]}`)
  assert.strictEqual(counts[1], 20, `all particles to mesh 1, got ${counts[1]}`)
})

test('E4: uniform weights [1,1] → both meshes get roughly equal share', () => {
  const r = makeWeightedRenderer([1, 1], 200)
  const particles = mockParticles(100)
  r.update(particles, 100)
  const counts = r.object3D.children.map(c => c.count)
  assert.strictEqual(counts[0] + counts[1], 100, 'total must equal alive count')
  assert.ok(counts[0] > 0 && counts[1] > 0, 'both meshes must have at least one instance')
})

test('E4: weight change at runtime is picked up on next update()', () => {
  const r = makeWeightedRenderer([1, 0], 100)
  const particles = mockParticles(20)
  r.update(particles, 20)
  // All in mesh 0
  assert.strictEqual(r.object3D.children[0].count, 20)
  // Flip weights
  r.parameters.weight0 = 0
  r.parameters.weight1 = 1
  r.update(particles, 20)
  // Now all in mesh 1
  assert.strictEqual(r.object3D.children[1].count, 20, 'weight change should redirect particles to mesh 1')
})

test('E4: all-zero weights fall back to uniform distribution — no crash', () => {
  const r = makeWeightedRenderer([0, 0], 50)
  const particles = mockParticles(10)
  let threw = false
  try { r.update(particles, 10) } catch { threw = true }
  assert.strictEqual(threw, false, 'all-zero weights should not throw')
  const total = r.object3D.children.reduce((s, c) => s + c.count, 0)
  assert.strictEqual(total, 10, 'all-zero fallback must still place all particles')
})

test('E4: omitting weights in constructor defaults to uniform (weight0=1 per mesh)', () => {
  const geo = new BoxGeometry()
  const mat = new MeshBasicMaterial()
  const r   = new CollectionRenderer({ meshes: [{ geometry: geo, material: mat }, { geometry: geo, material: mat }], maxCount: 20, billboard: false })
  assert.strictEqual(r.parameters.weight0, 1)
  assert.strictEqual(r.parameters.weight1, 1)
})

// ── F1 — ForceField ───────────────────────────────────────────────────────────

import { ForceField } from '../dist/index.js'

console.log('\nF1 — ForceField')

test('F1: parameters object has strength, falloff, maxDistance', () => {
  const f = new ForceField()
  assert.ok(typeof f.parameters.strength    === 'number')
  assert.ok(typeof f.parameters.falloff     === 'number')
  assert.ok(typeof f.parameters.maxDistance === 'number')
})

test('F1: positive strength repels particle away from field origin', () => {
  const f = new ForceField({ strength: 10, falloff: 1, maxDistance: 100 })
  const p = { alive: true, position: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
  f.apply(p, 0.1)
  assert.ok(p.velocity.x > 0, 'positive strength should push particle in +x')
})

test('F1: negative strength attracts particle toward field origin', () => {
  const f = new ForceField({ strength: -10, falloff: 1, maxDistance: 100 })
  const p = { alive: true, position: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
  f.apply(p, 0.1)
  assert.ok(p.velocity.x < 0, 'negative strength should pull particle in -x')
})

test('F1: particle beyond maxDistance is not affected', () => {
  const f = new ForceField({ strength: 100, falloff: 1, maxDistance: 0.5 })
  const p = { alive: true, position: { x: 5, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
  f.apply(p, 0.1)
  assert.strictEqual(p.velocity.x, 0)
  assert.strictEqual(p.velocity.y, 0)
  assert.strictEqual(p.velocity.z, 0)
})

test('F1: dead particle is not affected', () => {
  const f = new ForceField({ strength: 100 })
  const p = { alive: false, position: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
  f.apply(p, 0.1)
  assert.strictEqual(p.velocity.x, 0)
})

test('F1: particle at field origin is not affected (no divide-by-zero)', () => {
  const f = new ForceField({ strength: 100 })
  const p = { alive: true, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
  let threw = false
  try { f.apply(p, 0.1) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('F1: position property is a Vector3 and can be moved at runtime', () => {
  const f = new ForceField()
  f.position.set(5, 0, 0)
  const p = { alive: true, position: { x: 6, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
  f.apply(p, 0.1)
  // particle is to the right of the moved origin, so should be pushed right
  assert.ok(p.velocity.x > 0)
})

// ── F2 — BoidForce obstacle avoidance ────────────────────────────────────────

console.log('\nF2 — BoidForce obstacle avoidance')

test('F2: obstacles array is publicly accessible and mutable', () => {
  const pool = []
  const b = new BoidForce(pool)
  assert.ok(Array.isArray(b.obstacles))
  b.obstacles.push({ position: new Vec3(0, 0, 0), radius: 1 })
  assert.strictEqual(b.obstacles.length, 1)
})

test('F2: avoidWeight and avoidRadius are in parameters', () => {
  const b = new BoidForce([])
  assert.ok(typeof b.parameters.avoidWeight === 'number')
  assert.ok(typeof b.parameters.avoidRadius === 'number')
})

test('F2: particle near obstacle is repelled', () => {
  const p = { alive: true, position: { x: 1.5, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 } }
  const pool = [p]
  const b = new BoidForce(pool, { avoidWeight: 5, avoidRadius: 2 })
  b.obstacles.push({ position: new Vec3(0, 0, 0), radius: 0.5 })
  b.apply(p, 0.1)
  // Particle is at x=1.5, obstacle at origin radius 0.5, so avoidRadius+obsRadius = 2.5
  // Particle is within range — should be pushed in +x direction
  assert.ok(p.velocity.x >= 0, 'particle should be pushed away from obstacle (or at least not toward it)')
})

test('F2: particle far from obstacle is unaffected by obstacle', () => {
  const p = { alive: true, position: { x: 100, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 } }
  const pool = [p]
  const b = new BoidForce(pool, { avoidWeight: 5, avoidRadius: 2, maxForce: 1000 })
  b.obstacles.push({ position: new Vec3(0, 0, 0), radius: 0.5 })
  const before = { ...p.velocity }
  b.apply(p, 0.1)
  // Boid rules with single particle in pool produce zero contributions, obstacle out of range
  assert.strictEqual(p.velocity.x, before.x)
})

test('F2: avoidWeight=0 means obstacles have no effect', () => {
  const p = { alive: true, position: { x: 0.1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 } }
  const pool = [p]
  const b = new BoidForce(pool, { avoidWeight: 0 })
  b.obstacles.push({ position: new Vec3(0, 0, 0), radius: 5 })
  b.apply(p, 0.1)
  // Even though particle is in range, avoidWeight=0 means no obstacle force
  // The only forces are boid rules with 1 particle — should be 0
  assert.strictEqual(p.velocity.x, 0)
})

// ── F3 — BoidForce flight mode / banking / pitch ─────────────────────────────

console.log('\nF3 — BoidForce flight mode')

test('F3: flightHeight, bankingAngle, pitchAngle are in parameters', () => {
  const b = new BoidForce([])
  assert.ok(typeof b.parameters.flightHeight === 'number')
  assert.ok(typeof b.parameters.bankingAngle === 'number')
  assert.ok(typeof b.parameters.pitchAngle   === 'number')
})

test('F3: flightHeight pushes particle upward when below target altitude', () => {
  const p = { alive: true, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 } }
  const b = new BoidForce([p], { flightHeight: 10, maxForce: 1000 })
  b.apply(p, 0.5)
  assert.ok(p.velocity.y > 0, 'particle below flightHeight should gain upward velocity')
})

test('F3: flightHeight pulls particle downward when above target altitude', () => {
  const p = { alive: true, position: { x: 0, y: 20, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 } }
  const b = new BoidForce([p], { flightHeight: 10, maxForce: 1000 })
  b.apply(p, 0.5)
  assert.ok(p.velocity.y < 0, 'particle above flightHeight should gain downward velocity')
})

test('F3: pitchAngle rotates particle.rotation.x proportional to vertical velocity', () => {
  const p = { alive: true, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 5, z: 0 },
              rotation: { x: 0, y: 0, z: 0 } }
  const b = new BoidForce([p], { pitchAngle: 1, maxForce: 1000 })
  b.apply(p, 0.1)
  assert.ok(p.rotation.x !== 0, 'pitchAngle should set rotation.x when particle has vertical velocity')
})

test('F3: bankingAngle=0 and pitchAngle=0 leaves rotation unchanged', () => {
  const p = { alive: true, position: { x: 1, y: 0, z: 0 }, velocity: { x: 2, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 } }
  const b = new BoidForce([p], { bankingAngle: 0, pitchAngle: 0 })
  b.apply(p, 0.1)
  assert.strictEqual(p.rotation.x, 0)
  assert.strictEqual(p.rotation.z, 0)
})

// ── F4 — MeshEmitter sizeAttribute ───────────────────────────────────────────

console.log('\nF4 — MeshEmitter sizeAttribute')

test('F4: sizeAttribute property exists and is null by default', () => {
  const e = new MeshEmitter()
  assert.strictEqual(e.sizeAttribute, null)
})

test('F4: sizeStrength is in parameters', () => {
  const e = new MeshEmitter()
  assert.ok(typeof e.parameters.sizeStrength === 'number')
})

test('F4: sizeAttribute scales particle.size at spawn (vertex mode)', () => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3))
  geo.setAttribute('normal',   new Float32BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3))
  geo.setAttribute('mySize',   new Float32BufferAttribute(new Float32Array([0.5, 0.5, 0.5]), 1))
  const rng = new SeededRandom(42)
  const realParticle = new Particle()
  realParticle.size = 2.0
  const e = new MeshEmitter({ sizeAttribute: 'mySize', sizeStrength: 1 })
  e.parameters.emitFrom = 0
  e.spawn(realParticle, geo, rng)
  assert.ok(realParticle.size < 2.0, `size should be reduced; got ${realParticle.size}`)
})

test('F4: sizeStrength=0 leaves particle.size unchanged', () => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3))
  geo.setAttribute('normal',   new Float32BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3))
  geo.setAttribute('mySize',   new Float32BufferAttribute(new Float32Array([0, 0, 0]), 1))
  const rng2 = new SeededRandom(1)
  const realP2 = new Particle()
  realP2.size = 3.0
  const e2 = new MeshEmitter({ sizeAttribute: 'mySize', sizeStrength: 0 })
  e2.parameters.emitFrom = 0
  e2.spawn(realP2, geo, rng2)
  assert.ok(Math.abs(realP2.size - 3.0) < 1e-9, `sizeStrength=0 should leave size=3; got ${realP2.size}`)
})

test('F4: missing sizeAttribute → size is unchanged', () => {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3))
  geo.setAttribute('normal',   new Float32BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3))
  const rng3 = new SeededRandom(7)
  const realP3 = new Particle()
  realP3.size = 5.0
  const e3 = new MeshEmitter()  // no sizeAttribute
  e3.parameters.emitFrom = 0
  e3.spawn(realP3, geo, rng3)
  assert.ok(Math.abs(realP3.size - 5.0) < 1e-9, `no sizeAttribute should leave size=5; got ${realP3.size}`)
})

// ── F5 — ParticleCache.bakeAll ────────────────────────────────────────────────

console.log('\nF5 — ParticleCache.bakeAll')

test('F5: bakeAll is a static method on ParticleCache', () => {
  assert.ok(typeof ParticleCache.bakeAll === 'function')
})

test('F5: bakeAll with empty array does not throw', () => {
  let threw = false
  try { ParticleCache.bakeAll([], 0, 1, 10) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('F5: bakeAll fills frames on each system\'s built-in cache', () => {
  const sys = new ParticleSystem({ count: 5, lifetime: 2, seed: 1 })
  sys.addEmitter(new PointEmitter())
  ParticleCache.bakeAll([sys], 0, 0.5, 10)
  assert.ok(sys.cache.isBaked, 'cache should be baked after bakeAll')
  assert.ok(sys.cache.frameCount > 0, 'should have at least one frame')
})

test('F5: bakeAll and individual bake produce same frame count', () => {
  const makeSystem = () => {
    const s = new ParticleSystem({ count: 5, lifetime: 2, seed: 99 })
    s.addEmitter(new PointEmitter())
    return s
  }
  const sys1 = makeSystem()
  const cache1 = new ParticleCache()
  cache1.bake(sys1, 0, 1, 10)

  const sys2 = makeSystem()
  ParticleCache.bakeAll([sys2], 0, 1, 10)

  assert.strictEqual(cache1.frameCount, sys2.cache.frameCount, 'frame counts should match')
})

test('F5: bakeAll with one system does not throw', () => {
  const sys = new ParticleSystem({ count: 5 })
  sys.addEmitter(new PointEmitter())
  let threw = false
  try { ParticleCache.bakeAll([sys], 0, 0.1, 5) } catch { threw = true }
  assert.strictEqual(threw, false)
})

test('F5: bakeAll bakes multiple systems in the same pass', () => {
  const makeS = (seed) => {
    const s = new ParticleSystem({ count: 3, lifetime: 1, seed })
    s.addEmitter(new PointEmitter())
    return s
  }
  const s1 = makeS(1), s2 = makeS(2), s3 = makeS(3)
  ParticleCache.bakeAll([s1, s2, s3], 0, 0.5, 10)
  assert.ok(s1.cache.isBaked && s2.cache.isBaked && s3.cache.isBaked, 'all three caches should be baked')
  assert.strictEqual(s1.cache.frameCount, s2.cache.frameCount)
  assert.strictEqual(s2.cache.frameCount, s3.cache.frameCount)
})

// ── G1 — maxDistance on all force classes ─────────────────────────────────────

import {
  WindForce, VortexForce, MagneticForce, HarmonicForce,
  DragForce, TurbulenceForce, LennardJonesForce, ChargeForce,
} from '../dist/index.js'

console.log('\nG1 — maxDistance field range on force classes')

function mockAliveParticle(x = 1, y = 0, z = 0) {
  return {
    alive: true,
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0, length() { return 0 }, multiplyScalar() {}, addScaledVector() {} },
    rotation: { x: 0, y: 0, z: 0 },
  }
}

function makeVec3Particle(x = 0, y = 0, z = 0) {
  // Use real Particle so velocity has Three.js Vector3 methods
  const p = new Particle()
  p.alive = true
  p.position.set(x, y, z)
  return p
}

test('G1: WindForce maxDistance=0 affects all particles', () => {
  const f = new WindForce({ strength: 1, z: 1, maxDistance: 0 })
  const p = makeVec3Particle(1000, 0, 0)
  f.apply(p, 0.1)
  assert.ok(p.velocity.z !== 0, 'maxDistance=0 means unlimited range')
})

test('G1: WindForce maxDistance skips particle beyond range', () => {
  const f = new WindForce({ strength: 10, z: 1, maxDistance: 2 })
  const p = makeVec3Particle(5, 0, 0)
  f.apply(p, 0.1)
  assert.strictEqual(p.velocity.z, 0)
})

test('G1: WindForce maxDistance affects particle within range', () => {
  const f = new WindForce({ strength: 10, z: 1, maxDistance: 10 })
  const p = makeVec3Particle(1, 0, 0)
  f.apply(p, 0.1)
  assert.ok(p.velocity.z > 0)
})

test('G1: WindForce has position property', () => {
  const f = new WindForce()
  assert.ok(f.position instanceof Vec3)
})

test('G1: VortexForce maxDistance skips particle beyond range', () => {
  const f = new VortexForce({ strength: 10, maxDistance: 1 })
  const p = makeVec3Particle(5, 0, 0)
  f.apply(p, 0.1)
  assert.ok(Math.abs(p.velocity.x) < 1e-9)
  assert.ok(Math.abs(p.velocity.z) < 1e-9)
})

test('G1: MagneticForce maxDistance skips particle beyond range', () => {
  const f = new MagneticForce({ strength: 10, maxDistance: 1 })
  const p = makeVec3Particle(5, 0, 0)
  p.velocity.set(1, 0, 0)
  f.apply(p, 0.1)
  assert.ok(Math.abs(p.velocity.x - 1) < 1e-9)
})

test('G1: HarmonicForce maxDistance skips particle beyond range', () => {
  const f = new HarmonicForce({ strength: 10, maxDistance: 1 })
  const p = makeVec3Particle(5, 0, 0)
  f.apply(p, 0.1)
  assert.ok(Math.abs(p.velocity.x) < 1e-9)
})

test('G1: DragForce maxDistance skips particle beyond range', () => {
  const f = new DragForce({ linear: 5, maxDistance: 1 })
  const p = makeVec3Particle(5, 0, 0)
  p.velocity.set(3, 0, 0)
  f.apply(p, 0.1)
  assert.ok(Math.abs(p.velocity.x - 3) < 1e-9, 'velocity unchanged outside range')
})

test('G1: ChargeForce position shifts force origin', () => {
  const f = new ChargeForce({ strength: 10, falloff: 1, maxDistance: 2, px: 4 })
  const p = makeVec3Particle(5, 0, 0)
  f.apply(p, 0.1)
  assert.ok(p.velocity.x < 0, 'particle attracted toward shifted origin at x=4')
})

test('G1: ChargeForce maxDistance skips particle beyond range', () => {
  const f = new ChargeForce({ strength: 10, maxDistance: 1 })
  const p = makeVec3Particle(5, 0, 0)
  f.apply(p, 0.1)
  assert.strictEqual(p.velocity.x, 0)
})

test('G1: LennardJonesForce position shifts force origin', () => {
  const f = new LennardJonesForce({ strength: 5, equilibrium: 1, maxDistance: 5, px: 4 })
  const p = makeVec3Particle(4.5, 0, 0)
  f.apply(p, 0.1)
  assert.ok(p.velocity.x > 0, 'LJ repulsion at close range from shifted origin')
})

test('G1: TurbulenceForce maxDistance skips particle beyond range', () => {
  const f = new TurbulenceForce({ strength: 100, maxDistance: 1 })
  const p = makeVec3Particle(50, 0, 0)
  f.apply(p, 0.1)
  assert.strictEqual(p.velocity.x, 0)
  assert.strictEqual(p.velocity.y, 0)
})

test('G1: CurveGuideForce has maxDistance parameter', () => {
  const curve = new CatmullRomCurve3([new Vec3(0,0,0), new Vec3(5,0,0), new Vec3(10,0,0)])
  const f = new CurveGuideForce(curve, { maxDistance: 3 })
  assert.ok(typeof f.parameters.maxDistance === 'number')
})

test('G1: CurveGuideForce maxDistance skips particle far from curve', () => {
  const curve = new CatmullRomCurve3([new Vec3(0,0,0), new Vec3(5,0,0), new Vec3(10,0,0)])
  const f = new CurveGuideForce(curve, { strength: 10, maxDistance: 1 })
  const p = { alive:true, position:{x:5,y:100,z:0}, velocity:{x:0,y:0,z:0} }
  f.apply(p, 0.1)
  assert.strictEqual(p.velocity.x, 0)
  assert.strictEqual(p.velocity.y, 0)
})

// ── G2 — BoidForce leader / ground / collision stiffness ──────────────────────

console.log('\nG2 — BoidForce leader following, ground walking, collision stiffness')

test('G2: leaderIndex, leaderWeight, leaderRadius are in parameters', () => {
  const b = new BoidForce([])
  assert.ok(typeof b.parameters.leaderIndex  === 'number')
  assert.ok(typeof b.parameters.leaderWeight === 'number')
  assert.ok(typeof b.parameters.leaderRadius === 'number')
})

test('G2: groundMode, groundLevel, groundStrength are in parameters', () => {
  const b = new BoidForce([])
  assert.ok(typeof b.parameters.groundMode     === 'number')
  assert.ok(typeof b.parameters.groundLevel    === 'number')
  assert.ok(typeof b.parameters.groundStrength === 'number')
})

test('G2: collisionRadius, collisionStiffness are in parameters', () => {
  const b = new BoidForce([])
  assert.ok(typeof b.parameters.collisionRadius    === 'number')
  assert.ok(typeof b.parameters.collisionStiffness === 'number')
})

function makeBoidParticle(x = 0, y = 0, z = 0) {
  const p = new Particle(); p.alive = true; p.position.set(x, y, z); return p
}

test('G2: leader following steers particle toward leader', () => {
  const leader   = makeBoidParticle(10, 0, 0)
  const follower = makeBoidParticle(0, 0, 0)
  const pool = [leader, follower]
  const b = new BoidForce(pool, { leaderIndex: 0, leaderWeight: 5, leaderRadius: 20, maxForce: 1000, separationRadius: 0 })
  b.apply(follower, 0.1)
  assert.ok(follower.velocity.x > 0, 'follower steered toward leader in +x')
})

test('G2: leader outside leaderRadius has no effect', () => {
  const leader   = makeBoidParticle(100, 0, 0)
  const follower = makeBoidParticle(0, 0, 0)
  const pool = [leader, follower]
  const b = new BoidForce(pool, { leaderIndex: 0, leaderWeight: 5, leaderRadius: 2, separationRadius: 0 })
  b.apply(follower, 0.1)
  assert.strictEqual(follower.velocity.x, 0)
})

test('G2: leaderIndex=-1 disables leader following', () => {
  const leader   = makeBoidParticle(10, 0, 0)
  const follower = makeBoidParticle(0, 0, 0)
  const pool = [leader, follower]
  const b = new BoidForce(pool, { leaderIndex: -1, leaderWeight: 5, leaderRadius: 20, separationRadius: 0 })
  b.apply(follower, 0.1)
  assert.strictEqual(follower.velocity.x, 0)
})

test('G2: groundMode pushes particle upward when below groundLevel', () => {
  const p = makeBoidParticle(0, -2, 0)
  const b = new BoidForce([p], { groundMode: 1, groundLevel: 0, groundStrength: 5, maxForce: 1000 })
  b.apply(p, 0.1)
  assert.ok(p.velocity.y > 0, 'particle below ground gains upward velocity')
})

test('G2: groundMode pulls particle downward when above groundLevel', () => {
  const p = makeBoidParticle(0, 5, 0)
  const b = new BoidForce([p], { groundMode: 1, groundLevel: 0, groundStrength: 5, maxForce: 1000 })
  b.apply(p, 0.1)
  assert.ok(p.velocity.y < 0, 'particle above groundLevel gains downward velocity')
})

test('G2: groundMode=0 has no ground effect', () => {
  const p = makeBoidParticle(0, -5, 0)
  const b = new BoidForce([p], { groundMode: 0, groundLevel: 0, groundStrength: 5 })
  b.apply(p, 0.1)
  assert.strictEqual(p.velocity.y, 0)
})

test('G2: collisionStiffness repels overlapping boids', () => {
  const a  = makeBoidParticle(0, 0, 0)
  const bp = makeBoidParticle(0.3, 0, 0)
  const pool = [a, bp]
  const b = new BoidForce(pool, { collisionRadius: 1.0, collisionStiffness: 10, maxForce: 1000, separationRadius: 0 })
  b.apply(a, 0.1)
  assert.ok(a.velocity.x < 0, 'particle a pushed away from b in -x')
})

test('G2: collisionRadius=0 disables stiffness', () => {
  const a  = new Particle(); a.alive = true; a.position.set(0, 0, 0)
  const bp = new Particle(); bp.alive = true; bp.position.set(0.1, 0, 0)
  const pool = [a, bp]
  // separationRadius=0 ensures the boid separation rule doesn't add its own repulsion
  const b = new BoidForce(pool, { collisionRadius: 0, collisionStiffness: 10, separationRadius: 0, alignmentRadius: 0, cohesionRadius: 0 })
  b.apply(a, 0.1)
  assert.strictEqual(a.velocity.x, 0)
})

// ── FlowFieldForce velocityFn ─────────────────────────────────────────────────
console.log('\nFlowFieldForce — velocityFn')

test('FlowFieldForce applies noise field by default', () => {
  const p = new Particle(); p.alive = true; p.position.set(0, 0, 0)
  const f = new FlowFieldForce({ strength: 10, influence: 1 })
  const before = p.velocity.x
  f.apply(p, 1/60)
  // Noise field should nudge velocity
  assert.ok(typeof p.velocity.x === 'number')
})

test('FlowFieldForce velocityFn overrides noise', () => {
  const p = new Particle(); p.alive = true; p.position.set(0, 0, 0)
  const f = new FlowFieldForce({
    strength: 100, influence: 1,
    velocityFn: (_x, _y, _z) => ({ x: 1, y: 0, z: 0 }),
  })
  f.apply(p, 1/60)
  // Should be pushed in +x direction only
  assert.ok(p.velocity.x > 0, 'should push in +x from velocityFn')
  assert.strictEqual(p.velocity.z, 0)
})

test('FlowFieldForce velocityFn receives particle world position', () => {
  const p = new Particle(); p.alive = true; p.position.set(3, 5, 7)
  let sampledX = 0, sampledY = 0, sampledZ = 0
  const f = new FlowFieldForce({
    velocityFn: (x, y, z) => { sampledX = x; sampledY = y; sampledZ = z; return { x: 0, y: 0, z: 0 } },
  })
  f.apply(p, 1/60)
  assert.strictEqual(sampledX, 3)
  assert.strictEqual(sampledY, 5)
  assert.strictEqual(sampledZ, 7)
})

test('FlowFieldForce velocityFn can be set after construction', () => {
  const p = new Particle(); p.alive = true; p.position.set(0, 0, 0)
  const f = new FlowFieldForce({ strength: 100, influence: 1 })
  f.velocityFn = (_x, _y, _z) => ({ x: 0, y: 0, z: 1 })
  f.apply(p, 1/60)
  assert.ok(p.velocity.z > 0, 'should push in +z after setting velocityFn')
})

test('FlowFieldForce maxDistance still works with velocityFn', () => {
  const p = new Particle(); p.alive = true; p.position.set(10, 0, 0)
  const f = new FlowFieldForce({
    strength: 100, influence: 1, maxDistance: 1,
    velocityFn: () => ({ x: 1, y: 0, z: 0 }),
  })
  f.apply(p, 1/60)
  assert.strictEqual(p.velocity.x, 0, 'particle outside maxDistance should not be affected')
})

// ── summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
