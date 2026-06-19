# @st-uv-core — Tutorial

CPU-side UV unwrapping algorithms for Three.js BufferGeometry.
Mirrors Blender's UV unwrap operations: same names, same parameters, non-destructive.

---

## Quick Start

```js
import { CubeProjection } from '@st-uv-core'
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'

const geo  = new BoxGeometry(1, 1, 1)
const unwrap = new CubeProjection({ scale: 1.0 })

const unwrapped = unwrap.apply(geo)  // returns new BufferGeometry with 'uv' attribute

const mesh = new Mesh(unwrapped, new MeshStandardMaterial({ map: myTexture }))
```

Every unwrapper:
- Takes any `BufferGeometry` in
- Returns a new `BufferGeometry` with the `'uv'` attribute set
- Never modifies the input geometry

---

## Unwrapper Reference

| Class | Blender equivalent | Best for |
|---|---|---|
| `CubeProjection` | Cube Projection | Hard-surface, box-like shapes |
| `CylinderProjection` | Cylinder Projection | Cylindrical shapes |
| `SphereProjection` | Sphere Projection | Spherical/organic shapes |
| `SmartUVProject` | Smart UV Project | Mixed-orientation hard-surface |
| `ConformalLSCM` | Unwrap (Conformal) | Organic shapes, minimal angle distortion |
| `AngleBasedABF` | Unwrap (Angle Based) | Same as LSCM, handles obtuse triangles better |

## Operations

| Class | Blender equivalent | What it does |
|---|---|---|
| `PackIslands` | Pack Islands | Re-packs UV islands into [0,1]² |
| `AverageIslandScale` | Average Island Scale | Normalises texel density across islands |
| `MarkSeams` | Mark Seam | Stores seam edges in geometry.userData |

---

## Projection Unwrappers

### CubeProjection

Projects each vertex onto one of 6 cube faces based on its normal direction.

```js
import { CubeProjection } from '@st-uv-core'

const unwrap = new CubeProjection({ scale: 1.0 })
const geo    = unwrap.apply(myGeometry)

// Change scale and re-apply
unwrap.parameters.scale = 2.0
const geo2 = unwrap.apply(myGeometry)
```

| Parameter | Default | Description |
|---|---|---|
| `scale` | `1.0` | UV tile scale |

---

### CylinderProjection

Wraps UV around the Y-axis. U = longitude, V = normalised height.

```js
import { CylinderProjection } from '@st-uv-core'

const unwrap = new CylinderProjection({ scaleU: 1.0, scaleV: 1.0 })
const geo    = unwrap.apply(myCylinder)
```

| Parameter | Default | Description |
|---|---|---|
| `scaleU` | `1.0` | UV tile scale along circumference |
| `scaleV` | `1.0` | UV tile scale along height |

---

### SphereProjection

Latitude/longitude spherical mapping. U = longitude, V = latitude.

```js
import { SphereProjection } from '@st-uv-core'

const unwrap = new SphereProjection({ scale: 1.0 })
const geo    = unwrap.apply(mySphere)
```

---

## Smart UV Project

Clusters faces by normal similarity, projects each cluster, and packs them.
Good for hard-surface models with many different face orientations.

```js
import { SmartUVProject } from '@st-uv-core'

const unwrap = new SmartUVProject({
  angleLimit:   66,    // degrees — faces within this angle share an island
  islandMargin: 0.02,  // gap between islands in UV space
})
const geo = unwrap.apply(myMesh)
```

| Parameter | Default | Blender equivalent |
|---|---|---|
| `angleLimit` | `66` | Smart UV Project → Angle Limit |
| `islandMargin` | `0.02` | Smart UV Project → Island Margin |

---

## Conformal LSCM

Least Squares Conformal Maps parameterization.
Minimises angle distortion — UV angles match 3D angles as closely as possible.
Requires the mesh to be indexed (`geometry.index` must exist).

```js
import { ConformalLSCM } from '@st-uv-core'

const unwrap = new ConformalLSCM({ maxIterations: 400 })
const geo    = unwrap.apply(myMesh)
```

| Parameter | Default | Description |
|---|---|---|
| `maxIterations` | `400` | Maximum conjugate gradient iterations |
| `tolerance` | `1e-6` | Convergence tolerance |

**Notes:**
- Works on open meshes (with boundary) and closed meshes
- For closed meshes, the two farthest vertices are automatically pinned as boundary
- Result is remapped to [0,1]² automatically
- For very large meshes (>100k verts) consider increasing `maxIterations`

---

## Angle-Based ABF

Mean-value coordinate parameterization — better than LSCM for meshes with many obtuse triangles.
Mean-value weights are always positive (cotangent weights can go negative on obtuse triangles).

```js
import { AngleBasedABF } from '@st-uv-core'

const unwrap = new AngleBasedABF({ maxIterations: 400 })
const geo    = unwrap.apply(myMesh)
```

Same parameters as `ConformalLSCM`. Use this when LSCM produces distorted results on your mesh.

---

## Operations

### PackIslands

Re-packs UV islands proportional to their 3D surface area. Minimises wasted UV space.

```js
import { CubeProjection, PackIslands } from '@st-uv-core'

// Apply an unwrapper first, then pack
const unwrapped = new CubeProjection().apply(geo)
const packed    = new PackIslands({ margin: 0.02 }).apply(unwrapped)
```

| Parameter | Default | Blender equivalent |
|---|---|---|
| `margin` | `0.02` | Pack Islands → Margin |

---

### AverageIslandScale

Scales UV islands so all have the same texel density (consistent texels-per-unit).

```js
import { SmartUVProject, AverageIslandScale } from '@st-uv-core'

const unwrapped = new SmartUVProject().apply(geo)
const scaled    = new AverageIslandScale().apply(unwrapped)
```

---

### MarkSeams

Stores seam edges in `geometry.userData.seams`. Used to inform future unwrapping operations.

```js
import { MarkSeams } from '@st-uv-core'

const ms = new MarkSeams()

// Mark edges
const marked = ms.apply(geo, [
  { a: 0, b: 1 },
  { a: 1, b: 2 },
])

// Read seams
const seams = MarkSeams.getSeams(marked)  // [{ a: 0, b: 1 }, ...]

// Clear seams
const cleared = ms.clear(marked)
```

---

## Seam Cutting

`ConformalLSCM` and `AngleBasedABF` both read seams from `geometry.userData.seams`
(written by `MarkSeams`) and apply them automatically before solving.

### How seam cutting works

A seam is a chain of edges that tells the unwrapper "cut the surface here so it can
unfold flat". Without a seam, a closed mesh (sphere, torus) has no boundary for the
solver to anchor itself to — the result is arbitrary. With a seam, the mesh is split
at those edges and each side of the seam gets independent UV coordinates.

Internally, `applySeamCuts` duplicates the vertices on each seam edge so the two
adjacent triangles become topologically independent. The solver then treats the seam
as an open boundary, assigning different UV values to each side. The output geometry
is de-indexed at the seam (non-indexed output) so each face-vertex has its own UV
slot.

### Basic example

```js
import { MarkSeams, ConformalLSCM } from '@st-uv-core'
import { SphereGeometry } from 'three'

const sphere = new SphereGeometry(1, 32, 16)

// Mark a vertical seam along the left edge (longitude = 0)
// Vertex layout for SphereGeometry(_, W, H): row r col c → r*(W+1)+c
const W = 32, H = 16
const seamEdges = []
for (let r = 0; r < H; r++) {
  seamEdges.push({ a: r * (W + 1), b: (r + 1) * (W + 1) })
}

const seamed   = new MarkSeams().apply(sphere, seamEdges)
const unwrapped = new ConformalLSCM().apply(seamed)
// unwrapped is non-indexed — each face-vertex has its own UV
mesh.geometry = unwrapped
```

### With AngleBasedABF (same API)

```js
import { MarkSeams, AngleBasedABF } from '@st-uv-core'

const seamed    = new MarkSeams().apply(myMesh, mySeamEdges)
const unwrapped = new AngleBasedABF().apply(seamed)
```

### Rules for seams

- Seam edge indices `a` and `b` refer to vertex indices in the geometry's position attribute (after vertex welding for non-indexed geometry).
- Seam edges should form a connected path from one boundary vertex to another, or a full loop around the mesh. Isolated seam edges still work but may not produce the expected chart boundaries.
- `SmartUVProject` ignores seams — it already de-indexes by face, so every face is an independent island.
- Projection unwrappers (`CubeProjection`, `CylinderProjection`, `SphereProjection`) also ignore seams, as they assign UVs analytically.

---

## Chaining Operations

```js
import { SmartUVProject, AverageIslandScale, PackIslands } from '@st-uv-core'

const geo = new SmartUVProject({ angleLimit: 66 })
              .apply(myGeometry)

const geo2 = new AverageIslandScale().apply(geo)
const geo3 = new PackIslands({ margin: 0.02 }).apply(geo2)

mesh.geometry = geo3
```

---

## Animating with GSAP

All `parameters` are plain numbers — safe to animate directly.
Re-call `apply()` after changing parameters (UV unwrapping is CPU-side, not live).

```js
import gsap from 'gsap'
import { CubeProjection } from '@st-uv-core'

const unwrap = new CubeProjection({ scale: 1.0 })

gsap.to(unwrap.parameters, {
  scale: 4.0,
  duration: 2,
  onUpdate: () => {
    mesh.geometry.dispose()
    mesh.geometry = unwrap.apply(baseGeo)
  },
})
```

---

## Connecting with the Ecosystem

`st-uv-core` fits between modifiers and shading:

```
st-modifier-core.apply()   →   st-uv-core unwrapper.apply()   →   st-shader-core material
   (deform geometry)              (generate UV attribute)           (use UV in shader)
```

Example with modifier stack:

```js
import { ModifierStack, SubdivisionModifier } from '@st-modifier-core'
import { SmartUVProject } from '@st-uv-core'

const stack    = new ModifierStack(baseGeo)
stack.add(new SubdivisionModifier({ levels: 2 }))
const subdivided  = stack.apply()

const unwrapped   = new SmartUVProject().apply(subdivided)
mesh.geometry     = unwrapped
```

---

## Choosing the Right Unwrapper

| Geometry type | Recommended |
|---|---|
| Box, building, hard-surface | `CubeProjection` or `SmartUVProject` |
| Tube, pillar, bottle | `CylinderProjection` |
| Ball, planet, head | `SphereProjection` |
| Complex hard-surface | `SmartUVProject` |
| Organic, character | `ConformalLSCM` or `AngleBasedABF` |

**LSCM vs ABF:**
- Both give similar results on well-behaved meshes
- ABF handles obtuse triangles better (never produces negative weights)
- LSCM is slightly faster
