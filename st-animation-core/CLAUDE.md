# st-animation-core — Claude Code Guide

Shape keys (morph targets), armature/bones (FK + IK), and NLA layered animation.
Mirrors Blender's animation system: same concepts, same naming.
Root CLAUDE.md rules always take precedence.

---

## Package Structure

```
src/
  shapekey/
    ShapeKey.ts          — ShapeKey interface + shapeKeyFromGeometry/Deltas helpers
    ShapeKeyMesh.ts      — THREE.Mesh subclass with named shape keys + update()
  armature/
    PoseBone.ts          — single bone pose: parameters (location/rotation/scale), localMatrix, worldMatrix
    Armature.ts          — bone hierarchy: rest pose, FK update, 2-bone IK, getBoneMatrices()
    SkinBinding.ts       — CPU skinning: SkinWeight[], SkinBinding.apply(), computeEnvelopeWeights()
  nla/
    NLAStrip.ts          — interface: clip, start, end, influence, repeat, extrapolation
    NLATrack.ts          — ordered strip list, mute, evaluate(t)
    NLAEditor.ts         — multi-track playback: update(delta), evaluate(t), time, timeScale
  index.ts
test/
  run-tests.js           — 45 tests, imports from dist/
bench/
  run-bench.js
  results-YYYY-MM-DD.md
dist/
```

---

## Key Invariants

### ShapeKeyMesh.update() must be called every frame
Blending is lazy — writing to `parameters` does NOT update the geometry automatically.
Call `mesh.update()` after modifying influences. This writes blended positions to the GPU buffer.

### parameters = one key per shape key name
The "Basis" name is reserved — adding a Basis key replaces the rest pose positions.
All other key names appear as numeric properties in `parameters`. Range [0, 1].

### Armature.update() must be called before SkinBinding.apply()
`update()` computes worldMatrix for every PoseBone.
`SkinBinding.apply()` reads those matrices to transform geometry.
Order: modify parameters → armature.update() → skinBinding.apply().

### PoseBone.parameters channels
All 9 channels (locationX/Y/Z, rotationX/Y/Z in radians XYZ Euler, scaleX/Y/Z) are plain numbers.
Drive any of them with st-keyframe: `new KeyframeTrack(bone.parameters, 'rotationX', [...])`

### NLAStrip clip interface
NLAStrip.clip only requires `{ duration: number; evaluate(t: number): void }`.
This is duck-typed — pass any AnimationClip from st-keyframe, or a custom object.

### Topological sort
Armature constructor runs topological sort so parents are always updated before children.
It handles arbitrary bone trees, not just chains.

---

## Blender Mapping

| st-animation-core | Blender |
|---|---|
| `ShapeKey` | Shape Key (Data Properties > Shape Keys) |
| `ShapeKeyMesh.parameters[name]` | Shape Key > Value slider |
| `shapeKeyFromDeltas()` | Shape Key created from delta (relative to Basis) |
| `PoseBone` | Pose Mode bone |
| `PoseBone.parameters.rotationX` | Pose bone R.x channel |
| `Armature` | Armature object |
| `Armature.solveIK2Bone()` | IK constraint (chain length = 2) |
| `SkinBinding` | Armature modifier (CPU deform) |
| `computeEnvelopeWeights()` | Vertex Groups from Bone Heat Weighting (simplified) |
| `NLAStrip` | NLA Strip |
| `NLATrack` | NLA Track |
| `NLAEditor` | NLA Editor playback |
| `NLAStrip.influence` | NLA Strip > Influence |
| `NLAStrip.extrapolation` | NLA Strip > Extrapolation |

---

## Adding a New Shape Key

```typescript
import { shapeKeyFromGeometry, shapeKeyFromDeltas } from '@st-animation-core'

// From an existing geometry (copies its current positions)
const key = shapeKeyFromGeometry('smile', smilingGeometry)

// From deltas relative to the basis
const deltas = new Float32Array(vertexCount * 3)
// ... fill deltas ...
const key2 = shapeKeyFromDeltas('blink', baseGeometry, deltas)

mesh.addShapeKey(key)
mesh.addShapeKey(key2)
```

---

## Testing

```bash
cd st-animation-core
npm run build
npm test     # 45 tests
```

---

## Performance Notes

- ShapeKey blend: O(V × K). At 136 µs for 1k verts × 3 keys, budget allows ~10k vert characters.
- Armature FK: O(N bones). 8.8 µs for 20 bones — real-time safe.
- CPU skinning: O(V × W) where W = weights per vertex. Use THREE.SkinnedMesh for > 2k verts.
- NLA evaluation: O(tracks × strips). 0.7 µs for 4 tracks — negligible.
