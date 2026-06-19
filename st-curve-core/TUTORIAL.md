# st-curve-core Tutorial

Blender-matched Bezier / NURBS / Catmull-Rom curves.
Outputs `BufferGeometry` for tube / bevel shapes, and `Object3D` path-follow.

---

## Quick Start — Catmull-Rom tube

```typescript
import * as THREE from 'three'
import { CatmullRomCurve, CurveTube } from '@st-curve-core'

const curve = new CatmullRomCurve([
  new THREE.Vector3(-3, 0, 0),
  new THREE.Vector3(-1, 2, 1),
  new THREE.Vector3(1, -1, -1),
  new THREE.Vector3(3, 1, 0),
])

const tube = new CurveTube({ radius: 0.12, tubularSegments: 64, radialSegments: 12 })
const geo  = tube.apply(curve)
const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3399ff }))
scene.add(mesh)
```

---

## Curve Types

### CatmullRomCurve

Smooth interpolating spline — every control point lies ON the curve.
Ideal for camera paths and particle guides.

```typescript
const curve = new CatmullRomCurve(points, {
  tension: 0.5,   // Blender: curve tension. 0 = loose, 1 = tight corners
  closed: false,  // true → last point connects back to first
})

curve.getPoint(0.5)      // position at 50% along the curve
curve.getTangent(0.5)    // unit tangent at 50%
curve.getLength()        // arc length
curve.getSpacedPoints(32) // 32 evenly-spaced positions
```

### BezierCurve

Cubic Bezier with explicit handles. Maximum shape control.
Control points: `[anchor0, rightHandle0, leftHandle1, anchor1, rightHandle1, ...]`
Each segment = 3 points after the first anchor.

```typescript
import { BezierCurve, buildAutoHandles } from '@st-curve-core'

// Manual handles
const curve = new BezierCurve([
  new THREE.Vector3(0, 0, 0),   // anchor 0
  new THREE.Vector3(1, 2, 0),   // right handle of anchor 0
  new THREE.Vector3(2, 2, 0),   // left handle of anchor 1
  new THREE.Vector3(3, 0, 0),   // anchor 1
])

// Auto-handles from just anchors (Blender: Auto handle type)
const anchors = [new THREE.Vector3(0,0,0), new THREE.Vector3(1,2,0), new THREE.Vector3(2,0,0)]
const pts     = buildAutoHandles(anchors, false, 0.5)
const curve2  = new BezierCurve(pts)
```

### NURBSCurve

Non-Uniform Rational B-Spline. Exact circles and conics possible.

```typescript
import { NURBSCurve, buildNURBSCircle, buildOpenUniformKnots } from '@st-curve-core'

// General NURBS
const curve = new NURBSCurve(points, {
  order: 4,       // degree = order-1. 4 = cubic (default). Clamped to n.
  weights: [...], // per-point weights. Default all 1 (uniform B-spline).
  knots: [...],   // knot vector. Default: open uniform.
})

// Exact NURBS circle in XY plane
const { points, weights, knots } = buildNURBSCircle(radius)
const circle = new NURBSCurve(points, { order: 3, weights, knots })
```

---

## Geometry Operations

### CurveTube — round extrusion

```typescript
const tube = new CurveTube({
  tubularSegments: 64,  // rings along the tube. Blender: Resolution U
  radialSegments:  12,  // sides per ring. Blender: Resolution V
  radius:         0.1,  // tube radius. Blender: Bevel Depth
})
const geo = tube.apply(curve)
```

### CurveBevel — custom 2D profile

```typescript
import { CurveBevel } from '@st-curve-core'

// Built-in profiles
const profile = CurveBevel.circle(0.1, 12)  // round (= CurveTube)
const profile = CurveBevel.square(0.1)       // square cross-section
const profile = CurveBevel.diamond(0.1)      // diamond
const profile = CurveBevel.star(0.12, 0.05, 5)  // 5-point star

// Custom profile (array of Vector2)
const profile = [
  new THREE.Vector2(-0.05, -0.1),
  new THREE.Vector2(0.05, -0.1),
  new THREE.Vector2(0.05, 0.1),
  new THREE.Vector2(-0.05, 0.1),
]

const bevel = new CurveBevel(profile, { tubularSegments: 64, profileScale: 1.0 })
const geo   = bevel.apply(curve)
```

### CurveLine — wireframe / debug

```typescript
import { CurveLine } from '@st-curve-core'

const line = new CurveLine({ points: 128 })
const geo  = line.apply(curve)
const mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x4488ff }))
```

---

## Path-Follow

Place and animate any `Object3D` along a curve.
Pairs naturally with `st-keyframe` to animate the `offset` parameter.

```typescript
import { PathFollow } from '@st-curve-core'
import { AnimationMixer, AnimationClip, KeyframeTrack, linear } from '@st-keyframe'

const curve  = new CatmullRomCurve(points)
const follow = new PathFollow(curve, { frameCount: 256 })

// Animate with st-keyframe
const mixer = new AnimationMixer()
mixer.play(new AnimationClip('path', [
  new KeyframeTrack(follow.parameters, 'offset', [
    { time: 0, value: 0, easing: linear },
    { time: 5, value: 1 },
  ]),
]), { wrapMode: 'loop' })

// In render loop:
mixer.update(clock.getDelta())
follow.apply(myObject)   // sets myObject.position + quaternion from RMF frame
```

### Manual path-follow

```typescript
// Without keyframe animation — set offset directly
follow.parameters.offset = 0.5
follow.apply(myObject)  // places object at 50% along curve

// Or get raw data
const pos  = follow.getPosition(0.5)
const quat = follow.getQuaternion(0.5)
const mat  = follow.getMatrix(0.5)
```

### Roll angle

```typescript
follow.parameters.roll = Math.PI / 4  // 45° roll around the tangent axis
follow.apply(myObject)
```

---

## Rotation-Minimizing Frames

`computeRMFrames` returns stable orientation frames along the curve, avoiding the twisting that Frenet frames produce at inflection points.

```typescript
import { computeRMFrames, frameToMatrix, frameToQuaternion } from '@st-curve-core'

const frames = computeRMFrames(curve, 64)  // 64 evenly-spaced frames
const frame  = frames[32]                  // midpoint frame

console.log(frame.position)   // Vector3 on the curve
console.log(frame.tangent)    // unit forward direction
console.log(frame.normal)     // unit sideways direction
console.log(frame.binormal)   // unit up direction

const matrix = frameToMatrix(frame)          // Matrix4 for instanced rendering
const quat   = frameToQuaternion(frame)      // Quaternion for Object3D
```

### Instanced objects along a curve

```typescript
const frames = computeRMFrames(curve, 50)
const mesh   = new THREE.InstancedMesh(geo, mat, frames.length)

frames.forEach((frame, i) => {
  const m = frameToMatrix(frame)
  mesh.setMatrixAt(i, m)
})
mesh.instanceMatrix.needsUpdate = true
```

---

## Ecosystem Integration

```
st-curve-core → st-keyframe (PathFollow.parameters.offset animation)
st-curve-core → st-modifier-core (curve-deformed geometry, future)
st-curve-core → st-particle-core (CurveGuideForce already uses sampled points)
```

```typescript
// Particle guide from curve
import { CatmullRomCurve } from '@st-curve-core'
import { CurveGuideForce } from '@st-particle-core'

const path  = new CatmullRomCurve(waypoints)
const guide = new CurveGuideForce({ points: path.getSpacedPoints(64) })
system.addForce(guide)
```

---

## Example File

Open [`examples/example-curve-core.html`](../examples/example-curve-core.html) in a browser.
Switch between Catmull-Rom, Bezier, and NURBS curves.
Switch cross-section profiles: Circle, Square, Diamond, Star.
A cone object path-follows continuously along the curve.
