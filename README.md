# Triforge — Blender-Style Node Workflows for Three.js

[![npm](https://img.shields.io/npm/v/@triforge/shader-core?label=npm&color=cb3837)](https://www.npmjs.com/package/@triforge/shader-core)
[![npm downloads](https://img.shields.io/npm/dm/@triforge/shader-core?label=downloads&color=cb3837)](https://www.npmjs.com/package/@triforge/shader-core)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-r186-049ef4)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![packages](https://img.shields.io/badge/packages-19-success)](#packages)

**Triforge** is a modular, TypeScript-first ecosystem that brings **Blender's node-based
workflow** — Geometry Nodes, the Modifier Stack, the Shader Editor, the Particle System,
Physics, the NLA animation editor, and the Compositor — directly into **Three.js / WebGL**.
19 independent npm packages cover procedural geometry, PBR shader graphs, particle
systems, cloth/rigid-body physics, skeletal animation, hair/fur, fluids, metaballs,
volumetrics, post-processing, UV unwrapping, and a raster-to-path-tracer toggle — all with
Blender-matched node and parameter names, so Blender artists and Three.js/WebGL
developers speak the same language.

## Table of Contents

- [What is Triforge?](#what-is-triforge)
- [Quick Start](#quick-start)
- [Packages](#packages)
- [How it works](#how-it-works)
- [Code examples](#code-examples)
- [Performance](#performance)
- [Browser & framework compatibility](#browser--framework-compatibility)
- [Who this is for](#who-this-is-for)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Branch flow](#branch-flow)
- [Contributing](#contributing)
- [License](#license)

---

## What is Triforge?

Three.js gives you a renderer, a scene graph, and raw primitives — everything above that
(procedural geometry, a node-based shader editor, a real particle system, cloth/rigid-body
physics, skeletal animation with IK, hair and fluid simulation, a post-processing
compositor) you'd otherwise hand-roll yourself, project after project.

Blender already solved all of this with a consistent, well-designed node model. Triforge
ports that model — same node names, same parameter names, same mental model — into
TypeScript packages that output nothing but native Three.js primitives
(`BufferGeometry`, `Material`, `Texture`). No new scene graph, no new renderer, no new
coordinate system to learn.

**Every package below is published on npm** under the `@triforge/` scope — click any badge
or package name to view it. All packages install with plain `npm install`; there is no
monorepo/workspace setup to adopt, no required build step, and no hidden dependency
between packages — **Three.js is the only hard dependency**, and each package can be
installed completely on its own.

**Keywords:** three.js, threejs, webgl, 3d graphics, procedural geometry, node-based shader
editor, GLSL shader generator, particle system, cloth simulation, rigid body physics,
skeletal animation, hair and fur rendering, fluid simulation, metaballs, volumetric
rendering, post-processing effects, path tracing, Blender geometry nodes, Blender modifier
stack, Blender shader editor, Blender particle system, TypeScript 3D library, npm 3D
package, React Three Fiber tools.

---

## Quick Start

A parametric shape driven by a procedural, node-based PBR material — the most common
Triforge pattern: build geometry with one package, shade it with another, combine at the
Three.js mesh level.

```bash
npm install three @triforge/radius-parametric-geometry @triforge/shader-core
```

```js
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RadiusParametricGeometry } from '@triforge/radius-parametric-geometry'
import { NoiseTexture, ColorRamp, PrincipledBSDF, MaterialOutput } from '@triforge/shader-core'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
document.body.appendChild(renderer.domElement)

const scene  = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100)
camera.position.set(0, 1, 3)
const controls = new OrbitControls(camera, renderer.domElement)

scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const sun = new THREE.DirectionalLight(0xffffff, 1)
sun.position.set(5, 5, 5)
scene.add(sun)

// 1. Procedural geometry — a wavy sphere from custom radius/height functions
const geo = new RadiusParametricGeometry(
  (u) => 1.0 + 0.2 * Math.sin(u * Math.PI * 4),
  (u, v) => Math.cos(v * Math.PI),
  { radiusSegments: 64, heightSegments: 32 },
)

// 2. Node-based shader — noise-driven color ramp through a Principled BSDF
const noise = new NoiseTexture({ scale: 3.0, detail: 4.0 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#1a0a00', '#cc4400', '#ffaa00'] })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.6 })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// 3. Combine at the Three.js mesh level — this is the only place the two packages meet
scene.add(new THREE.Mesh(geo, mat.material))

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera) })
```

More runnable examples — one per feature, no build step, open directly in a browser — live
in [`examples/`](examples/) (100+ files).

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

```bash
# Install only what you need — every package stands alone
npm install three @triforge/shader-core
npm install three @triforge/physics-core
# etc.
```

---

## How it works

```
   Blender-style node graph / modifier stack / particle system
   (lives entirely inside one @triforge/* package)
                       │
                       │  .apply() / .compile() / .build()
                       ▼
       THREE.BufferGeometry · THREE.Material · THREE.Texture
                       │
                       │  new THREE.Mesh(geometry, material)
                       ▼
                  Your Three.js scene
```

- **One job per package.** `shader-core` only builds materials. `modifier-core` only
  transforms geometry. `physics-core` only simulates. They never import each other —
  the only shared code is `@triforge/core-types`, and that's types-only, zero runtime.
- **Parameters everywhere.** Every node and modifier exposes a public `parameters` plain
  object, so any value is directly animatable with GSAP, `@triforge/keyframe`, or your own
  tween library — no internal API to learn for animation.
- **Non-destructive by default.** Modifiers and node graphs never mutate the geometry you
  pass in; they always return a new `BufferGeometry`, matching Blender's own modifier
  stack semantics.
- **Blender naming throughout.** Node names, parameter names, and socket names match
  Blender's own terminology wherever an equivalent exists — `PrincipledBSDF`, `NoiseTexture`,
  `ColorRamp`, `SubdivisionModifier`, `BooleanModifier`, `ArrayModifier` all mean exactly
  what they mean in Blender.
- **Callback-based interop, never hard imports.** A modifier that needs noise or color data
  takes a callback (`(x, y, z) => value`), never a concrete class from another package —
  swap in any noise source (CPU math, a texture sample, `@triforge/shader-core`'s own
  compiled noise) without coupling the two packages together.

---

## Code examples

**Non-destructive modifier stack** (`@triforge/modifier-core`):

```js
import { ModifierStack, SubdivisionModifier, DisplacementModifier } from '@triforge/modifier-core'

const stack = new ModifierStack(baseGeometry)
stack.add(new SubdivisionModifier({ levels: 2 }))
stack.add(new DisplacementModifier({ strength: 0.3, noiseFunction: myNoise }))
mesh.geometry = stack.apply() // baseGeometry is never mutated
```

**Particle system** (`@triforge/particle-core`):

```js
import { ParticleSystem, PointEmitter, GravityForce, BillboardRenderer } from '@triforge/particle-core'

const billboard = new BillboardRenderer({ maxCount: 2000, map: sprite, additive: true })
const system = new ParticleSystem({ count: 2000, lifetime: 2.2, physics: 'newtonian' })
system
  .addEmitter(new PointEmitter({ normalVelocity: 6 }))
  .addForce(new GravityForce(9.81))
  .setRenderer(billboard)

scene.add(billboard.object3D)
// in the render loop: system.update(deltaSeconds)
```

**Cloth physics** (`@triforge/physics-core`):

```js
import { ClothSimulator, PlaneCollider } from '@triforge/physics-core'

const cloth = new ClothSimulator(20, 20, { damping: 0.02, gravity: -9.8 })
cloth.setFromGeometry(flagGeometry)
cloth.pinRow(0) // pin the top edge
cloth.addCollider(new PlaneCollider({ normal: [0, 1, 0], point: [0, 0, 0] }))

// in the render loop:
cloth.step(deltaSeconds)
cloth.apply(flagGeometry)
```

More — every package, every node — in [TUTORIAL.md](TUTORIAL.md).

---

## Performance

Real numbers from each package's own `bench/` suite (Node.js, V8, averaged over thousands
of runs after warmup) — not marketing estimates:

| Package | Scenario | Result |
|---|---|---|
| `particle-core` | 10,000 particles, `BillboardRenderer.update()` | 0.09 ms/frame |
| `particle-core` | 10,000 particles, `InstanceRenderer.update()` | 0.71 ms/frame |
| `physics-core` | 20×20 cloth (441 verts), gravity + wind + 2 colliders | 1.86–2.05 ms/frame |
| `physics-core` | 40×40 cloth (1,681 verts), gravity only | 6.51 ms/frame |
| `geometry-nodes` | 100×100 Grid (10,201 verts) `evaluate()` | 2.40 ms/call |
| `geometry-nodes` | IcoSphere L0 → Subdivision L3 (1,280 tris) | 0.47 ms/call |

All of the above run well within the 16 ms frame budget for 60 fps at the tested scale —
see each package's own `bench/` folder for the full suite and methodology. `shader-core`'s
own performance standard: `compile()` completes in under 5 ms for graphs up to 20 nodes,
and compiled GLSL matches or beats a handwritten `THREE.ShaderMaterial` equivalent.

---

## Browser & framework compatibility

- **Any Three.js r128+ project** (packages pin a wide floor; a handful opt into newer
  three.js APIs and document their own minimum in that package's `package.json`).
- **Vanilla Three.js, React Three Fiber, or any other Three.js-based renderer** — Triforge
  never touches the scene graph or render loop itself; it only produces
  `BufferGeometry`/`Material`/`Texture`, which every Three.js-based framework consumes the
  same way.
- **No build step required** — every example in [`examples/`](examples/) runs directly in
  a browser via an ES module import map, no bundler needed. Bundlers (Vite, Webpack,
  esbuild) work too, since every package ships plain ESM + `.d.ts` types.
- **WebGL2** is assumed where a package uses features newer three.js versions require
  (e.g. `three-gpu-pathtracer` for `@triforge/pathtracer-core`'s optional path-tracer mode).

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

## Project structure

```
triforge/
├── st-shader-core/          75 shader nodes → compiled THREE.Material
├── st-geometry-nodes/       procedural geometry node graph
├── st-modifier-core/        non-destructive modifier stack
├── st-curve-core/           Bezier/NURBS/Catmull-Rom curves
├── st-uv-core/              UV unwrapping algorithms
├── st-particle-core/        particle system (emitters, forces, renderers)
├── st-physics-core/         cloth, soft body, rigid body
├── st-animation-core/       shape keys, armature, NLA
├── st-keyframe/             keyframe tracks + animation mixer
├── st-compositor-core/      28 post-processing passes
├── st-pathtracer-core/      raster ↔ path-tracer toggle
├── st-hair-core/            hair/fur/grass strands
├── st-fluid-core/           FLIP + SPH fluid simulation
├── st-metaball-core/        organic iso-surfaces
├── st-volume-core/          ray-marched volumetrics
├── st-core-types/           shared TypeScript interfaces (types only)
├── radius-parametric-geometry/   parametric shape generator
├── render-budget-core/      device/network profiling → render budget
├── context-pool-core/       shared-context canvas multiplexer
├── examples/                100+ runnable, no-build-step HTML demos
├── TUTORIAL.md               full worked examples, every package
└── THREE_JS_ECOSYSTEM.md     architecture / dependency diagram
```

Each top-level directory is a fully independent npm package — its own `package.json`,
`src/`, `test/`, and (where applicable) `bench/`.

---

## Documentation

- [TUTORIAL.md](TUTORIAL.md) — worked examples for every package, from a minimal "shape +
  material" quick start through full pipelines combining several packages.
- [THREE_JS_ECOSYSTEM.md](THREE_JS_ECOSYSTEM.md) — architecture overview, the package map,
  and the dependency build order.
- [`examples/`](examples/) — 100+ self-contained HTML files, one per feature, each runnable
  directly in a browser with no build step.
- Each package also ships its own `README`/`TUTORIAL.md` (where present) with
  package-specific detail beyond what fits here.

---

## Roadmap

Triforge's Stage 1 (all 19 packages above) is complete and published. Active and
near-term work:

- A Stage 2 Blender-like GUI application — visual scene editor, node editors, `.blend`
  import, round-trip Blender ↔ Three.js export.
- A terrain/vegetation addon suite (terrain streaming, tree placement/scattering, rock
  scattering) building on top of `geometry-nodes` and `particle-core`.
- Continued tracking of upstream three.js releases — see each package's `CHANGELOG.md`
  (where present) for what changed between three.js versions.

Addon packages built on top of this core ecosystem (cell fracture, weather, terrain, trees)
exist but are not yet part of the public npm scope — see the package table above for what's
currently published.

---

## FAQ

**Does this replace Three.js?**
No — Triforge is built entirely on top of Three.js and only ever hands you back native
Three.js objects (`BufferGeometry`, `Material`, `Texture`). You still own the renderer,
camera, and render loop.

**Do I have to install all 19 packages?**
No. Every package is fully independent with `three` as its only required dependency —
install exactly the one(s) you need.

**Does this work with React Three Fiber?**
Yes — since every package only produces native Three.js primitives, you can pass the
resulting geometry/material straight into an R3F `<mesh>` the same way you would any other
Three.js object.

**Is this a 1:1 Blender clone?**
No — it's a Blender-*inspired* node model adapted to what makes sense at interactive
framerates in a browser. Node names and parameters match Blender where a direct equivalent
exists; some Blender features (full Cycles-grade path tracing, Grease Pencil) are out of
scope or handled differently (see [`@triforge/pathtracer-core`](https://www.npmjs.com/package/@triforge/pathtracer-core)
for the path-tracing story).

**Why TypeScript and not plain JS?**
Strict types catch a large class of "wrong socket type" / "wrong parameter name" bugs at
author time instead of at runtime inside a render loop — especially valuable for a
node-graph library where sockets and parameters are the whole API surface.

---

## Branch flow

```
dev → test → beta → main
```

`main` is the stable release branch. All changes go through `dev` first — see
[CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

---

## Contributing

Bug reports, feature requests, and pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and package conventions, and the issue
templates for what to include. This project follows the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

Found a security issue? Please report it privately — see [SECURITY.md](SECURITY.md)
instead of opening a public issue.

---

## License

MIT © 2026 Aftab Ibrahim Kazi
