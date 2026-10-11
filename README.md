# Triforge — Blender-Style Node Workflows for Three.js

[![npm](https://img.shields.io/npm/v/@triforge/shader-core?label=npm&color=cb3837)](https://www.npmjs.com/package/@triforge/shader-core)
[![npm downloads](https://img.shields.io/npm/dm/@triforge/shader-core?label=downloads&color=cb3837)](https://www.npmjs.com/package/@triforge/shader-core)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-r186-049ef4)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)

**Triforge** is a modular, TypeScript-first ecosystem that brings **Blender's node-based workflow** —
Geometry Nodes, the Modifier Stack, the Shader Editor, Particles, Physics, and the Compositor —
directly into **Three.js / WebGL**. Build procedural geometry, PBR shader graphs, particle systems,
cloth/rigid-body physics, skeletal animation, hair/fur, fluids, metaballs, volumetrics, post-processing,
and a raster-to-path-tracer toggle, all with Blender-matched node and parameter names so Blender
artists and Three.js developers speak the same language.

**Every package below is published on npm** under the `@triforge/` scope — click any badge or package
name to view it on npm. All packages install with plain `npm install`; no monorepo/workspace setup,
no build step, and no hidden dependencies between packages — **Three.js is the only hard dependency**.

Each package does exactly one job and communicates with the others only through native Three.js
primitives (`BufferGeometry`, `Material`, `Texture`) — pick the one package you need for a single
effect, or combine several for a full procedural pipeline. No cross-package coupling, no vendor
lock-in, no framework required (works with vanilla Three.js, React Three Fiber, or any other
Three.js-based renderer).

**Keywords:** three.js, threejs, webgl, 3d graphics, procedural geometry, node-based shader editor,
GLSL shader generator, particle system, cloth simulation, rigid body physics, skeletal animation,
hair and fur rendering, fluid simulation, metaballs, volumetric rendering, post-processing effects,
path tracing, Blender geometry nodes, Blender modifier stack, TypeScript 3D library.

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
| [`@triforge/render-budget-core`](https://www.npmjs.com/package/@triforge/render-budget-core) | [![npm](https://img.shields.io/npm/v/@triforge/render-budget-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/render-budget-core) | Engine-agnostic device/network profiling → adaptive render-quality budget |
| [`@triforge/context-pool-core`](https://www.npmjs.com/package/@triforge/context-pool-core) | [![npm](https://img.shields.io/npm/v/@triforge/context-pool-core?label=&color=cb3837)](https://www.npmjs.com/package/@triforge/context-pool-core) | Scissor/viewport multiplexer — share one WebGL context across many canvases |

---

## Install

Each package is independent. Install only what you need:

```bash
npm install three @triforge/shader-core
npm install three @triforge/geometry-nodes
# etc.
```

---

## Who this is for

- **Three.js / React Three Fiber developers** who want Blender-grade procedural tools —
  geometry nodes, modifiers, a real particle system, cloth and rigid-body physics — without
  hand-rolling vertex math or wiring raw `ShaderMaterial` uniforms.
- **Blender artists moving into WebGL** who want the same node names, parameter names, and
  mental model they already know, instead of relearning everything from a Three.js-specific API.
- **Game and interactive-experience studios** building browser-based 3D (configurators, data
  visualizations, WebGL games, generative art, digital twins) who need production-ready
  building blocks for shading, particles, hair, fluids, and post-processing without a full
  game-engine dependency.
- **TypeScript teams** who want strict types, zero `any`, and a public `parameters` object on
  every node/modifier for direct GSAP or keyframe-driven animation.

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
