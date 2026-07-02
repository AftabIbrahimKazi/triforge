# Triforge — Handover Document

Last updated: 2026-07-02

---

## Project Overview

Triforge is a modular Three.js ecosystem inspired by Blender's architecture.
17 core packages published to npm under `@triforge/` scope.
Paid addons live under `addons/` — gitignored, never pushed until ready.

**GitHub:** https://github.com/AftabIbrahimKazi/triforge
**npm org:** https://www.npmjs.com/org/triforge
**Local path:** `c:\wamp64\www\My Projects\3D\three-js`

---

## Repository State

**Branch flow:** `dev` → `test` → `beta` → `main`
**Default branch:** `main`
**Branch protection:** `main` has a ruleset — no direct pushes, no force pushes, no deletions. PR required.
**All 4 branches are in sync** as of last session (commit `29120ca`).

---

## Published Packages — Current Versions

| Package | Version |
|---|---|
| `@triforge/shader-core` | 0.1.1 |
| `@triforge/geometry-nodes` | 0.1.1 |
| `@triforge/modifier-core` | 0.1.1 |
| `@triforge/curve-core` | 0.1.1 |
| `@triforge/radius-parametric-geometry` | 0.1.1 |
| `@triforge/uv-core` | 0.1.1 |
| `@triforge/particle-core` | 0.1.1 |
| `@triforge/physics-core` | 0.1.1 |
| `@triforge/animation-core` | 0.1.1 |
| `@triforge/keyframe` | 0.1.1 |
| `@triforge/compositor-core` | 0.1.1 |
| `@triforge/pathtracer-core` | 0.1.1 |
| `@triforge/fluid-core` | 0.1.1 |
| `@triforge/metaball-core` | 0.1.1 |
| `@triforge/hair-core` | 0.1.0 |
| `@triforge/volume-core` | 0.1.0 |
| `@triforge/core-types` | 0.1.0 |

---

## What Was Done This Session

### 1. Repo and npm Setup
- GitHub repo `AftabIbrahimKazi/triforge` created with 4 branches
- npm org `@triforge/` created (free public tier)
- All 17 packages renamed from `@st-*` to `@triforge/*` scope
- `LICENSE` (MIT) and root `README.md` added
- All packages published to npm at `0.1.0`

### 2. Bug Fixes (from real-world Planetarium project usage)
Three issues found and fixed, packages bumped to `0.1.1`:

**`@triforge/compositor-core`** — was completely broken in all bundlers (Vite, Webpack, Rollup, esbuild)
- Root cause: dynamic template-literal imports — no bundler can statically resolve these
- Fix: replaced all dynamic imports with static imports from `three/examples/jsm/`
- pmndrs backend import guarded with `Function()` wrapper to prevent bundler errors

**13 packages missing `exports` field** — caused Vite to treat packages as legacy CJS, breaking Three.js deduplication
- Fix: added `exports` field to all 13 packages

**`@triforge/geometry-nodes` — `DistributePointsOnFaces`** — output socket named `"Points"` not documented
- Fix: added `DistributePointsOnFaces.SOCKETS.Points` static constant

### 3. TypeScript Config
- Fixed deprecated `"moduleResolution": "node"` to `"bundler"` in 3 tsconfig files
- `geometry-nodes` and `hair-core` kept on `NodeNext` (required by their module setting)

---

## Addons (Local Only — Never Push)

`addons/` is in `.gitignore`. Never appears on GitHub.

### `addons/st-addon-human` — IN PROGRESS, NOT READY
Parametric human generator. Currently a placeholder — not a real human.
Real implementation requires MakeHuman base mesh + morph targets pipeline.
Do not push or present as complete.

### `addons/st-addon-cellfracture` — PLANNED, NOT STARTED
Full design spec agreed. Development starts next session.
See full spec below.

---

## Next Task — Build `@triforge/addon-cellfracture`

### What It Does
Breaks any Three.js mesh into shards — equivalent to Blender's Cell Fracture addon.
Standalone (Three.js only) OR integrated with triforge packages.

### Input
- Accepts `THREE.BufferGeometry` OR `THREE.Mesh` — auto-detects which was passed

### Fracture Patterns (all three)
- **Voronoi** — random natural chunks (rocks, concrete, ceramic)
- **Grid** — clean uniform cuts (bricks, tiles)
- **Radial** — outward from impact point (bullet hole, glass)

### Geometry Mode
- `auto` — detects flat (glass pane) vs solid 3D mesh automatically
- `glass` / `solid` — explicit override

### Impact System
- `impactPoint: Vector3` — where the hit came from
- `impactDirection: Vector3` — direction of force
- `impactStrength: number` — how hard (affects shard size + fly speed)
- `impactType` preset — bullet, sledgehammer, explosion, drop, pressure, custom
- `falloffRadius` — dense within radius, sparse beyond
- `impactPoints[]` — multiple impact points each with own strength + falloff
- `influenceFunction: (point: Vector3) => number` — custom density map per point on mesh

### Shard Count
- Simple: `shardCount: 50`
- Advanced per-pattern:
  - Voronoi: voronoiDensity, voronoiRandomness, voronoiSeed
  - Grid: gridRows, gridColumns, gridDepth
  - Radial: radialRings, radialSegments, radialRandomness

### Material
- `materialMode: auto / single / dual`
- Single material default
- Dual = second material for interior cut faces

### Output
Each shard is a `THREE.Mesh` with pre-calculated mass, volume, centerOfMass.
Returned as `CellFractureResult.shards: ShardMesh[]`.

### Built-in Animation Presets (standalone)
none, fly-apart, implode, settle, explosion

### Triforge Integration (all opt-in)
- `@triforge/particle-core` — pass force fields to drive shards
- `@triforge/physics-core` — rigid body simulation using shard mass/volume/CoM
- Raw Three.js or third-party — shards are plain Meshes, use anything

### File Structure
```
addons/st-addon-cellfracture/
  src/
    CellFracture.ts
    core/
      CellFractureParameters.ts
      ShardMesh.ts
      CellFractureResult.ts
    patterns/
      VoronoiFracture.ts
      GridFracture.ts
      RadialFracture.ts
    geometry/
      MeshClipper.ts
      InteriorFaces.ts
      GeometryAnalyser.ts
    impact/
      ImpactProfile.ts
      FalloffMap.ts
    animation/
      AnimationPresets.ts
      ShardAnimator.ts
    integration/
      ForceFieldAdapter.ts
    index.ts
  examples/
    example-cellfracture.html
  test/
  package.json
  tsconfig.json
  CLAUDE.md
  TUTORIAL.md
```

### Build Order (15 steps)
1. Package scaffold — folder, package.json, tsconfig.json, CLAUDE.md
2. CellFractureParameters — full parameters interface + defaults
3. GeometryAnalyser — auto-detect flat vs solid, calculate mass/volume/CoM
4. VoronoiFracture — core fracture algorithm
5. MeshClipper — clip source mesh against voronoi cells into shard geometries
6. InteriorFaces — cap geometry for cut surfaces (dual material)
7. GridFracture — uniform grid cuts
8. RadialFracture — radial pattern from impact point
9. ImpactProfile + FalloffMap — presets, multi-point, custom influence function
10. ShardMesh + CellFractureResult — output types
11. CellFracture main class — public API
12. AnimationPresets + ShardAnimator — built-in animations
13. ForceFieldAdapter — particle-core force field bridge
14. Example file — browser demo
15. Tests + TUTORIAL.md

---

## Important Rules (Never Break)

- `addons/` — never push to any branch
- `My-Coding-Standards/` — never push, read and follow locally
- `main` branch — never push directly, always via PR
- Packages never import from each other (except `@triforge/core-types`)
- Every addon must work with Three.js alone — triforge packages are opt-in
- No `any` types, no `@ts-ignore`, no dynamic template-literal imports

---

## Open Issues (from package-issues.log)

| Package | Issue | Status |
|---|---|---|
| `strata-css` | PostCSS plugin missing `from` option | OPEN — contact package author |
| `@triforge/compositor-core` | pmndrs backend untested in Vite | OPEN — low priority |
| `@triforge/geometry-nodes` | Full socket type coverage pending | OPEN — SOCKETS constant is workaround |
| `esbuild 0.28.x` | Arbitrary file read on Windows dev server | RESOLVED — Dependabot PR merged |
