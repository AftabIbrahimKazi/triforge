# radius-parametric-geometry Tutorial

Define any 3D shape using two math functions — no raw vertex arrays required.
Updated automatically whenever new features are added.

---

## Core Concept

Any shape that is rotationally parametric (swept around an axis) can be described with:
- A **radius function** — how far from the center at each point
- A **height function** — how high at each point

Both functions receive `u` and `v` in the range `[0, 1]`:
- `u` goes around the shape (0 = start, 1 = full revolution)
- `v` goes from bottom to top (0 = bottom, 1 = top)

```javascript
new RadiusParametricGeometry(
  (u, v) => radius,   // required
  (u, v) => height,   // optional — defaults to () => 0
  options             // optional
)
```

The result extends `THREE.BufferGeometry` — use it anywhere Three.js accepts a geometry.

---

## Installation / Import

```javascript
import { RadiusParametricGeometry } from './dist/index.js'
```

---

## Options

```javascript
{
  radiusSegments: 32,         // segments around the axis  (default: 32)
  heightSegments: 16,         // segments along the height (default: 16)
  thetaStart:     0,          // start angle in radians    (default: 0)
  thetaLength:    Math.PI * 2 // angle sweep in radians    (default: full circle)
}
```

**Segment count guidelines:**

| Use Case | radiusSegments | heightSegments |
|---|---|---|
| Simple / low-poly | 16–32 | 8–16 |
| Standard | 32–64 | 16–32 |
| High detail / displacement ready | 64–128 | 32–64 |
| Never exceed | 128 | 64 |

---

## Common Shapes

### Sphere
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => Math.sin(v * Math.PI),
  (u, v) => Math.cos(v * Math.PI)
)
```

### Cylinder
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0,
  (u, v) => v * 2.0 - 1.0
)
```

### Cone
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0 - v,
  (u, v) => v
)
```

### Torus
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.4 * Math.cos(v * Math.PI * 2),
  (u, v) => 0.4 * Math.sin(v * Math.PI * 2)
)
```

### Capsule
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => {
    if (v < 0.25) return Math.sin(v * Math.PI * 2)
    if (v > 0.75) return Math.sin((v - 0.5) * Math.PI * 2)
    return 1.0
  },
  (u, v) => v * 3.0 - 1.5
)
```

### Egg / Ovoid
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => Math.sin(v * Math.PI) * (1.0 + 0.3 * Math.cos(v * Math.PI)),
  (u, v) => Math.cos(v * Math.PI) * 1.2
)
```

### Vase
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => 0.3 + 0.7 * Math.sin(v * Math.PI) + 0.2 * Math.sin(v * Math.PI * 3),
  (u, v) => v * 2.0 - 1.0
)
```

### Star / Twisted Shape
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.3 * Math.cos(u * Math.PI * 2 * 5),  // 5-pointed star cross-section
  (u, v) => v * 2.0 - 1.0,
  { radiusSegments: 64, heightSegments: 16 }
)
```

### Spiral / Twisted Cylinder
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.2 * Math.cos(u * Math.PI * 2 * 4 + v * Math.PI * 6),
  (u, v) => v * 3.0 - 1.5,
  { radiusSegments: 64, heightSegments: 64 }
)
```

### Procedural Wavy Surface
```javascript
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.3 * Math.sin(u * Math.PI * 6) * Math.cos(v * Math.PI * 4),
  (u, v) => v * 2.0 - 1.0,
  { radiusSegments: 64, heightSegments: 32 }
)
```

---

## Half / Partial Shapes

Use `thetaLength` to sweep only part of the circle:

```javascript
// Half cylinder (open cross-section)
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0,
  (u, v) => v * 2.0 - 1.0,
  { thetaLength: Math.PI }
)

// Quarter torus
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.4 * Math.cos(v * Math.PI * 2),
  (u, v) => 0.4 * Math.sin(v * Math.PI * 2),
  { thetaStart: 0, thetaLength: Math.PI * 0.5 }
)
```

---

## Getting Geometry Stats

```javascript
const stats = geo.getStats()
console.log(stats)
// {
//   vertexCount:   number   — total vertices
//   triangleCount: number   — total triangles
//   normalCount:   number   — total normals
//   uvCount:       number   — total UV coordinates
//   totalMemory:   number   — approximate bytes used
// }
```

---

## Using With Three.js

```javascript
import * as THREE from 'three'
import { RadiusParametricGeometry } from './dist/index.js'

const geo      = new RadiusParametricGeometry(
  (u, v) => Math.sin(v * Math.PI),
  (u, v) => Math.cos(v * Math.PI)
)
const material = new THREE.MeshStandardMaterial({ color: 0x88aaff })
const mesh     = new THREE.Mesh(geo, material)
scene.add(mesh)
```

---

## Using With st-shader-core

```javascript
import { RadiusParametricGeometry } from './dist/index.js'
import { NoiseTexture, ColorRamp, PrincipledBSDF, MaterialOutput } from '../st-shader-core/dist/index.js'

const geo   = new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.2 * Math.sin(u * Math.PI * 4),
  (u, v) => Math.cos(v * Math.PI)
)
const noise = new NoiseTexture({ scale: 4.0 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#112200', '#44aa00'] })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.7 })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

scene.add(new THREE.Mesh(geo, mat.material))
```

---

## Performance Notes

- Normals are computed automatically via numerical differentiation — do not recompute manually
- `computeBoundingBox()` and `computeBoundingSphere()` are called automatically on construction
- Geometry is static — for animated surfaces, use a displacement shader node or create a new instance
- Compatible with all Three.js materials, shadow maps, and physics engines
- Works directly as input to `st-modifier-core` (coming soon) for subdivision and displacement
