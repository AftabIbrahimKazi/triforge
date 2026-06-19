# @st-particle-core Tutorial

A Blender-matched particle system for Three.js — Newtonian physics, force fields, emitters, and render modes.

---

## Quick start

```javascript
import {
  ParticleSystem, PointEmitter,
  GravityForce, DragForce,
  HaloRenderer,
} from '@st-particle-core'

const sys = new ParticleSystem({ count: 500, lifetime: 2.5, size: 0.2, seed: 1 })

sys.addEmitter(new PointEmitter({ normalVelocity: 5, randomVelocity: 2 }))
   .addForce(new GravityForce(9.81))
   .addForce(new DragForce({ linear: 0.4 }))

const render = new HaloRenderer({ maxCount: 500, color: 0x88ccff, additive: true })
sys.setRenderer(render)
scene.add(render.object3D)

// In the animation loop
sys.update(clock.getDelta())
```

---

## Render modes

Every renderer:
- Accepts a `Particle[]` pool and returns / updates a `THREE.Object3D`
- Exposes a public `parameters` plain object — all scalar values are GSAP-animatable
- Never mutates the input particle array

### HaloRenderer / BillboardRenderer

Renders particles as camera-facing point sprites. Blender: **Render → Halo**.

Uses `THREE.Points` — one draw call for any number of particles.

```javascript
import { HaloRenderer } from '@st-particle-core'

const r = new HaloRenderer({
  maxCount:        1000,     // must be ≥ ParticleSystem.count
  color:           0x88ccff, // base sprite colour
  map:             null,     // optional sprite Texture
  opacity:         0.9,
  additive:        true,     // additive blending — great for fire/sparks
  fadeOut:         true,     // shrink towards end of lifetime
  sizeAttenuation: true,     // sprites scale with distance
})

sys.setRenderer(r)
scene.add(r.object3D)       // r.object3D is THREE.Points

// GSAP / keyframe animation
r.parameters.opacity = 0.5
r.parameters.fadeOut = 0     // 0 = off, 1 = on
```

`BillboardRenderer` is the same class — `HaloRenderer` is the Blender-panel name alias.

---

### LineRenderer

Renders each particle as a velocity-aligned line segment. Blender: **Render → Line**.

Uses `THREE.LineSegments` — tail at `position - velocity × lengthScale`, head at `position`.

```javascript
import { LineRenderer } from '@st-particle-core'

const r = new LineRenderer({
  maxCount:    1000,
  color:       0xffaa44,
  lengthScale: 0.15,   // line = velocity magnitude × this scale
})

sys.setRenderer(r)
scene.add(r.object3D)  // THREE.LineSegments

// Animate
r.parameters.lengthScale = 0.5
r.parameters.opacity     = 0.7
```

---

### ObjectRenderer / InstanceRenderer

Instances a single mesh at every particle position. Blender: **Render → Object**.

Uses `THREE.InstancedMesh` — one draw call regardless of particle count. Accepts any Three.js material, including compiled `@st-shader-core` node graphs.

```javascript
import { ObjectRenderer } from '@st-particle-core'

const r = new ObjectRenderer({
  geometry:  new THREE.OctahedronGeometry(0.1),
  material:  new THREE.MeshStandardMaterial({ color: 0xff6644 }),
  maxCount:  1000,
  billboard: true,   // rotate to face camera
  fadeOut:   true,   // shrink to 0 near end of lifetime
})
r.camera = camera   // required when billboard: true

sys.setRenderer(r)
scene.add(r.object3D)  // THREE.InstancedMesh

// Animate
r.parameters.billboard = 0  // 0 = off, 1 = on
r.parameters.fadeOut   = 0
```

`InstanceRenderer` is the same class — `ObjectRenderer` is the Blender-panel name alias.

---

### TrailRenderer

Draws a motion-history trail behind each alive particle. Each particle stores the last N positions; segments are connected with `THREE.LineSegments`. Blender: **Render → Path** (visual equivalent, not hair strands).

Uses `THREE.LineSegments` — one draw call for all trails.

```javascript
import { TrailRenderer } from '@st-particle-core'

const r = new TrailRenderer({
  maxCount:    500,   // must be ≥ ParticleSystem.count
  trailLength: 12,    // history segments per particle (2–64)
  fadeOut:     true,  // opacity fades from head to tail
  colour:      [1, 0.6, 0.2],  // [R, G, B] in 0–1
})

sys.setRenderer(r)
scene.add(r.object3D)  // THREE.LineSegments

// Animate
r.parameters.trailLength = 24
```

> **Note:** `StrandRenderer` is the hair/strand stub (Phase 7, blocked on `st-hair-core`). It logs a warning and renders nothing. Use `TrailRenderer` for visible motion trails today.

---

### CollectionRenderer

Picks randomly from a list of meshes and instances each group. Blender: **Render → Collection**.

Each pool slot maps deterministically to one mesh: `slot % meshes.length + seed`. One `THREE.InstancedMesh` per entry, bundled in a `THREE.Group`.

```javascript
import { CollectionRenderer } from '@st-particle-core'

const r = new CollectionRenderer({
  meshes: [
    {
      geometry: new THREE.IcosahedronGeometry(0.1, 0),
      material: new THREE.MeshStandardMaterial({ color: 0x44ffaa }),
    },
    {
      geometry: new THREE.BoxGeometry(0.15, 0.15, 0.15),
      material: new THREE.MeshStandardMaterial({ color: 0xffdd44 }),
    },
    {
      geometry: new THREE.ConeGeometry(0.08, 0.2, 6),
      material: new THREE.MeshStandardMaterial({ color: 0xff44dd }),
    },
  ],
  maxCount:  1000,   // per-mesh cap — must be ≥ ParticleSystem.count / meshes.length
  billboard: false,
  fadeOut:   true,
  seed:      7,      // shifts mesh assignment
})
r.camera = camera   // required when billboard: true

sys.setRenderer(r)
scene.add(r.object3D)  // THREE.Group containing one InstancedMesh per mesh entry

// Animate
r.parameters.seed      = 3   // changes which particles get which mesh
r.parameters.fadeOut   = 0
r.parameters.billboard = 1
```

---

## Emitters

### PointEmitter

Emits from a fixed world-space point.

```javascript
import { PointEmitter } from '@st-particle-core'

const e = new PointEmitter({
  position:       { x: 0, y: 0, z: 0 },
  normalVelocity: 5,
  randomVelocity: 2,
})
sys.addEmitter(e)
```

### MeshEmitter

Emits from the surface (or volume) of a `BufferGeometry`. Three modes:
- `emitFrom: 0` — random vertex
- `emitFrom: 1` — random point on a face (area-weighted with `evenDistribution: true`)
- `emitFrom: 2` — random point inside the bounding box

```javascript
import { MeshEmitter } from '@st-particle-core'

const e = new MeshEmitter({
  geometry:         torusGeometry,
  emitFrom:         1,
  evenDistribution: true,
  normalVelocity:   3,
  randomVelocity:   1,
})
sys.addEmitter(e)
```

### EdgeEmitter

Emits from mesh edges — designed for waterline foam effects.

```javascript
import { EdgeEmitter } from '@st-particle-core'

const e = new EdgeEmitter({
  geometry:   oceanGeometry,
  targetY:    0,
  yThreshold: 0.15,
})
sys.addEmitter(e)
```

---

## Force fields

Add any number of force fields to a system with `sys.addForce()`.

| Class | Blender | Effect |
|---|---|---|
| `GravityForce(strength)` | Gravity | Downward constant pull |
| `WindForce({ x, y, z, strength })` | Wind | Directional constant push |
| `VortexForce({ strength, axisX/Y/Z })` | Vortex | Spiral around axis |
| `TurbulenceForce({ strength, scale, speed })` | Turbulence | Noise-based random kick |
| `DragForce({ linear, quadratic })` | Drag | Velocity damping |
| `MagneticForce({ strength, axisX/Y/Z })` | Magnetic | F = v × B deflection |
| `HarmonicForce({ strength, damping, x, y, z })` | Harmonic | Spring toward a point |
| `ChargeForce({ strength, falloff })` | Force | Radial attract/repel |
| `LennardJonesForce({ strength, equilibrium })` | Lennard-Jones | Molecular attraction/repulsion |
| `ForceField({ strength, falloff, maxDistance })` | Force Fields → Force | Radial push (positive) or pull (negative) from a point |

All forces expose a `parameters` object and an `enabled` boolean.

### ForceField — radial push/pull (Blender: Force Fields → Force)

A point in world space that pushes or pulls particles radially.
Positive `strength` repels; negative `strength` attracts.
Force magnitude = `strength / (distance ^ falloff)`, clamped at `maxDistance`.

```javascript
import { ForceField } from '@st-particle-core'
import { Vector3 } from 'three'

const field = new ForceField({
  strength:    5,   // positive = repel, negative = attract
  falloff:     1,   // exponent: 0 = flat, 1 = linear, 2 = inverse-square
  maxDistance: 10,  // particles outside this radius are unaffected
})

// Move the field origin at runtime
field.position.set(0, 2, 0)

sys.addForce(field)

// Animate with GSAP
gsap.to(field.parameters, { strength: -5, duration: 2 })  // flip to attract
```

| Parameter | Default | Description |
|---|---|---|
| `strength` | `1.0` | Positive = repel, negative = attract |
| `falloff` | `1.0` | Distance exponent (0 = uniform, 1 = linear, 2 = inverse-square) |
| `maxDistance` | `10.0` | Particles beyond this distance are skipped |

```javascript
import { GravityForce, TurbulenceForce, DragForce } from '@st-particle-core'

const gravity = new GravityForce(9.81)
const turb    = new TurbulenceForce({ strength: 1.5, scale: 2, speed: 0.8 })
const drag    = new DragForce({ linear: 0.5 })

sys.addForce(gravity).addForce(turb).addForce(drag)

// Toggle at runtime
turb.enabled = false

// Animate with GSAP
gsap.to(gravity.parameters, { strength: 0, duration: 2 })
```

---

## ParticleSystem parameters

All scalar inputs live in `sys.parameters` — GSAP-animatable.

```javascript
const sys = new ParticleSystem({
  count:          500,      // total particle pool
  start:          0,        // emission start (seconds)
  end:            Infinity, // emission end (seconds)
  lifetime:       2.5,      // average lifetime (seconds)
  lifetimeRandom: 0.3,      // lifetime variation [0,1]
  size:           0.2,      // average size
  sizeRandom:     0.1,      // size variation [0,1]
  seed:           42,       // RNG seed — same seed = identical result
  physics:        'newtonian', // 'newtonian' | 'none'
  mass:           1,
  drag:           0,
  brownian:       0,
  damp:           0,
  gravity:        1,        // multiplier applied to world gravity
  displayAmount:  1,        // fraction of pool shown [0,1]
})

// Animate count over time
gsap.to(sys.parameters, { count: 100, duration: 3 })
```

---

## Emission Controls

Control when particles emit, how long they live, and how spawns are distributed across the emitter surface.

### Emission window — frameStart / frameEnd

Particles only emit while `start ≤ t ≤ end` (both in seconds). Outside this window the simulation keeps stepping alive particles but spawns no new ones.

```javascript
const sys = new ParticleSystem({
  count:    500,
  start:    1.0,   // wait 1 s before first emission (Blender: Frame Start → seconds)
  end:      5.0,   // stop emitting at 5 s           (Blender: End → seconds)
  lifetime: 2,     // particles live on past end; they just aren't replaced
})
```

Emission rate is `count / lifetime` particles per second, so the pool stays full at steady state.

### Lifetime scatter — lifetimeRandom

Each spawned particle receives a lifetime drawn from `lifetime × (1 ± lifetimeRandom × rand)`.

- `lifetimeRandom: 0` — all particles get exactly `lifetime` seconds (deterministic).
- `lifetimeRandom: 1` — lifetimes range from near-zero to `2 × lifetime`.

```javascript
const sys = new ParticleSystem({
  lifetime:       2.5,
  lifetimeRandom: 0.4,   // ±40 % scatter (Blender: Lifetime Randomness)
})

// Animate the scatter live — GSAP-compatible
gsap.to(sys.parameters, { lifetimeRandom: 0.8, duration: 2 })
```

### Seed — reproducible simulations

Set `seed` to an integer. The same seed always produces the identical particle sequence — useful for deterministic replays or A/B comparisons.

```javascript
const sys = new ParticleSystem({ seed: 42 })
sys.reset()   // rewinds to t=0 and re-seeds the RNG
```

### Random Order

When `randomOrder: true`, each new particle is placed in a random dead slot rather than the next sequential slot. This shuffles the visual birth order without changing emission rate.

```javascript
const sys = new ParticleSystem({ randomOrder: true })
```

### MeshEmitter — Emit From modes

`emitFrom` controls where on the geometry spawns appear:

| Value | Mode | Description |
|---|---|---|
| `'verts'` | Vertex | Spawn at a random vertex position |
| `'faces'` | Face | Uniform random point on a random triangle |
| `'volume'` | Volume | Random point inside the geometry's bounding box |

```javascript
import { MeshEmitter } from '@st-particle-core'

// Surface emission — particles appear on the mesh surface
const surface = new MeshEmitter({ emitFrom: 'faces', normalVelocity: 1 })

// Volume emission — particles bubble up from inside the mesh
const volume  = new MeshEmitter({ emitFrom: 'volume', randomVelocity: 1.5 })

sys.addEmitter(surface)
sys.setGeometry(sphereGeometry)
```

### MeshEmitter — Even Distribution

With `evenDistribution: false` (default), all faces are equally likely regardless of size.
With `evenDistribution: true`, each face is weighted by its area — larger faces emit proportionally more particles, producing a uniform surface density.

```javascript
const emitter = new MeshEmitter({
  emitFrom:         'faces',
  evenDistribution: true,    // (Blender: Even Distribution)
  normalVelocity:   2,
})
```

The area CDF is cached on first use and rebuilt only when the geometry changes.

---

### MeshEmitter — Source Vertex Groups (Blender: Source → Vertex Group → Density)

Weight emission density by a per-vertex float attribute — particles cluster in high-weight regions and avoid zero-weight regions, exactly like Blender's Vertex Group Density slot.

Add a `Float32BufferAttribute` with values in `[0, 1]` to your geometry, then point `weightAttribute` at its name:

```javascript
import { MeshEmitter } from '@st-particle-core'

// Build geometry with a 'density' attribute
const geo = new THREE.BufferGeometry()
// ... set position attribute ...
const weights = new Float32Array(vertexCount)
// weights[i] = 1 → full emission, 0 → no emission
geo.setAttribute('density', new THREE.Float32BufferAttribute(weights, 1))

const emitter = new MeshEmitter({
  emitFrom:         'faces',
  evenDistribution: true,   // required — vertex weights work through the CDF
  normalVelocity:   1,
})

// weightAttribute is a string, not a number — it is NOT in parameters
// because strings can't be GSAP-animated. Use weightStrength to animate blending.
emitter.weightAttribute = 'density'
```

**`weightStrength`** (in `emitter.parameters`, range `[0, 1]`, default `1`) controls how much the vertex weights are applied:

| `weightStrength` | Effect |
|---|---|
| `1` | Full weighting — weights applied exactly |
| `0.5` | Weights blended halfway toward uniform |
| `0` | Weights ignored — pure area distribution |

```javascript
// Animate the blend from clustered → uniform with GSAP
gsap.to(emitter.parameters, { weightStrength: 0, duration: 2 })
```

When `weightAttribute` is changed, the CDF is automatically rebuilt on the next spawn call.

Works with both indexed and non-indexed geometry.

### MeshEmitter — Source Vertex Groups — Size (Blender: Source → Vertex Group → Size)

Scale the spawned particle size by a per-vertex float attribute.
The attribute value at the spawn point is interpolated barycentrically and multiplied into `particle.size`.

```javascript
import { MeshEmitter } from '@st-particle-core'

// Per-vertex size weights — 1.0 = full base size, 0.0 = zero size
const sizeWeights = new Float32Array(vertexCount)
// Example: large at the top, small at the bottom
for (let i = 0; i < vertexCount; i++) {
  sizeWeights[i] = geo.getAttribute('position').getY(i) > 0 ? 1.0 : 0.1
}
geo.setAttribute('particleSize', new THREE.Float32BufferAttribute(sizeWeights, 1))

const emitter = new MeshEmitter({
  emitFrom:      'verts',
  sizeAttribute: 'particleSize',  // string — not GSAP-animatable
  sizeStrength:  1,               // in parameters — GSAP-animatable
})
emitter.sizeAttribute = 'particleSize'   // can also be set after construction
```

**`sizeStrength`** (in `emitter.parameters`, range `[0, 1]`, default `1`) blends between no effect and full effect:

| `sizeStrength` | Effect |
|---|---|
| `1` | Full attribute effect — particle.size × attribute value |
| `0.5` | Half effect |
| `0` | Attribute ignored — base particle size unchanged |

```javascript
// Animate the blend
gsap.to(emitter.parameters, { sizeStrength: 0, duration: 2 })
```

---

## Velocity & Rotation Controls

Control how particles launch and spin. All parameters live in `emitter.parameters` (velocity) or `sys.parameters` (rotation) and are GSAP-animatable.

### Velocity panel

| Parameter | Type | Blender | Description |
|---|---|---|---|
| `normalVelocity` | number | Normal | Speed along surface normal at spawn point |
| `tangentVelocity` | number | Tangent | Speed along surface tangent |
| `tangentPhase` | radians | Tangent Phase | Rotate tangent vector before applying |
| `objectVelocityX/Y/Z` | number | Object Align X/Y/Z | Speed along emitter local axes |
| `objectInherit` | 0–1 | Object Velocity | Fraction of emitter world velocity inherited by new particles |
| `randomVelocity` | number | Randomise | Random velocity kick magnitude |

```javascript
import { PointEmitter } from '@st-particle-core'

const emitter = new PointEmitter({
  normalVelocity: 3,    // launch upward along normal
  randomVelocity: 1,    // ±1 random kick in each axis
  objectInherit:  0.8,  // inherit 80% of the emitter's own velocity
})
sys.addEmitter(emitter)

// Moving emitter — update worldVelocity each frame so particles inherit it
// (computed as (newPos - oldPos) / dt)
emitter.worldVelocity.set(velocityX, velocityY, velocityZ)
```

### Rotation panel

Add to `ParticleSystem` options. Rotation and angular velocity are initialised once at spawn and then integrated every frame by the physics step.

| Parameter | Type | Blender | Description |
|---|---|---|---|
| `rotationAxis` | 0–4 | Orientation Axis | Initial rotation axis: 0=none · 1=velocity · 2=angular · 3=global · 4=local |
| `rotationPhase` | radians | Phase | Base initial rotation offset |
| `rotationPhaseRandom` | 0–1 | Phase Random | Per-particle phase scatter |
| `rotationRandom` | 0–1 | Random | Additional random scatter on top of phase |
| `angularVelocityMode` | 0–5 | Angular Velocity Axis | Spin axis: 0=none · 1=velocity · 2=horizontal(Y) · 3=vertical(X) · 4=global(Z) · 5=random |
| `angularVelocityAmount` | rad/s | Angular Velocity Amount | Spin speed |

```javascript
const sys = new ParticleSystem({
  count:    300,
  lifetime: 3,

  // Rotation panel
  rotationAxis:          2,    // spin around local Z (angular mode)
  rotationPhase:         0,    // start at 0 rad
  rotationPhaseRandom:   0.5,  // randomise phase ±π/2 per particle
  rotationRandom:        0.3,  // add extra scatter

  angularVelocityMode:   1,    // align spin axis with velocity direction
  angularVelocityAmount: 4,    // 4 rad/s spin
})
```

For `angularVelocityMode: 'velocity'`, set `angularVelocityAmount` as a number (rad/s). The spin axis is derived from the particle's initial velocity direction — fast particles and slow particles spin around the same axis but at the same rate (amount is absolute, not proportional).

**Use `ObjectRenderer` with `billboard: false`** when you want rotation to be visible — billboard mode ignores `particle.rotation` and always faces the camera.

```javascript
import { ObjectRenderer } from '@st-particle-core'

const r = new ObjectRenderer({
  geometry: arrowGeo,   // a flat, asymmetric shape so rotation is obvious
  material: mat,
  maxCount: 300,
  billboard: false,     // use particle.rotation
  fadeOut:   true,
})
sys.setRenderer(r)
```

---

## Children (Blender: Children panel)

Children are additional particles generated at render time from each alive "parent" — they cost no simulation budget because they are not tracked in the pool. Use them to thicken a sparse simulation into a dense visual without increasing physics cost.

### Parameters (in `sys.parameters`, all GSAP-animatable)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `childCount` | integer ≥ 0 | `0` | Number of children per parent. `0` = disabled. |
| `childSpread` | number ≥ 0 | `0.5` | Scatter radius (Simple) or lateral jitter (Interpolated). |
| `childType` | 0 \| 1 \| 2 | `0` | `0` = none · `1` = simple · `2` = interpolated |

### Simple children (`childType: 1`)

Each alive parent spawns `childCount` children scattered in a sphere of radius `childSpread` around the parent position.

```javascript
const sys = new ParticleSystem({
  count:       200,
  lifetime:    3,
  childCount:  8,      // 8 extra children per parent
  childSpread: 0.4,    // scatter within a 0.4-unit sphere
  childType:   1,      // simple — random sphere scatter
  seed:        42,
})
```

Total rendered particles = alive parents × (1 + `childCount`).

`childSpread: 0` places all children exactly at the parent position — useful for billboarding stacks.

### Interpolated children (`childType: 2`)

Children are placed by linearly interpolating between each alive parent and the next one in pool order. This produces a smoother, more evenly-distributed fill that follows the shape of the emitter.

```javascript
const sys = new ParticleSystem({
  count:       50,
  lifetime:    4,
  childCount:  5,      // 5 extra children interpolated between each pair
  childSpread: 0,      // no lateral scatter for clean interpolation
  childType:   2,      // interpolated
  seed:        1,
})
```

### Animating children live

All three parameters are numbers and are GSAP-animatable:

```javascript
// Burst: ramp children up then off again
gsap.timeline()
  .to(sys.parameters, { childType: 1, childCount: 15, duration: 0 })
  .to(sys.parameters, { childSpread: 1.5, duration: 0.5 })
  .to(sys.parameters, { childCount: 0, duration: 1, delay: 2 })
```

### Child RNG stability

Children are generated each frame from a fresh `SeededRandom` seeded by `sys.parameters.seed`. This means child positions are stable per-seed and do not drift even if you pause and resume the simulation. Change `seed` to shuffle the child pattern.

---

## Cache / Bake (Blender: Cache panel)

Record the simulation to a frame-indexed snapshot array and replay it deterministically at any time — no re-simulation required.

### Baking

```javascript
import { ParticleSystem, PointEmitter } from '@st-particle-core'

const sys = new ParticleSystem({ count: 300, lifetime: 3, seed: 42 })
sys.addEmitter(new PointEmitter({ normalVelocity: 2 }))

// Bake 5 seconds of simulation at 30 fps.
// After this call, sys.update(dt) replays the cache instead of simulating.
sys.bake(0, 5, 30)

console.log(sys.cache.isBaked)     // true
console.log(sys.cache.frameCount)  // Math.ceil(5 * 30) + 1 = 151

// Back to live simulation
sys.unbake()
console.log(sys.cache.isBaked)     // false
```

### Scrubbing

`cache.seek()` restores the pool to any point in the baked range, with linear interpolation between frames for sub-frame precision. Zero allocations.

```javascript
sys.bake(0, 5, 30)

// Manual scrub (e.g. from a slider)
sys.cache.seek(sys, 2.5)   // restore to t=2.5 s
sys.cache.seek(sys, 0)     // jump back to the start
sys.cache.seek(sys, 999)   // clamped to last frame
```

### Serialisation — disk cache

```javascript
// Save
const json = JSON.stringify(sys.cache.toJSON())
localStorage.setItem('myBake', json)

// Restore
import { ParticleCache } from '@st-particle-core'
const cache2 = new ParticleCache()
cache2.fromJSON(JSON.parse(localStorage.getItem('myBake')))
cache2.seek(sys, 1.0)
```

### GSAP / keyframe

```javascript
// parameters.step is an animatable scrub cursor
sys.cache.parameters.step = 0
gsap.to(sys.cache.parameters, {
  step: sys.cache.frameCount - 1,
  duration: 5,
  onUpdate: () => {
    const t = sys.cache.parameters.step / sys.cache.parameters.fps
    sys.cache.seek(sys, t)
  },
})
```

### Bake All Dynamics (Blender: Cache → Bake All Dynamics)

`ParticleCache.bakeAll()` bakes multiple systems over the same time range in one shared simulation loop — more efficient than calling `sys.bake()` on each system independently.

Each system's built-in `.cache` is populated automatically.

```javascript
import { ParticleSystem, PointEmitter, ParticleCache } from '@st-particle-core'

const sys1 = new ParticleSystem({ count: 200, lifetime: 2, seed: 1 })
sys1.addEmitter(new PointEmitter({ normalVelocity: 3 }))

const sys2 = new ParticleSystem({ count: 150, lifetime: 3, seed: 2 })
sys2.addEmitter(new PointEmitter({ normalVelocity: 2 }))

const sys3 = new ParticleSystem({ count: 100, lifetime: 1.5, seed: 3 })
sys3.addEmitter(new PointEmitter({ normalVelocity: 5 }))

// Bake all three in a single shared loop — 0 to 5 seconds at 30 fps
ParticleCache.bakeAll([sys1, sys2, sys3], 0, 5, 30)

// Each system's .cache is now populated
console.log(sys1.cache.isBaked)    // true
console.log(sys1.cache.frameCount) // same for all three

// Scrub all systems to the same point in time
function seekAll(t) {
  sys1.cache.seek(sys1, t)
  sys2.cache.seek(sys2, t)
  sys3.cache.seek(sys3, t)
}
```

---

## Boids Flocking AI (Blender: Boids physics)

`BoidForce` implements the classic separation / alignment / cohesion rules. Inject the live pool so the force can read neighbour state every tick.

```javascript
import { ParticleSystem, PointEmitter, BoidForce } from '@st-particle-core'

const sys = new ParticleSystem({
  count:   200,
  lifetime: 9999,     // persistent flock
  physics: 'newtonian',
  gravity: 0,         // boids are usually airborne
  seed:    7,
})
sys.addEmitter(new PointEmitter({ normalVelocity: 3, randomVelocity: 2 }))

// Inject the live pool reference
const boid = new BoidForce(sys.pool, {
  separationRadius:   0.5,
  separationStrength: 2.0,
  alignmentRadius:    1.5,
  alignmentStrength:  1.0,
  cohesionRadius:     2.0,
  cohesionStrength:   0.8,
  maxSpeed:           5.0,
  maxForce:           3.0,
})
sys.addForce(boid)
```

### Parameters (all GSAP-animatable)

| Parameter | Default | Description |
|---|---|---|
| `separationRadius` | `0.5` | Push apart when closer than this |
| `separationStrength` | `2.0` | Force magnitude for separation |
| `alignmentRadius` | `1.5` | Match velocity with neighbours within this radius |
| `alignmentStrength` | `1.0` | How strongly velocity is aligned |
| `cohesionRadius` | `2.0` | Pull toward centre of nearby flock |
| `cohesionStrength` | `0.8` | Pull magnitude |
| `maxSpeed` | `5.0` | Velocity magnitude clamp |
| `maxForce` | `3.0` | Per-step force magnitude clamp |

### Obstacle avoidance (Blender: Boids → Object Interaction)

Pass an optional `obstacles` array (or push to `boid.obstacles` at runtime).
When a particle comes within `avoidRadius + obstacle.radius` of any obstacle,
a repulsive steering force scaled by `avoidWeight` is applied.

```javascript
import { BoidForce } from '@st-particle-core'
import { Vector3 } from 'three'

const boid = new BoidForce(sys.pool, {
  avoidWeight: 3.0,   // how strongly obstacles are avoided
  avoidRadius: 2.0,   // detection radius around the particle (added to obstacle.radius)
})

// Add obstacles — each is a { position: Vector3, radius: number }
boid.obstacles.push({ position: new Vector3(0, 0, 0), radius: 1.5 })
boid.obstacles.push({ position: new Vector3(5, 0, 0), radius: 1.0 })

// Update obstacle position at runtime (direct mutation)
boid.obstacles[0].position.set(2, 0, 0)

// Animate avoidance intensity
gsap.to(boid.parameters, { avoidWeight: 0, duration: 1 })   // ignore obstacles
gsap.to(boid.parameters, { avoidWeight: 6, duration: 1 })   // strong avoidance
```

### Flight height + banking/pitch (Blender: Boids → Movement)

Keep the flock at a target altitude and add cosmetic banking/pitch rotation.

```javascript
const boid = new BoidForce(sys.pool, {
  flightHeight: 4.0,    // target Y altitude; restoring force ∝ (target − y)
  bankingAngle: 0.8,    // scales rotation.z into turns (cosmetic, not physics)
  pitchAngle:   0.5,    // scales rotation.x with vertical velocity (cosmetic)
})
sys.addForce(boid)

// Fly higher over time
gsap.to(boid.parameters, { flightHeight: 8, duration: 5 })
```

`flightHeight = 0` disables the altitude restoring force.
`bankingAngle` and `pitchAngle` affect `particle.rotation.z` and `particle.rotation.x`
respectively — they influence how renderers that read rotation orient each sprite or instance.

### Leader following (Blender: Boids → Follow Leader)

One particle acts as the flock leader; all others steer toward it when within `leaderRadius`.

```javascript
const boid = new BoidForce(sys.pool, {
  leaderIndex:  0,    // pool index of the leader particle
  leaderWeight: 1.5,  // attraction strength (GSAP-animatable)
  leaderRadius: 8.0,  // only followers inside this radius are attracted
})

// Move the leader manually each frame (override physics)
sys.pool[0].position.set(Math.cos(t) * 6, 0, Math.sin(t) * 6)
```

Set `leaderIndex: -1` (default) to disable leader following.

### Ground walking (Blender: Boids → Land)

Lock the flock to a horizontal ground plane, suppressing vertical motion.

```javascript
const boid = new BoidForce(sys.pool, {
  groundMode:     1,    // 0 = flight (default), 1 = ground walking
  groundLevel:    0,    // world-space Y of the ground
  groundStrength: 3.0,  // how quickly boids return to ground level
})

// Raise the ground at runtime
gsap.to(boid.parameters, { groundLevel: 2, duration: 3 })
```

### Boid–boid collision stiffness (Blender: Boids → Stiffness)

Adds a spring repulsion when two boids overlap, preventing clumping.

```javascript
const boid = new BoidForce(sys.pool, {
  collisionRadius:    0.4,  // per-boid collision sphere radius
  collisionStiffness: 8.0,  // spring constant — higher = harder push
})
```

`collisionRadius: 0` (default) disables this pass entirely.

### maxDistance on force fields (Blender: Force Field → Max Distance)

Every force class (`WindForce`, `VortexForce`, `TurbulenceForce`, `DragForce`, `MagneticForce`, `HarmonicForce`, `ChargeForce`, `LennardJonesForce`, `CurveGuideForce`, `ForceField`) accepts a `maxDistance` parameter. Particles beyond that distance from the field's `position` are skipped.

```javascript
const wind = new WindForce({ x: 1, y: 0, z: 0, strength: 3, maxDistance: 8 })
wind.position.set(-8, 0, 0)   // world-space origin of this field
sys.addForce(wind)

// Shrink the zone at runtime
gsap.to(wind.parameters, { maxDistance: 4, duration: 2 })
```

`maxDistance: 0` (default) means unlimited range.

### Live tuning

```javascript
// Animate a flock dispersal
gsap.to(boid.parameters, { separationStrength: 8, cohesionStrength: 0, duration: 2 })
```

---

## Stubbed physics — architecture slots

These classes are exported and usable today but perform no simulation until their blocking package ships.

### KeyedPhysics (blocked by st-keyframe)

```javascript
import { KeyedPhysics, ParticleSystem } from '@st-particle-core'

const target1 = new ParticleSystem({ count: 100 })
const target2 = new ParticleSystem({ count: 100 })
const keyed   = new KeyedPhysics([target1, target2])

keyed.parameters.blend = 0.5   // animatable — will blend between targets when st-keyframe ships
keyed.apply([], 0)             // no-op until then
```

### SPHPhysics (blocked by st-fluid-core)

```javascript
import { SPHPhysics } from '@st-particle-core'

const sph = new SPHPhysics({
  stiffness: 1, viscosity: 0.1, buoyancy: 0, surfaceTension: 0, repulsion: 1,
})
sph.apply([], 0)  // no-op until st-fluid-core ships
```

### StrandRenderer (blocked by st-hair-core)

```javascript
import { StrandRenderer } from '@st-particle-core'

const strands = new StrandRenderer({ maxCount: 1000 })
// strands.object3D is a THREE.Group — add to scene now, renders nothing until st-hair-core ships
scene.add(strands.object3D)

strands.parameters.thickness     = 0.02
strands.parameters.taper         = 1
strands.parameters.kinkAmplitude = 0
strands.parameters.kinkFrequency = 1
```

---

## Collisions — DeflectorCollider (C1)

Particles bounce off (or die on) arbitrary mesh surfaces. Blender parallel: **Physics → Collision** panel.

```javascript
import { DeflectorCollider, ParticleSystem, PointEmitter } from '@st-particle-core'
import { PlaneGeometry } from 'three'

// Flat horizontal floor
const floorGeo = new PlaneGeometry(20, 20)
floorGeo.rotateX(-Math.PI / 2)          // XZ plane, normal = +Y

const deflector = new DeflectorCollider(floorGeo, {
  friction:  0.1,   // 0 = frictionless, 1 = tangential velocity fully cancelled
  damping:   0.3,   // 0 = elastic (speed conserved), 1 = perfectly inelastic
  stiffness: 1,     // radius for closestPoint() query = stiffness × 0.5
})

const sys = new ParticleSystem({ count: 300, lifetime: 4 })
sys.addEmitter(new PointEmitter({ normalVelocity: 6 }))
sys.addDeflector(deflector)
```

`buildBVH()` is called automatically on first use. To rebuild after geometry changes, call it manually.

**Closest-point query** (useful for custom softbody effects):

```javascript
import { Vector3 } from 'three'
const out = { point: new Vector3(), normal: new Vector3(), dist: 0 }
if (deflector.closestPoint(px, py, pz, out)) {
  // out.point = nearest plane point, out.normal = face normal, out.dist = distance
}
```

**dieOnHit** — kill the particle on first collision:

```javascript
sys.parameters.dieOnHit = 1   // 0 = bounce (default), 1 = die on impact
```

---

## Texture Emission Density (C2)

Drive emission density from a `THREE.Texture`. The **red channel** at each face's UV centroid is used as a per-face weight. Blender parallel: **Source → Texture**.

```javascript
import { MeshEmitter } from '@st-particle-core'
import { CanvasTexture } from 'three'

// Build a checker-pattern canvas texture
const canvas = document.createElement('canvas')
canvas.width = canvas.height = 64
const ctx = canvas.getContext('2d')
// ... draw your pattern ...
const tex = new CanvasTexture(canvas)

const emitter = new MeshEmitter({ emitFrom: 'faces', evenDistribution: true })
emitter.densityTexture = tex   // null = uniform distribution (default)
```

The geometry must have a `uv` attribute. If it has none, `densityTexture` is ignored and distribution falls back to uniform (no error).

`densityTexture` and `weightAttribute` can be combined: the two weights are multiplied per face.

The CDF is rebuilt automatically when `densityTexture` or `weightAttribute` reference changes.

---

## Display Colour Modes (C3)

Colour particles by velocity speed or age. Blender parallel: **Display → Colour** panel.

```javascript
import { BillboardRenderer } from '@st-particle-core'

const renderer = new BillboardRenderer({
  maxCount:    500,
  colourMode:  1,        // 0 = flat, 1 = by velocity, 2 = by age
  colourLow:   [1, 0, 0],   // RGB [0–1] — low-speed / young
  colourHigh:  [0, 0, 1],   // RGB [0–1] — high-speed / old
  velocityMax: 10,           // speed that maps to colourHigh in mode 1
})
```

All colour parameters are numbers in the `parameters` object — safe to animate with GSAP:

```javascript
gsap.to(renderer.parameters, { colourMode: 2, duration: 1 })
gsap.to(renderer.parameters, { velocityMax: 20, duration: 2 })
```

`LineRenderer` has the same parameters and behaviour.

---

## Scale Time (C4)

Scale the simulation clock. Blender parallel: **Physics → Newtonian → Scale Time**.

```javascript
const sys = new ParticleSystem({ count: 500 })
// ...

sys.parameters.scaleTime = 1   // default — real time
sys.parameters.scaleTime = 0   // frozen — no physics, no ageing, no emission
sys.parameters.scaleTime = 2   // double speed
sys.parameters.scaleTime = -1  // reverse — existing particles age backward
```

`scaleTime` is a plain number in `parameters` — GSAP-animatable:

```javascript
// Slow-motion effect
gsap.to(sys.parameters, { scaleTime: 0, duration: 0.5 })
// Resume at normal speed
gsap.to(sys.parameters, { scaleTime: 1, duration: 0.5, delay: 2 })
```

When `scaleTime` is negative, the emission accumulator is clamped to 0 (no new particles are spawned while running backward).

---

## Display Amount (D1)

Control what fraction of alive particles are actually drawn. Blender parallel: **Display → Display Amount**.

The simulation always runs at full count — only the renderer skips proportionally.

```javascript
const sys = new ParticleSystem({ count: 1000, displayAmount: 0.5 })
// Half of alive particles are drawn each frame.

// Animate with GSAP:
gsap.to(sys.parameters, { displayAmount: 0.1, duration: 1 })
```

`displayAmount` is a plain number in `parameters` clamped to [0, 1]. All four renderers (`BillboardRenderer`, `LineRenderer`, `InstanceRenderer`, `CollectionRenderer`) respect it automatically.

---

## Size Deflect (D2)

Particles bounce off deflector surfaces at a distance equal to their radius (`size * 0.5`) instead of at exact plane contact. Blender parallel: **Physics → Newtonian → Size Deflect**.

No API change is needed — `DeflectorCollider` reads `particle.size` automatically:

```javascript
const sys = new ParticleSystem({ count: 200, size: 0.5 })
const floor = new DeflectorCollider(floorGeometry, { damping: 0.2, friction: 0.1 })
sys.addDeflector(floor)
// Particles with size=0.5 bounce 0.25 units above the floor surface.
```

Larger particles visibly float above the surface — the gap equals exactly half the particle size.

---

## Self Effect (D3)

Inter-particle collision. When two particles' centres come within `(sizeA + sizeB) * 0.5`, they exchange normal velocity components (elastic equal-mass bounce). Blender parallel: **Physics → Newtonian → Self Effect**.

```javascript
const sys = new ParticleSystem({ count: 100, size: 0.3 })
sys.parameters.selfEffect = 1   // enable (0 = off, 1 = on)
```

Performance note: this is an O(n²) neighbour scan — keep counts under ~300 for smooth frame rates. `selfEffect = 0` (the default) disables it with zero overhead.

---

## TextureForce (D4)

Drive per-particle forces from a `DataTexture`. R/G/B channels map to world-space X/Y/Z force. Blender parallel: **Force Fields → Texture**.

```javascript
import { TextureForce } from '@st-particle-core'
import { DataTexture, RGBAFormat, FloatType } from 'three'

const data = new Float32Array(64 * 64 * 4)
// fill data with force vectors ...
const flowTex = new DataTexture(data, 64, 64, RGBAFormat, FloatType)
flowTex.needsUpdate = true

const force = new TextureForce(flowTex, {
  strength: 2.0,   // global multiplier
  scale:    10.0,  // world units covered by one texture tile
})
sys.addForce(force)
```

For `Uint8` textures, channels [0, 255] remap to [−1, 1]. For `Float32` textures, values are used as-is.

Parameters — all GSAP-animatable:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `strength` | 1.0 | Global force multiplier |
| `scale` | 10.0 | World units per texture tile (tiling wraps) |
| `offsetX` | 0 | World-space X offset before UV projection |
| `offsetZ` | 0 | World-space Z offset before UV projection |

---

## Example files

`example-particle-renderers.html` — all four render modes side by side on a torus emitter.

`example-particle-emission.html` — sphere emitting from surface (faces + evenDistribution) vs volume side by side, with a live lifetimeRandom slider.

`example-particle-vertex-weight.html` — flat plane split into a high-weight left half and a zero-weight right half, with a live weightStrength slider that smoothly blends from clustered to uniform emission.

`example-particle-rotation.html` — arrow mesh particles spinning visibly; sliders for `angularVelocityAmount`, `angularVelocityMode`, `rotationRandom`, `rotationPhase`, and `objectInherit` (emitter moves on a sine path so inheritance is observable).

`example-particle-children.html` — torus emitter with live sliders for `childCount` (0–20), `childSpread` (0–2), and a toggle between childType `none` / `simple` / `interpolated`.

`example-particle-bake.html` — torus emitter, bake 5 seconds, scrub slider seeks through the baked range, live vs baked side by side. Includes a **scaleTime** slider (0 = frozen, 2 = 2× speed, −1 = reverse).

`example-particle-boids.html` — sphere emitter, 200 particles, `BoidForce` attached, live sliders for all four primary weights, emergent flocking.

`example-particle-collisions.html` — funnel of 4 tilted `DeflectorCollider` planes, 300 particles falling from above; sliders for `damping`, `friction`, `dieOnHit`.

`example-particle-texture-density.html` — flat plane with a checker canvas texture; particles spawn only on white squares; toggle between texture-driven and uniform distribution.

`example-particle-colour.html` — fountain emitter, dropdown for flat / by-velocity / by-age colour modes; colour pickers for low and high colours; `velocityMax` slider.

`example-display-amount.html` — 400 particles with a slider for `displayAmount` (0–1); shows only that fraction drawn while the full simulation keeps running.

`example-size-deflect.html` — sphere-instanced particles bouncing above a floor; particle size slider shows how the bounce gap grows with particle radius.

`example-self-effect.html` — 60 sphere particles in a bounded box, toggle Self Effect on/off to see elastic inter-particle bouncing vs pass-through; shows collision count per frame.

`example-texture-force.html` — 600 particles steered by a 32×32 curl-field DataTexture; sliders for `strength` and `scale`; texture preview shown in the corner.

`example-particle-forces.html` — four physics force tabs: `HarmonicForce` (spring to origin), `LennardJonesForce` (molecular attract/repel), `ChargeForce` (radial repulsion), `MagneticForce` (velocity-deflection spiral).

`example-particle-renderers-2.html` — four renderer tabs: `TrailRenderer` (motion history trails), `HaloRenderer` (billboard sprites with additive blending), `ObjectRenderer` (icosahedron instancing with fade), `LineRenderer` (velocity-aligned line segments with wind).

`example-particle-emitters.html` — three emitter tabs side by side: `PointEmitter` (single-point origin), `EdgeEmitter` (fires from edges of a plane geometry), `MeshEmitter` (bursts outward from a torus surface).
