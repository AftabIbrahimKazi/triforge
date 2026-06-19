# st-geometry-nodes Tutorial

Procedural geometry node graph for Three.js, mirroring Blender's Geometry Nodes editor.
Every node outputs a `THREE.BufferGeometry` (or a point cloud) via lazy `OutputRef` references.

---

## Quick Start

```typescript
import { IcoSphere, SubdivisionSurface } from '@st-geometry-nodes'

const ico = new IcoSphere({ radius: 2, subdivisions: 0 })
const sub = new SubdivisionSurface({ geometry: ico.output('Geometry'), level: 3 })

// Evaluate the graph — returns THREE.BufferGeometry
const geometry = sub.output('Geometry').evaluate()

scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()))
```

`evaluate()` walks the graph backward from the terminal node, memoizes shared nodes, and returns the resolved geometry. Nodes are not computed until `evaluate()` is called.

---

## Primitive Nodes

### Grid

```typescript
import { Grid } from '@st-geometry-nodes'

const grid = new Grid({
  sizeX:  2,   // total width  — Blender: Size X
  sizeY:  2,   // total height — Blender: Size Y
  vertsX: 10,  // columns      — Blender: Vertices X
  vertsY: 10,  // rows         — Blender: Vertices Y
})
const geo = grid.output('Geometry').evaluate()
```

### UVSphere

```typescript
const sphere = new UVSphere({ radius: 1, segments: 32, rings: 16 })
```

### IcoSphere

```typescript
const ico = new IcoSphere({ radius: 1, subdivisions: 2 })
// subdivisions 0–7 — each level quadruples triangle count
```

### Cylinder

```typescript
const cyl = new Cylinder({
  vertices:     32,
  radiusTop:    1,
  radiusBottom: 1,
  depth:        2,
  capFill:      'NGON',   // 'NOTHING' | 'NGON' | 'TRIFAN'
})
```

### Cone

```typescript
const cone = new Cone({ vertices: 32, radius: 1, depth: 2 })
```

### Cube

```typescript
const cube = new Cube({ size: 2 })
// or
const box = new Cube({ sizeX: 4, sizeY: 1, sizeZ: 2 })
```

### Circle

```typescript
const circle = new Circle({ vertices: 32, radius: 1, fillType: 'TRIFAN' })
// fillType: 'NOTHING' (edge ring) | 'NGON' | 'TRIFAN'
```

---

## Geometry Operation Nodes

### TransformGeometry

```typescript
import { TransformGeometry } from '@st-geometry-nodes'

const t = new TransformGeometry({
  geometry:    grid.output('Geometry'),
  translation: [0, 1, 0],      // [x, y, z]
  rotation:    [0, Math.PI/4, 0], // radians XYZ
  scale:       [1, 2, 1],
})
```

### JoinGeometry

```typescript
import { JoinGeometry } from '@st-geometry-nodes'

const a = new UVSphere({ radius: 0.5 })
const b = new TransformGeometry({ geometry: a.output('Geometry'), translation: [2, 0, 0] })

const joined = new JoinGeometry([
  a.output('Geometry'),
  b.output('Geometry'),
])
const geo = joined.output('Geometry').evaluate()
```

### SetPosition

Displace vertices by a constant or a per-vertex field.

```typescript
import { SetPosition } from '@st-geometry-nodes'

// Constant offset
const raised = new SetPosition({ geometry: grid.output('Geometry'), offset: [0, 1, 0] })

// Per-vertex field — sine wave terrain
const terrain = new SetPosition({
  geometry: new Grid({ sizeX: 10, sizeY: 10, vertsX: 50, vertsY: 50 }).output('Geometry'),
  offset: (vertexIndex, totalVertices) => {
    // NOTE: access raw positions from the grid directly if needed
    // offset receives (index, count) — use externally computed positions
    return [0, Math.sin(vertexIndex * 0.3) * 0.5, 0]
  },
})
```

### SubdivisionSurface

```typescript
import { SubdivisionSurface } from '@st-geometry-nodes'

const sub = new SubdivisionSurface({
  geometry: new IcoSphere({ subdivisions: 0 }).output('Geometry'),
  level: 3,   // 0–6; each level × 4 triangles
})
```

### MergeByDistance

Weld vertices within a threshold distance.

```typescript
import { MergeByDistance } from '@st-geometry-nodes'

const welded = new MergeByDistance({
  geometry: joined.output('Geometry'),
  distance: 0.001,
})
```

### FlipFaces

```typescript
import { FlipFaces } from '@st-geometry-nodes'

const flipped = new FlipFaces({ geometry: sphere.output('Geometry') })
// Inverts winding order and negates normals
```

---

## Instance Nodes

### DistributePointsOnFaces

Scatter random points uniformly across a mesh surface.

```typescript
import { DistributePointsOnFaces } from '@st-geometry-nodes'

const pts = new DistributePointsOnFaces({
  mesh:  sphere.output('Geometry'),
  count: 200,   // exact point count (when > 0)
  seed:  42,    // reproducible random seed
})
// Output socket: 'Points' — geometry with position + normal per point
```

### InstanceOnPoints

Place copies of a geometry at each point.

```typescript
import { InstanceOnPoints } from '@st-geometry-nodes'

const spike = new Cone({ vertices: 6, radius: 0.05, depth: 0.3 })

const spiky = new InstanceOnPoints({
  points:         pts.output('Points'),
  instance:       spike.output('Geometry'),
  alignToNormal:  true,   // orient instances to face normal
  scale:          [1, 1, 1],
})

// Per-instance scale field
const varied = new InstanceOnPoints({
  points:   pts.output('Points'),
  instance: cube.output('Geometry'),
  scale:    (i, n) => 0.5 + Math.sin(i / n * Math.PI * 6) * 0.3,  // FloatField
})
```

---

## Node Graph Evaluation

Nodes form a directed acyclic graph (DAG). `output(socket).evaluate()` resolves the graph:
- Nodes are evaluated in dependency order (topological)
- Shared nodes are computed once per `evaluate()` call (memoized)
- Each `evaluate()` call gets a fresh cache — no stale data

```typescript
const base = new Grid({ vertsX: 5, vertsY: 5 })

// base is shared between two transforms
const t1 = new TransformGeometry({ geometry: base.output('Geometry'), translation: [2, 0, 0] })
const t2 = new TransformGeometry({ geometry: base.output('Geometry'), translation: [-2, 0, 0] })
const j  = new JoinGeometry([t1.output('Geometry'), t2.output('Geometry')])

// base._evaluate() is called exactly once despite two consumers
const geo = j.output('Geometry').evaluate()
```

---

## All Parameters Are Animatable

Every node exposes a `parameters` plain object, compatible with GSAP and `st-keyframe`:

```typescript
const sphere = new UVSphere({ radius: 1, segments: 16, rings: 8 })

// Animate radius at runtime — re-evaluate graph each frame
sphere.parameters.radius = 1 + Math.sin(t)
const geo = sphere.output('Geometry').evaluate()
cloth.setFromGeometry(geo)  // or whatever consumes it
```

---

## Full Pipeline Example

```typescript
// Spiky sphere: icosphere → scatter points → cone instances aligned to normals

const ico   = new IcoSphere({ radius: 2, subdivisions: 2 })
const pts   = new DistributePointsOnFaces({ mesh: ico.output('Geometry'), count: 300, seed: 7 })
const spike = new Cone({ vertices: 5, radius: 0.05, depth: 0.4 })
const iop   = new InstanceOnPoints({
  points:        pts.output('Points'),
  instance:      spike.output('Geometry'),
  alignToNormal: true,
  scale:         (i, n) => 0.6 + 0.4 * Math.random(),
})

const sphereGeo = ico.output('Geometry').evaluate()
const spikeGeo  = iop.output('Geometry').evaluate()

scene.add(new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: 0x223355 })))
scene.add(new THREE.Mesh(spikeGeo,  new THREE.MeshStandardMaterial({ color: 0x88aaff })))
```

---

## Performance

| Operation | Time |
|---|---|
| Grid 100×100 | 2.4 ms |
| UVSphere 64×32 | 0.4 ms |
| IcoSphere level 4 | 6.0 ms |
| Subdivision level 3 | 0.5 ms |
| 100 instances on sphere | 1.0 ms |

Build-time geometry — call `evaluate()` once at startup or when parameters change, not every frame.
