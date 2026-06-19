# Triforge

Blender-style node workflows for Three.js — a modular ecosystem of packages covering shaders, geometry, particles, physics, animation, and more.

Each package does one job and communicates with others through Three.js primitives only (`BufferGeometry`, `Material`, `Texture`). Drop in what you need; ignore the rest.

---

## Packages

| Package | Description |
|---|---|
| `@triforge/shader-core` | 75 Blender-matched surface shader nodes (PrincipledBSDF, Noise, Voronoi, …) |
| `@triforge/geometry-nodes` | Procedural geometry node graph (Grid, UVSphere, Subdivision, Instances, …) |
| `@triforge/modifier-core` | Non-destructive modifier stack (Subdivision, Array, Bevel, Boolean, …) |
| `@triforge/curve-core` | Bezier / NURBS / Catmull-Rom curves, bevel, path-follow |
| `@triforge/radius-parametric-geometry` | Parametric shape generators |
| `@triforge/uv-core` | UV unwrapping — 6 algorithms + island packing + seam cuts |
| `@triforge/particle-core` | Blender-matched particle system — 7 phases, emitters, forces, renderers |
| `@triforge/physics-core` | Cloth, soft body, rigid body + constraints and colliders |
| `@triforge/animation-core` | Shape keys, skeletal FK/IK, CPU skinning, NLA editor |
| `@triforge/keyframe` | Keyframe tracks, animation clips, mixer, 30 easings |
| `@triforge/compositor-core` | 28 post-processing passes (Bloom, DOF, SSAO, SSR, LUT, …) |
| `@triforge/pathtracer-core` | Raster ↔ path-tracer toggle + LightPath multi-pass |
| `@triforge/hair-core` | Hair, fur, grass strand rendering + Verlet dynamics |
| `@triforge/fluid-core` | FLIP fluid + SPH simulation + Marching Cubes mesh |
| `@triforge/metaball-core` | Organic iso-surfaces with live update |
| `@triforge/volume-core` | Ray-marched volumetric media (fog, smoke, fire) |
| `@triforge/core-types` | Shared TypeScript interfaces — no runtime code |

---

## Install

Each package is independent. Install only what you need:

```bash
npm install three @triforge/shader-core
npm install three @triforge/geometry-nodes
# etc.
```

---

## Design principles

- **One job per package.** Packages connect only at the Three.js mesh level.
- **No cross-package imports.** Packages never import from each other (except `@triforge/core-types`).
- **Parameters everywhere.** Every node and modifier exposes a public `parameters` object for GSAP / keyframe integration.
- **Non-destructive.** Modifiers and nodes never mutate their inputs.
- **Blender naming.** Node names, parameter names, and socket names match Blender exactly.

---

## Branch flow

```
dev → test → beta → main
```

`main` is the stable release branch. All changes go through `dev` first.

---

## License

MIT © 2026 Aftab Ibrahim Kazi
