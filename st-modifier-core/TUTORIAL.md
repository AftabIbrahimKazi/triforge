# st-modifier-core Tutorial

Blender-matched non-destructive geometry modifier stack for Three.js.
Apply Subdivision, Displacement, Mirror, Twist and more to any BufferGeometry.
Updated automatically whenever new modifiers are added.

---

## Core Concept

A `ModifierStack` holds a source geometry and a list of modifiers.
Call `apply()` to run all modifiers in sequence and get the final geometry.
The source geometry is never mutated.

```
source geometry → [SubdivisionModifier] → [DisplacementModifier] → [NormalRecalculate] → final geometry
```

---

## Minimal Example

```javascript
import { ModifierStack, SubdivisionModifier, DisplacementModifier, NormalRecalculateModifier } from './dist/index.js'

const baseGeo = new THREE.SphereGeometry(1, 16, 8)

const stack = new ModifierStack(baseGeo)
stack.add(new SubdivisionModifier({ levels: 2 }))
stack.add(new DisplacementModifier({
  strength: 0.4,
  noiseFunction: (x, y, z) => (Math.sin(x * 3 + y * 2) * 0.5 + 0.5)
}))
stack.add(new NormalRecalculateModifier())

const mesh = new THREE.Mesh(stack.apply(), material)
scene.add(mesh)
```

---

## ModifierStack API

```javascript
const stack = new ModifierStack(geometry)

stack.add(modifier)       // add to end of stack — returns stack (chainable)
stack.remove(modifier)    // remove by reference
stack.modifiers           // read-only array of current modifiers
stack.setSource(newGeo)   // replace source geometry
stack.apply()             // run stack, return final BufferGeometry
stack.bake()              // alias for apply() — terminology from Blender
```

### Chaining

```javascript
const stack = new ModifierStack(geo)
  .add(new SubdivisionModifier({ levels: 2 }))
  .add(new DisplacementModifier({ strength: 0.3, noiseFunction: myNoise }))
  .add(new NormalRecalculateModifier())
```

### Toggling modifiers

```javascript
const sub = new SubdivisionModifier({ levels: 2 })
sub.enabled = false   // skipped on next apply()
sub.enabled = true    // re-enabled
```

---

## Execution Order

Always follow this order:
1. **Generate** — add geometry density or copies
2. **Deform** — move vertices
3. **Transform** — fix UVs and normals

```javascript
stack.add(new SubdivisionModifier({ levels: 2 }))   // 1. generate
stack.add(new DisplacementModifier({ ... }))          // 2. deform
stack.add(new NormalRecalculateModifier())            // 3. fix normals
```

---

## Modifiers

### SubdivisionModifier
Uses Loop subdivision — the correct algorithm for triangle meshes, matching Blender's
Subdivision Surface modifier. Both splits triangles AND repositions vertices using
weighted neighbor averages, producing smooth organic surfaces. NOT midpoint/linear splitting.

```javascript
new SubdivisionModifier({ levels: 2 })
// levels: 0–4. Each level multiplies triangle count by 4 and smooths further.
// level 1: 4x tris | level 2: 16x | level 3: 64x
```

### ArrayModifier
Duplicates geometry N times along an offset vector.

```javascript
new ArrayModifier({ count: 5, offsetX: 2.0, offsetY: 0, offsetZ: 0 })
// count:   number of copies including the original
// offsetX/Y/Z: distance between each copy
```

### ExtrudeModifier
Extrudes every face along its normal by a set amount.

```javascript
new ExtrudeModifier({ amount: 0.2 })
```

### SolidifyModifier
Adds thickness to a surface by extruding along vertex normals.

```javascript
new SolidifyModifier({ thickness: 0.1, offset: -1 })
// offset: -1 = inward, 0 = centered, 1 = outward
```

### MirrorModifier
Mirrors geometry across one or more axes, matching Blender exactly.
Each active axis is applied sequentially. Vertices within `mergeThreshold` of the
mirror plane are welded — prevents seams at the mirror boundary.

```javascript
new MirrorModifier({ x: true })                           // mirror across X axis
new MirrorModifier({ x: true, y: true })                  // mirror across X then Y
new MirrorModifier({ x: true, mergeThreshold: 0.001 })    // custom weld distance
```

### DisplacementModifier
Pushes each vertex along its normal by a value from a noise function.
The `noiseFunction` is completely decoupled — pass any noise source.

```javascript
// Simple math
new DisplacementModifier({
  strength: 0.5,
  midlevel: 0.5,
  noiseFunction: (x, y, z) => Math.sin(x * 3 + y * 2) * 0.5 + 0.5
})

// External library (e.g. simplex-noise)
import { createNoise3D } from 'simplex-noise'
const noise3D = createNoise3D()
new DisplacementModifier({
  strength: 0.4,
  noiseFunction: (x, y, z) => noise3D(x, y, z) * 0.5 + 0.5
})
```

Parameters:
- `strength` — displacement magnitude
- `midlevel` — 0.5 = centered (values below midlevel push inward, above push outward)
- `noiseFunction` — `(x, y, z) => number` in range [0, 1]

### WarpModifier
Pulls vertices near a source point toward a target point.

```javascript
new WarpModifier({
  fromX: 0, fromY: 0, fromZ: 0,  // source point
  toX:   2, toY:   0, toZ:   0,  // target point
  radius:   1.5,                  // influence radius
  strength: 0.8,                  // warp intensity [0, 1]
})
```

### TwistModifier
Rotates vertices around an axis, with rotation amount proportional to position along the axis.

```javascript
new TwistModifier({ angle: Math.PI * 2, axis: 'y' })
// angle: total twist in radians (Math.PI*2 = full revolution)
// axis: 'x' | 'y' | 'z'
```

### BendModifier
Bends geometry along a circular arc.

```javascript
new BendModifier({ angle: Math.PI * 0.5, axis: 'y' })
// angle: Math.PI*2 wraps the geometry into a full ring
// axis: 'x' | 'y' | 'z'
```

### UVProjectionModifier
Generates procedural UV coordinates from vertex positions.
Use this on procedurally generated geometry that has no meaningful UVs.

```javascript
new UVProjectionModifier({ type: 'box',       scaleX: 1, scaleY: 1 })
new UVProjectionModifier({ type: 'sphere',    scaleX: 1, scaleY: 1 })
new UVProjectionModifier({ type: 'triplanar', scaleX: 1, scaleY: 1, scaleZ: 1 })
// type: 'box' | 'sphere' | 'triplanar'
// triplanar: no seams, blends between axes — best for organic shapes
```

### NormalRecalculateModifier
Recomputes smooth vertex normals. Always run after deform modifiers.

```javascript
new NormalRecalculateModifier()
// No parameters — purely structural
```

---

## GSAP Integration

Modifier `parameters` are plain objects — GSAP can drive them directly.
Since modifiers run on CPU, call `stack.apply()` after the animation tick to rebuild geometry.

```javascript
const dispMod = new DisplacementModifier({ strength: 0.1, noiseFunction: myNoise })
const stack   = new ModifierStack(baseGeo).add(subdivMod).add(dispMod).add(normMod)

// Animate displacement strength
gsap.to(dispMod.parameters, {
  strength: 0.8,
  duration: 2,
  ease: 'power2.inOut',
  onUpdate: () => { mesh.geometry = stack.apply() }
})
```

---

## Full Pipeline with st-shader-core

```javascript
import { ModifierStack, SubdivisionModifier, DisplacementModifier, NormalRecalculateModifier } from './st-modifier-core/dist/index.js'
import { NoiseTexture, ColorRamp, PrincipledBSDF, MaterialOutput, Bump, RGBtoBW } from './st-shader-core/dist/index.js'

// 1. Base geometry
const baseGeo = new THREE.SphereGeometry(1, 16, 8)

// 2. Modifier stack — CPU geometry processing
const stack = new ModifierStack(baseGeo)
  .add(new SubdivisionModifier({ levels: 2 }))
  .add(new DisplacementModifier({
    strength: 0.3,
    noiseFunction: (x, y, z) => (Math.sin(x*3)*Math.cos(y*2)*Math.sin(z*4)) * 0.5 + 0.5
  }))
  .add(new NormalRecalculateModifier())

// 3. Material — GPU shading
const noise = new NoiseTexture({ scale: 4.0, detail: 5.0 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#1a0a00', '#6b3000', '#cc6600'] })
const bump  = new Bump({ height: new RGBtoBW({ color: noise.output('Color') }).output('Val'), strength: 1.5 })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.8, normal: bump.output('Normal') })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// 4. Combine — they meet only at THREE.Mesh
const mesh = new THREE.Mesh(stack.apply(), mat.material)
scene.add(mesh)
```

---

## Performance Tips

- Keep `levels` at 1–2 for realtime use — level 3+ is slow on large meshes
- Cache the result of `stack.apply()` — only rebuild when parameters change
- For animated displacement, pre-subdivide once and only rebuild with deform modifiers
- `NormalRecalculateModifier` clones the geometry — always put it last
- Dispose old geometry after rebuilding: `oldGeo.dispose()`
