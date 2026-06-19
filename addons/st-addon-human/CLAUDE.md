# @st-addon-human — Claude Code Guide

## Status
Paid addon. Built on top of core ST packages. Do not publish to npm public registry.

## Purpose
Parametric human generator. One class (`HumanGenerator`) produces a complete rigged human
mesh with skin shader, driven entirely by a plain `parameters` object.

## Package rules (inherit root CLAUDE.md, plus these)

### May import from core packages
Unlike core packages, this addon IS allowed to import from:
- `@st-shader-core`   — for skin SSS, eye BSDF
- `@st-modifier-core` — for SubdivisionModifier on body mesh
- `@st-animation-core`— for Armature / SkinBinding (when rig is added)
- `@st-core-types`    — shared interfaces

### Must NOT import from
- Other addons (`@st-addon-*`)
- Any package not listed above

### Public API contract
`HumanGenerator` must always expose:
- `parameters` — plain object, all scalars, GSAP-animatable
- `group`      — THREE.Group, add to scene
- `update(partial?)` — live rebuild
- `toJSON() / fromJSON()` — settings round-trip
- `skeleton`   — joint positions for external rigging

### Geometry approach
Body built from LatheGeometry profiles per segment (torso, head, limbs).
All segments merged into two BufferGeometries: `body` (skin) + `eyes` (iris).
Normals always recomputed after merge.

## Folder layout
```
src/
  core/         HumanParameters.ts   — interface + defaults
  geometry/     BodyGeometry.ts      — parametric mesh builder
  material/     SkinMaterial.ts      — st-shader-core skin/eye nodes
  HumanGenerator.ts                  — main public class
  index.ts                           — barrel export
examples/
  example-human-generator.html
test/
bench/
```

## Future work (BACKLOG)
- [ ] SubdivisionModifier pass for smooth body mesh
- [ ] Armature auto-generated from skeleton positions
- [ ] SkinBinding so the mesh deforms with pose
- [ ] Cloth layer (shirt/trousers) as separate geometry + PrincipledBSDF
- [ ] Hair via @st-hair-core HairSystem on scalp
- [ ] Facial expression shape keys via @st-animation-core ShapeKeyMesh
- [ ] Ethnic skin tone presets
- [ ] Randomise button (weighted random params for believable humans)
