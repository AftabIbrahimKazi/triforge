# st-hair-core Tutorial

Hair and fur strand rendering for Three.js. Matches Blender's Hair Particle System workflow.

---

## Quick Start

```javascript
import { HairSystem, StrandGenerator } from 'st-hair-core'
import { SphereGeometry, Mesh, MeshStandardMaterial } from 'three'

// 1. Generate strands on a mesh surface
const gen = new StrandGenerator({ count: 500, length: 0.4, segments: 6, gravity: 0.3 })
const strands = gen.generate(new SphereGeometry(1, 32, 16))

// 2. Build geometry
const hair = new HairSystem({ mode: 'ribbon', steps: 8 })
hair.setStrands(strands)
const geo = hair.build()

// 3. Attach to scene
const mesh = new Mesh(geo, new MeshStandardMaterial({ color: 0xd4a060, side: DoubleSide }))
scene.add(mesh)
```

---

## Strand Interface

A `Strand` is a list of control points. Everything else (spline interpolation, geometry) is derived from them.

```typescript
interface Strand {
  points: [number, number, number][]  // control points
  normal?: [number, number, number]   // surface normal at root (used by kink)
  width?: number                      // per-strand width override
}
```

---

## StrandGenerator

Distributes strands uniformly across a mesh surface using area-weighted sampling.

```javascript
const gen = new StrandGenerator({
  count:        500,    // number of strands
  length:       0.5,    // strand length
  segments:     6,      // control points per strand
  seed:         0,      // random seed (reproducible results)
  lengthRandom: 0.2,    // length variation [0,1]
  spread:       0.05,   // tip spread radius
  gravity:      0.3,    // gravity sag [0,1]
})

const strands = gen.generate(meshGeometry)
```

The mesh must have `position` and `normal` attributes. All parameters are in `gen.parameters` for GSAP animation.

---

## HairSystem

Orchestrates modifiers and geometry generation.

```javascript
const hair = new HairSystem({
  mode:          'tube',    // 'tube' | 'ribbon' | 'line'
  steps:         8,         // interpolation steps (display resolution)
  crossSections: 4,         // tube cross-section sides
  radiusRoot:    0.015,     // tube radius at root
  radiusTip:     0.003,     // tube radius at tip
  widthRoot:     0.025,     // ribbon width at root
  widthTip:      0.005,     // ribbon width at tip
  kinkType:      'WAVE',    // kink pattern
  kinkAmplitude: 0.04,
  kinkFrequency: 3,
})

hair.setStrands(strands)
hair.build()  // → BufferGeometry
```

All parameters live in `hair.parameters` — animate with GSAP:
```javascript
gsap.to(hair.parameters, { kinkAmplitude: 0.1, onUpdate: () => rebuildGeometry() })
```

---

## Render Modes

### Tube
Full 3D tube with circular cross-sections. Best quality, highest vertex count.
Use with `THREE.Mesh` + `MeshStandardMaterial`.

```javascript
const hair = new HairSystem({ mode: 'tube', crossSections: 5, radiusRoot: 0.012, radiusTip: 0.002 })
const mesh = new THREE.Mesh(hair.build(), mat)
```

### Ribbon
Flat quad strip facing a fixed up direction. Good for grass, feathers, leaves.
Use with `THREE.Mesh` + `MeshStandardMaterial({ side: THREE.DoubleSide })`.

```javascript
const hair = new HairSystem({ mode: 'ribbon', widthRoot: 0.03, widthTip: 0.006, ribbonUp: [0,1,0] })
```

### Line
Simple line segments. Fastest — good for very dense fur or debug view.
Use with `THREE.LineSegments` + `LineBasicMaterial`.

```javascript
const hair = new HairSystem({ mode: 'line', steps: 8 })
const lines = new THREE.LineSegments(hair.build(), new THREE.LineBasicMaterial({ color: 0xddaa55 }))
```

---

## Kink Modifier

Adds wave or curl patterns along strands. Applied automatically by `HairSystem.build()`.

```javascript
// Direct use
import { applyKink, applyKinkToStrands } from 'st-hair-core'

const kinked = applyKink(strand, {
  type:      'WAVE',   // 'WAVE' | 'CURL' | 'RADIAL' | 'BRAID' | 'NOTHING'
  amplitude: 0.05,     // displacement strength
  frequency: 3,        // oscillation frequency along strand
  shape:     0,        // 0 = grows root→tip, 1 = uniform
})

// Or via HairSystem parameters
hair.parameters.kinkType      = 'CURL'
hair.parameters.kinkAmplitude = 0.06
hair.parameters.kinkFrequency = 4
```

| Type   | Description |
|--------|-------------|
| WAVE   | Sinusoidal side-to-side wave |
| CURL   | Circular helix (XZ plane) |
| RADIAL | Circular wave in XY plane |
| BRAID  | Triple-frequency braid pattern |

---

## Clump Modifier

Pulls child strands toward parent/guide strands. Creates clumped fur bundles.

```javascript
import { applyClump } from 'st-hair-core'

// Set up guide strands (sparse, defines clump centers)
const guides = gen.generate(mesh).slice(0, 20)

// Apply clumping — children pull toward nearest guide
hair.setParents(guides)
hair.parameters.clumpFactor = 0.6   // pull strength [0,1]
hair.parameters.clumpShape  = 1.5   // envelope: how quickly clumping grows from root
```

---

## Spline Utilities

```javascript
import { sampleSpline, sampleTangent, computeRMFrames } from 'st-hair-core'

// Sample position along strand
const pos = sampleSpline(strand.points, 0.5)       // t=0..1

// Sample tangent direction
const tan = sampleTangent(strand.points, 0.5)      // unit vector

// Rotation-Minimizing Frames (for tube cross-sections, custom geometry)
const frames = computeRMFrames(strand.points, 16)  // 17 frames
// frames[i] = { pos, tangent, normal, binormal }
```

---

## Integration with Three.js

```javascript
// Tube or ribbon → Mesh
const geo  = hair.build()
const mat  = new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.7, side: THREE.DoubleSide })
const mesh = new THREE.Mesh(geo, mat)
scene.add(mesh)

// Line → LineSegments
const lineMat  = new THREE.LineBasicMaterial({ color: 0xddaa55 })
const lines    = new THREE.LineSegments(hair.build(), lineMat)
scene.add(lines)
```

---

## Custom Geometry Builders

Lower-level builders for custom use:

```javascript
import { buildTubeGeometry, buildTubeStrand, buildRibbonGeometry, buildLineGeometry } from 'st-hair-core'

// One strand at a time
const { verts, uvs, indices } = buildTubeStrand(strand, steps=8, crossSections=4, radiusRoot=0.01, radiusTip=0.002)

// All strands merged into one BufferGeometry
const geo = buildTubeGeometry(strands, steps, crossSections, radiusRoot, radiusTip)
const geo = buildRibbonGeometry(strands, steps, widthRoot, widthTip, up=[0,1,0])
const geo = buildLineGeometry(strands, steps)
```

---

## Example File

`example-hair-core.html` — interactive demo with live UI controls for all parameters.
Open directly in a browser (no build step required).
