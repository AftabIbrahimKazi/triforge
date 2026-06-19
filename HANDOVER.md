# Ecosystem Handover

**Status as of 2026-05-29: Stage 1 COMPLETE.**

All packages are built, tested, and documented. No pending phases remain.
The next session begins Stage 2 — the Blender-like GUI web app.

---

## Package Status

| Package | Tests | Status |
|---|---|---|
| `radius-parametric-geometry` | — | Complete |
| `st-shader-core` | 55 | Complete — 75 nodes, LightPath, RayPortal, Attribute, AO |
| `st-modifier-core` | 43+38 | Complete — Bevel, Wireframe, Shrinkwrap added |
| `st-particle-core` | 218 | Complete — all 7 phases, geometryProvider callback |
| `st-uv-core` | 57 | Complete — true vertex-splitting seam cuts in LSCM + ABF |
| `st-compositor-core` | 82 | Complete — 28 passes |
| `st-volume-core` | — | Complete — VolumeBox ray march + PointDensity |
| `st-geometry-nodes` | 44 | Complete — Switch, Index, AlignRotationToVector added |
| `st-keyframe` | 49 | Complete — QuaternionTrack (SLERP) added |
| `st-curve-core` | 66 | Complete — handle modes (aligned/vector/free), bevelFactor added |
| `st-animation-core` | 63 | Complete — TrackTo, CopyRotation, CopyLocation constraints added |
| `st-physics-core` | 63 | Complete — BallSocket, ConeTwist constraints added |
| `st-hair-core` | 51 | Complete — HairDynamics (Verlet + collision) added |
| `st-fluid-core` | — | Complete — FLIP + PCG pressure, SPH, MarchingCubes |
| `st-pathtracer-core` | — | Complete — LightPathController, multi-pass rendering |
| `st-metaball-core` | — | Complete |
| `st-core-types` | 8 | Complete — 16 shared interfaces |

---

## What Was Built in This Session (2026-05-29)

### New features across packages
- `st-geometry-nodes` — `Switch`, `Index`, `AlignRotationToVector`
- `st-keyframe` — `QuaternionTrack` with proper SLERP
- `st-curve-core` — `buildAlignedHandles`, `buildVectorHandles`, `buildFreeHandles`, `bevelFactor` on CurveTube/CurveBevel
- `st-uv-core` — Fixed `applySeamCuts` to do true vertex splitting (was metadata-only before)
- `st-shader-core` — `Attribute` node, `AmbientOcclusion` node, `LightPath` (real uniforms via `LightPathController`), `RayPortal`
- `st-modifier-core` — `BevelModifier` (position-welded), `WireframeModifier`, `ShrinkwrapModifier`
- `st-physics-core` — `BallSocketConstraint`, `ConeTwistConstraint`
- `st-animation-core` — `TrackToConstraint`, `CopyRotationConstraint`, `CopyLocationConstraint`
- `st-hair-core` — `HairDynamics` (Verlet strand simulation, collision sphere)
- `st-pathtracer-core` — `LightPathController` (multi-pass: camera/shadow/diffuse/glossy/reflection/transmission), integrated into `RenderManager.lightPath`
- `st-particle-core` — `setGeometryProvider(() => BufferGeometry)` callback, `geometryProvider` option
- `st-core-types` — New package: 16 shared TypeScript interfaces

### Bug fixes
- `BevelModifier` — edge detection was index-based, missed non-welded meshes (BoxGeometry etc.). Fixed to use position-based weld map.
- `st-uv-core` `applySeamCuts` — was only trimming adjacency, not actually splitting vertices. Rewrote to duplicate vertices along seam edges.

---

## Stage 2 — Blender-like GUI Web App

The runtime library is complete. Stage 2 is a separate project: a browser-based scene editor matching Blender's UX.

### Planned features
- Viewport (orbit, pan, zoom, selection, gizmos)
- Outliner (scene tree)
- Properties panel (modifier stack, particle settings, material nodes)
- Shader node editor (visual graph wiring to `st-shader-core`)
- Geometry node editor (visual graph wiring to `st-geometry-nodes`)
- Timeline / NLA editor (wiring to `st-keyframe` + `st-animation-core`)
- Export: Three.js source code generation
- Export: glTF, OBJ, FBX
- Import: `.blend` file
- Round-trip: export Three.js project → Blender, import Blender project → Three.js

### Architecture notes
- Each editor panel is a standalone component; they communicate through a shared scene state store
- The runtime packages are imported as-is — no modifications needed
- `st-core-types` interfaces are the typed contracts between editor and runtime
- `LightPathController` should be exposed in the shader node editor with EEVEE-vs-Cycles toggle (grayed out in EEVEE mode, active in path-tracer mode)

---

## Where to Find Things

| What | Where |
|---|---|
| All example files | `examples/[package]/example-*.html` |
| Package source | `[package]/src/` |
| Package tests | `[package]/test/run-tests.js` |
| Shared interfaces | `st-core-types/src/` |
| Root docs | `CLAUDE.md`, `TUTORIAL.md`, `BACKLOG.md` |
