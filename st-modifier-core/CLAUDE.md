# @st-modifier-core — Claude Code Guide

## Purpose
Blender-matched non-destructive geometry modifier stack for Three.js.
Modifiers run sequentially on CPU, transforming BufferGeometry before it reaches the renderer.
Mirrors Blender's modifier stack: same modifier names, same parameter names, same execution order.

## Critical Rules
NEVER mutate the input BufferGeometry — always return a new one.
NEVER import from st-shader-core or any other ecosystem package — accept data via callbacks only.
ALWAYS expose all numeric inputs in a public `parameters` object for GSAP/keyframe compatibility.
ALWAYS run SubdivisionModifier before DisplacementModifier for smooth results.
ALWAYS run NormalRecalculateModifier after any deform modifier that changes vertex positions.

---

## Core Pattern

```typescript
import { ModifierStack, SubdivisionModifier, DisplacementModifier, NormalRecalculateModifier } from '@st-modifier-core'

const stack = new ModifierStack(baseGeometry)
stack.add(new SubdivisionModifier({ levels: 2 }))
stack.add(new DisplacementModifier({ strength: 0.4, noiseFunction: (x, y, z) => myNoise(x, y, z) }))
stack.add(new NormalRecalculateModifier())

const finalGeo = stack.apply()
mesh.geometry  = finalGeo
```

stack.apply() runs every enabled modifier in order. Call it again whenever parameters change.
The source geometry passed to ModifierStack is never mutated or disposed.

---

## Interoperability Rule — CRITICAL

Modifiers that need external data MUST accept it as a callback, never as a concrete class import.

```typescript
// CORRECT — any noise source works
new DisplacementModifier({ noiseFunction: (x, y, z) => simplexNoise(x, y, z) })
new DisplacementModifier({ noiseFunction: (x, y, z) => Math.sin(x * 4) * 0.5 + 0.5 })

// WRONG — hard dependency on st-shader-core
new DisplacementModifier({ noise: new NoiseTexture() })  // never do this
```

---

## Parameters Object Rule

Every modifier MUST expose a `parameters: Record<string, number>` object.
All numeric inputs live in `parameters` — never as private fields.
This makes modifiers GSAP-compatible and future-keyframe-ready.

```typescript
// GSAP drives modifier parameters directly
gsap.to(dispMod.parameters, { strength: 0.8, duration: 2 })
// Then call stack.apply() to rebuild geometry (geometry changes are not live like shader uniforms)
```

Note: unlike st-shader-core uniforms, modifier parameters require a stack.apply() call to take effect
because they operate on CPU geometry, not GPU uniforms.

---

## Modifier Execution Order

Always follow this order in the stack:
1. **Generate** (Subdivision, Array, Mirror, Solidify, Extrude) — add geometry density/copies
2. **Deform** (Displacement, Warp, Twist, Bend) — move vertices
3. **Transform** (UVProjection, NormalRecalculate) — fix UVs and normals after deformation

```typescript
stack.add(new SubdivisionModifier({ levels: 2 }))   // 1. generate density
stack.add(new DisplacementModifier({ ... }))          // 2. deform
stack.add(new NormalRecalculateModifier())            // 3. fix normals
```

---

## Modifier Reference

### Generate
| Modifier | Key Parameters | What It Does |
|---|---|---|
| `SubdivisionModifier` | `levels` (0–4) | Splits every triangle into 4 per level |
| `ArrayModifier` | `count`, `offsetX/Y/Z` | Duplicates geometry N times along an offset |
| `ExtrudeModifier` | `amount` | Extrudes each face along its normal |
| `SolidifyModifier` | `thickness`, `offset` | Adds shell thickness via normal extrusion |
| `MirrorModifier` | `x`, `y`, `z` (0 or 1) | Mirrors across one or more axes |

### Deform
| Modifier | Key Parameters | What It Does |
|---|---|---|
| `DisplacementModifier` | `strength`, `midlevel`, `noiseFunction` | Pushes verts along normals via callback |
| `WarpModifier` | `fromX/Y/Z`, `toX/Y/Z`, `radius`, `strength` | Pulls verts from one point toward another |
| `TwistModifier` | `angle`, `axis` | Rotates verts around axis proportional to position |
| `BendModifier` | `angle`, `axis` | Bends geometry along a circular arc |

### Transform
| Modifier | Key Parameters | What It Does |
|---|---|---|
| `UVProjectionModifier` | `type` (box/sphere/triplanar), `scaleX/Y/Z` | Generates procedural UVs from vertex positions |
| `NormalRecalculateModifier` | — | Recomputes smooth vertex normals |

---

## Adding a New Modifier

1. Create the file in the correct category folder: `src/modifiers/[generate|deform|transform]/`
2. Extend `BaseModifier`
3. Name the modifier to match Blender exactly
4. All numeric inputs in `parameters` object
5. Return a NEW BufferGeometry — never mutate input
6. Export from `src/index.ts`
7. Add tests in `test/run-tests.js`
8. Update `TUTORIAL.md` in this package and the root `TUTORIAL.md`
9. Update root `BACKLOG.md`

---

## What NOT to Do

```typescript
// WRONG — mutating input geometry
apply(geometry: BufferGeometry): BufferGeometry {
  const pos = geometry.getAttribute('position')
  pos.setXYZ(0, 1, 2, 3)  // mutates input — NEVER do this
  return geometry
}

// WRONG — importing from st-shader-core
import { NoiseTexture } from '@st-shader-core'  // breaks decoupling — NEVER

// WRONG — private parameters
class MyModifier extends BaseModifier {
  private strength = 0.5  // unreachable by GSAP — NEVER
  parameters = {}
}

// CORRECT
class MyModifier extends BaseModifier {
  parameters = { strength: 0.5 }
  apply(geometry) {
    const result = geometry.clone()
    // ... modify result only ...
    return result
  }
}
```

---

## Performance Notes
- stack.apply() runs on CPU — avoid calling inside render loop for heavy stacks
- SubdivisionModifier level 3+ on meshes >1k verts is slow — use levels 1–2 for realtime
- DisplacementModifier is O(n) in vertex count — fast on reasonable meshes
- Cache the result of stack.apply() and only rebuild when parameters actually change
- NormalRecalculateModifier clones the geometry — always the last step, not mid-stack
