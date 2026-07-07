# Triforge

[![npm](https://img.shields.io/npm/v/@triforge/shader-core?label=npm&color=cb3837)](https://www.npmjs.com/package/@triforge/shader-core)
[![npm downloads](https://img.shields.io/npm/dm/@triforge/shader-core?label=downloads&color=cb3837)](https://www.npmjs.com/package/@triforge/shader-core)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Blender-style node workflows for Three.js — a modular ecosystem of packages covering shaders, geometry, particles, physics, animation, and more.

**Every package below is published on npm** under the `@triforge/` scope — click any badge or package name to view it. All packages install with plain `npm install`; no monorepo/workspace setup required.

Each package does one job and communicates with others through Three.js primitives only (`BufferGeometry`, `Material`, `Texture`). Drop in what you need; ignore the rest.

---

## Packages

| Package | npm | Description |
|---|---|---|
| [`@triforge/shader-core`](https://www.npmjs.com/package/@triforge/shader-core) | [![npm](https://img.shields.io/npm/v/@triforge/shader-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/shader-core) | 75 Blender-matched surface shader nodes (PrincipledBSDF, Noise, Voronoi, …) |
| [`@triforge/geometry-nodes`](https://www.npmjs.com/package/@triforge/geometry-nodes) | [![npm](https://img.shields.io/npm/v/@triforge/geometry-nodes?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/geometry-nodes) | Procedural geometry node graph (Grid, UVSphere, Subdivision, Instances, …) |
| [`@triforge/modifier-core`](https://www.npmjs.com/package/@triforge/modifier-core) | [![npm](https://img.shields.io/npm/v/@triforge/modifier-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/modifier-core) | Non-destructive modifier stack (Subdivision, Array, Bevel, Boolean, …) |
| [`@triforge/curve-core`](https://www.npmjs.com/package/@triforge/curve-core) | [![npm](https://img.shields.io/npm/v/@triforge/curve-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/curve-core) | Bezier / NURBS / Catmull-Rom curves, bevel, path-follow |
| [`@triforge/radius-parametric-geometry`](https://www.npmjs.com/package/@triforge/radius-parametric-geometry) | [![npm](https://img.shields.io/npm/v/@triforge/radius-parametric-geometry?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/radius-parametric-geometry) | Parametric shape generators |
| [`@triforge/uv-core`](https://www.npmjs.com/package/@triforge/uv-core) | [![npm](https://img.shields.io/npm/v/@triforge/uv-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/uv-core) | UV unwrapping — 6 algorithms + island packing + seam cuts |
| [`@triforge/particle-core`](https://www.npmjs.com/package/@triforge/particle-core) | [![npm](https://img.shields.io/npm/v/@triforge/particle-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/particle-core) | Blender-matched particle system — 7 phases, emitters, forces, renderers |
| [`@triforge/physics-core`](https://www.npmjs.com/package/@triforge/physics-core) | [![npm](https://img.shields.io/npm/v/@triforge/physics-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/physics-core) | Cloth, soft body, rigid body + constraints and colliders |
| [`@triforge/animation-core`](https://www.npmjs.com/package/@triforge/animation-core) | [![npm](https://img.shields.io/npm/v/@triforge/animation-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/animation-core) | Shape keys, skeletal FK/IK, CPU skinning, NLA editor |
| [`@triforge/keyframe`](https://www.npmjs.com/package/@triforge/keyframe) | [![npm](https://img.shields.io/npm/v/@triforge/keyframe?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/keyframe) | Keyframe tracks, animation clips, mixer, 30 easings |
| [`@triforge/compositor-core`](https://www.npmjs.com/package/@triforge/compositor-core) | [![npm](https://img.shields.io/npm/v/@triforge/compositor-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/compositor-core) | 28 post-processing passes (Bloom, DOF, SSAO, SSR, LUT, …) |
| [`@triforge/pathtracer-core`](https://www.npmjs.com/package/@triforge/pathtracer-core) | [![npm](https://img.shields.io/npm/v/@triforge/pathtracer-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/pathtracer-core) | Raster ↔ path-tracer toggle + LightPath multi-pass |
| [`@triforge/hair-core`](https://www.npmjs.com/package/@triforge/hair-core) | [![npm](https://img.shields.io/npm/v/@triforge/hair-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/hair-core) | Hair, fur, grass strand rendering + Verlet dynamics |
| [`@triforge/fluid-core`](https://www.npmjs.com/package/@triforge/fluid-core) | [![npm](https://img.shields.io/npm/v/@triforge/fluid-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/fluid-core) | FLIP fluid + SPH simulation + Marching Cubes mesh |
| [`@triforge/metaball-core`](https://www.npmjs.com/package/@triforge/metaball-core) | [![npm](https://img.shields.io/npm/v/@triforge/metaball-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/metaball-core) | Organic iso-surfaces with live update |
| [`@triforge/volume-core`](https://www.npmjs.com/package/@triforge/volume-core) | [![npm](https://img.shields.io/npm/v/@triforge/volume-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/volume-core) | Ray-marched volumetric media (fog, smoke, fire) |
| [`@triforge/core-types`](https://www.npmjs.com/package/@triforge/core-types) | [![npm](https://img.shields.io/npm/v/@triforge/core-types?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/core-types) | Shared TypeScript interfaces — no runtime code |

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
