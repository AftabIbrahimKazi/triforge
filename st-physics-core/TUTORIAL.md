# st-physics-core Tutorial

Blender-matched cloth simulation using Verlet integration, spring constraints, and pluggable colliders.

Mirrors Blender's **Cloth modifier** workflow.

---

## Installation

```bash
npm install three
# Use from dist/ — build with: npm run build
```

---

## Quick Start — Hanging Flag

```typescript
import { ClothSimulator, WindForce } from './dist/index.js'
import { PlaneGeometry, Mesh, MeshStandardMaterial, BufferGeometry } from 'three'

// 1. Create a 24×16 cloth grid
const cloth = new ClothSimulator(24, 16, {
  gravity:    9.8,   // m/s² — Blender: Field Weights > Gravity
  stiffness:  0.8,   // Blender: Cloth > Stiffness > Tension
  bending:    0.2,   // Blender: Cloth > Stiffness > Bending
  damping:    0.01,  // Blender: Cloth > Damping > Spring
  iterations: 8,     // Blender: Quality > Steps
  substeps:   4,
})

// 2. Seed positions from a Three.js geometry
const geometry = new THREE.PlaneGeometry(3, 2, 24, 16)
cloth.setFromGeometry(geometry)

// 3. Pin the left edge (column 0) — flag on a pole
cloth.pinColumn(0)

// 4. Add wind
const wind = new WindForce({ direction: [1, 0.1, 0.2], strength: 5, turbulence: 0.4 })
cloth.setWind(wind)

// 5. Step each frame (in animation loop)
cloth.step(clock.getDelta())

// 6. Write results back to geometry
cloth.apply(geometry)
```

---

## ClothSimulator

```typescript
const cloth = new ClothSimulator(segmentsX, segmentsY, options)
```

### Options

| Option | Default | Blender equivalent |
|---|---|---|
| `gravity` | `9.8` | Field Weights > Gravity |
| `stiffness` | `0.8` | Cloth > Stiffness > Tension |
| `bending` | `0.2` | Cloth > Stiffness > Bending |
| `damping` | `0.01` | Cloth > Damping > Spring |
| `iterations` | `8` | Quality > Steps |
| `substeps` | `4` | Simulation substeps per frame |
| `mass` | `0.3` | Cloth > Mass |

All options are also exposed as `cloth.parameters.*` for runtime animation:

```typescript
cloth.parameters.stiffness = 0.5  // works with GSAP, st-keyframe, etc.
```

### Pinning

```typescript
cloth.pin(index)        // pin single vertex by flat index
cloth.unpin(index)      // release
cloth.pinRow(row)       // pin entire row (0 = bottom, segmentsY = top)
cloth.pinColumn(col)    // pin entire column (0 = left, segmentsX = right)
cloth.isPinned(index)   // boolean

// Teleport a pinned vertex (e.g. dragging a corner)
cloth.setPosition(index, x, y, z)
```

### Simulation

```typescript
cloth.step(dt)          // advance by dt seconds (use clock.getDelta(), clamped to 0.05)
cloth.apply(geometry)   // write results to BufferGeometry position attribute + recompute normals
cloth.getPositions()    // read-only Float64Array [x0,y0,z0, x1,y1,z1, ...]
```

---

## Colliders

Colliders push cloth particles to their surface when penetration is detected.

### PlaneCollider — infinite flat plane

```typescript
import { PlaneCollider } from './dist/index.js'

const floor = new PlaneCollider({
  point:   [0, 0, 0],    // point on the plane
  normal:  [0, 1, 0],    // normal pointing away from solid side (unit length)
  friction: 0.1,
})
cloth.addCollider(floor)
```

### SphereCollider

```typescript
import { SphereCollider } from './dist/index.js'

const ball = new SphereCollider({
  center:   [0, 1, 0],
  radius:   0.8,
  friction: 0.05,
})
cloth.addCollider(ball)

// Animate the sphere by updating its parameters:
ball.parameters.centerX = Math.sin(t)
```

### CapsuleCollider — cylinder with hemispherical caps

Good for character bodies and limbs.

```typescript
import { CapsuleCollider } from './dist/index.js'

const arm = new CapsuleCollider({
  a:        [0, 0, 0],   // endpoint A
  b:        [0, 1.5, 0], // endpoint B
  radius:   0.15,
  friction: 0.1,
})
cloth.addCollider(arm)
```

### Managing colliders

```typescript
cloth.addCollider(c)
cloth.removeCollider(c)
cloth.clearColliders()
c.enabled = false         // temporarily disable without removing
```

---

## WindForce

```typescript
import { WindForce } from './dist/index.js'

const wind = new WindForce({
  direction:  [1, 0, 0.3],  // world-space direction (auto-normalized)
  strength:   5,             // m/s² — Blender: Strength
  turbulence: 0.4,           // 0–1 noise amplitude — Blender: Noise
  frequency:  1.0,           // noise evolution speed
})
cloth.setWind(wind)

// Animate wind direction at runtime:
wind.parameters.dirX = Math.cos(t)
wind.parameters.dirZ = Math.sin(t)
wind.parameters.strength = 8
```

Remove wind:
```typescript
cloth.setWind(null)
```

---

## Spring Types

The simulator builds three spring types automatically from the grid topology:

| Type | Connection | Purpose |
|---|---|---|
| Structural | Adjacent vertices (right, up) | Maintains cloth dimensions |
| Shear | Diagonal neighbours | Prevents skewing |
| Bend | Skip-one vertices | Resists folding |

The `bending` parameter scales bend spring stiffness as a fraction of `stiffness`.

---

## Performance

| Resolution | step() time | Notes |
|---|---|---|
| 20×20 (441 verts) | ~1.85 ms | well within 16 ms budget |
| 40×40 (1681 verts) | ~6.5 ms | still real-time |

Measured with substeps=4, iterations=8 on Windows 11 / Node.js.

---

## Workflow with Three.js

```typescript
import { Clock, PlaneGeometry, Mesh, MeshStandardMaterial } from 'three'

const SEG_X = 20, SEG_Y = 20
const geometry = new PlaneGeometry(3, 3, SEG_X, SEG_Y)
const material = new MeshStandardMaterial({ side: THREE.DoubleSide })
const mesh = new Mesh(geometry, material)
scene.add(mesh)

const cloth = new ClothSimulator(SEG_X, SEG_Y)
cloth.setFromGeometry(geometry)
cloth.pinRow(SEG_Y)  // top edge pinned

const clock = new Clock()
function animate() {
  requestAnimationFrame(animate)
  cloth.step(Math.min(clock.getDelta(), 0.05))
  cloth.apply(geometry)
  renderer.render(scene, camera)
}
animate()
```

---

## Rigid Body World

A full rigid-body simulation with impulse-based collision resolution,
gravity, and a constraint solver. Mirrors Blender's **Rigid Body World**
(Scene Properties > Rigid Body World).

```typescript
import { RigidBodyWorld, RigidBody } from './dist/index.js'

const world = new RigidBodyWorld({ gravity: [0, -9.8, 0], substeps: 4 })

// Create bodies
const floor = world.createBody({ shape: 'box',    mass: 0, size: [10, 0.1, 10], position: [0,-1,0] })
const ball  = world.createBody({ shape: 'sphere', mass: 1, size: 0.5,           position: [0, 5, 0] })

// In animation loop:
world.step(clock.getDelta())
mesh.position.copy(ball.position)
mesh.quaternion.copy(ball.orientation)
```

Shapes: `'sphere'` | `'box'` | `'capsule'`.

All scalar parameters live on `body.parameters` for GSAP/st-keyframe:
```typescript
body.parameters.restitution = 0.9  // bounciness
body.parameters.linearDamping = 0.05
```

---

## Rigid Body Constraints

Constraints are solved every physics substep. Add them with
`world.addConstraint(c)`.

### FixedConstraint — lock two bodies together

Blender: Rigid Body Constraint > Fixed.

```typescript
import { FixedConstraint } from './dist/index.js'

const c = new FixedConstraint(bodyA, bodyB, { stiffness: 0.8, damping: 0.1 })
world.addConstraint(c)
```

### HingeConstraint — rotate around a pivot

Blender: Rigid Body Constraint > Hinge.

```typescript
import { HingeConstraint } from './dist/index.js'

const hinge = new HingeConstraint(bodyA, bodyB, [pivotX, pivotY, pivotZ], {
  stiffness: 0.8,
  useLimits: true,
  limitMin: -Math.PI / 4,
  limitMax:  Math.PI / 4,
})
world.addConstraint(hinge)
```

### SliderConstraint — translate along one axis

Blender: Rigid Body Constraint > Slider.

```typescript
import { SliderConstraint } from './dist/index.js'

const slider = new SliderConstraint(bodyA, bodyB, [0, 1, 0], {
  useLimits: true, limitMin: 0, limitMax: 3,
})
world.addConstraint(slider)
```

### SpringConstraint — elastic spring

Blender: Rigid Body Constraint > Generic Spring.

```typescript
import { SpringConstraint } from './dist/index.js'

const spring = new SpringConstraint(bodyA, bodyB, {
  restLength: 2, stiffness: 15, damping: 0.5,
})
world.addConstraint(spring)
```

### BallSocketConstraint — free rotation, locked position

Blender: Rigid Body Constraint > Ball.

A ball-and-socket joint. Both bodies are pulled so their anchor points
(offsets captured at construction relative to each body's centre)
coincide in world space. All rotational degrees of freedom are free.
Use this for ragdoll limbs, pendulum chains, or rope-like chains.

```typescript
import { BallSocketConstraint } from './dist/index.js'

const joint = new BallSocketConstraint(
  bodyA, bodyB,
  [pivotX, pivotY, pivotZ],   // world-space pivot at construction time
  { stiffness: 0.8, damping: 0.1 },
)
world.addConstraint(joint)
```

Parameters:

| Parameter | Default | Description |
|---|---|---|
| `stiffness` | `0.8` | Position correction strength per step |
| `damping`   | `0.1` | Relative velocity damping fraction |

### ConeTwistConstraint — ball-and-socket with angle limits

Blender: Rigid Body Constraint > Cone Twist.

Extends `BallSocketConstraint` with two rotational limits:
- **Swing limit** — the angle the joint can tilt away from its axis (cone half-angle).
- **Twist limit** — how far the joint can spin around its own axis.

Ideal for shoulder, hip, and spine joints in ragdoll setups.

```typescript
import { ConeTwistConstraint } from './dist/index.js'

const shoulder = new ConeTwistConstraint(
  torso, upperArm,
  [pivotX, pivotY, pivotZ],   // world-space pivot
  [0, -1, 0],                 // primary axis (points along the limb)
  {
    stiffness:  0.8,
    damping:    0.1,
    swingLimit: Math.PI / 4,  // 45° cone half-angle
    twistLimit: Math.PI / 6,  // 30° twist limit
  },
)
world.addConstraint(shoulder)
```

Parameters:

| Parameter | Default | Description |
|---|---|---|
| `stiffness`  | `0.8`          | Position correction strength |
| `damping`    | `0.1`          | Velocity damping fraction |
| `swingLimit` | `Math.PI / 4`  | Max swing angle in radians |
| `twistLimit` | `Math.PI / 6`  | Max twist angle in radians |

### Ragdoll chain example

```typescript
import { RigidBodyWorld, BallSocketConstraint, ConeTwistConstraint } from './dist/index.js'

const world = new RigidBodyWorld({ gravity: [0, -9.8, 0], substeps: 8 })

// Static anchor at top
const anchor = world.createBody({ mass: 0, position: [0, 4, 0] })

// Chain of dynamic spheres
const bodies = [anchor]
for (let i = 1; i < 5; i++) {
  const b = world.createBody({ shape: 'sphere', mass: 1, position: [0, 4 - i * 1.4, 0] })
  bodies.push(b)

  // Use BallSocket for free-swinging joints
  const pivotY = 4 - (i - 0.5) * 1.4
  world.addConstraint(new BallSocketConstraint(
    bodies[i - 1], b,
    [0, pivotY, 0],
    { stiffness: 0.9, damping: 0.15 },
  ))
}

// Or use ConeTwist for angle-limited joints (e.g. spine)
// world.addConstraint(new ConeTwistConstraint(
//   bodies[1], bodies[2], [0, 2.3, 0], [0, -1, 0],
//   { swingLimit: Math.PI / 6, twistLimit: Math.PI / 8 },
// ))
```

### All constraints share these properties

```typescript
c.enabled = false          // temporarily disable without removing
c.parameters.stiffness = 0.5   // live-adjustable (GSAP / st-keyframe compatible)
world.removeConstraint(c)  // remove permanently
```

---

## Integrating with st-keyframe

```typescript
import { KeyframeTrack, AnimationClip, AnimationMixer } from '../st-keyframe/dist/index.js'

// Animate wind strength with an easing
const track = new KeyframeTrack(wind.parameters, 'strength', [
  { time: 0, value: 2 },
  { time: 2, value: 12, easing: 'easeInOutSine' },
  { time: 4, value: 2 },
])
const clip  = new AnimationClip('gustWind', [track])
const mixer = new AnimationMixer()
mixer.play(clip, { loop: 'loop' })

// In animation loop:
mixer.update(clock.getDelta())
```
