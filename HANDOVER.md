# Triforge — Handover Document

Last updated: 2026-07-04

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
| `@triforge/shader-core` | 0.2.0 |
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

### `addons/st-addon-cellfracture` — BUILT, all 15 steps complete (2026-07-03)
Full Voronoi/Grid/Radial fracture, impact system, dual materials, mass/volume/CoM
per shard, built-in animation presets, optional particle-core/physics-core bridges.
29/29 tests passing. See `addons/st-addon-cellfracture/TUTORIAL.md` for usage.
Known limitation: interior cap faces are an approximation (plane clipped against
the cell's other planes + bounding box, not a true boolean intersection) — correct
for convex/near-convex source shapes (rocks, bricks, glass, walls), may leave
gaps on highly concave source meshes.

### `addons/st-addon-weather` — BUILT, all 26 steps complete (2026-07-03)

Full procedural weather system + integrated day/night cycle. All 10 layers of the
build order below complete: interfaces + `WeatherRegistry` (shape-validated at
registration), `WeatherParameters`/`WeatherState`/`SeededRandom`, day/night
(`StylizedSunPosition` default + `AstronomicalSunPosition`/`MoonPhase` opt-in,
validated against published reference sunrise/sunset/moon-phase data), wind
(`SelfContainedWindField` + opt-in `WindFieldAdapter`), the four opt-in integration
bridges (`ParticleCoreBridge`, `VolumeCoreBridge`, `ShaderCoreBridge`,
`CompositorCoreBridge`), all 4 sky renderer modes, `MaterialInteraction` +
`WeatherShaderNodes`, all 11 `IWeatherEffect` implementations (Clear, Rain, Snow,
Fog, Wind, Cloud, Storm w/ flash|bolt lightning, Hail, Sandstorm, Blizzard,
Rainbow), `WeatherTransition` + opt-in `AutonomousWeatherGenerator`, and the
`WeatherSystem` orchestrator. 102/102 tests passing (`npm test`), clean `tsc`
build, security check pass (no eval/Function, no unsanitized GLSL interpolation).
Benchmarks in `bench/results-2026-07-03.md` prove zero-cost unregister and linear
(no O(n²)) per-effect update scaling, all far under the 16ms frame budget. See
`addons/st-addon-weather/TUTORIAL.md` and
`addons/st-addon-weather/examples/example-weather.html` for usage.

Known deviation from spec: `WeatherSystem` does not silently auto-register
built-in effects for unlisted weather types — the developer registers exactly the
effects they want via `registerEffect()` or the constructor's `effects` option,
keeping unused weather types at genuine zero cost rather than paying for a hidden
default. This is documented in TUTORIAL.md's Quick Start.

### `addons/st-addon-terrain` — Stage 1 of the Terrain Suite BUILT (2026-07-03)

Chunked, streaming, LOD terrain generation. `NoiseHeightmapProvider` (layered
gradient noise + domain warping, matched byte-for-byte in logic between the
main-thread path and the inlined Web Worker script) + `ImageHeightmapProvider`
(developer-supplied heightmap data), `TerrainSurfaceSampler` (the concrete
`ISurfaceSampler` implementation the rest of the terrain suite consumes),
`buildChunkGeometry` (single-chunk mesh builder with optional skirt), 4-level
distance-banded LOD (`lodScheme.ts`), `TerrainStreamer` (async `update()` —
dispatches chunk generation to a Web Worker when available, `updateSync()` as
the guaranteed synchronous fallback used automatically when `Worker` is
unavailable), heightmap edit API (`setHeight` + `markDirtyAt` +
`regenerateAffectedChunks`), `TerrainMaterial` (two rendering paths behind one
API: standalone vertex-color slope/altitude blend with zero custom GLSL, or a
real-texture "splat" path using `MeshStandardMaterial.onBeforeCompile` — the
documented Three.js technique, full PBR lighting/shadows preserved, no
developer string ever interpolated into shader source — plus opt-in
`shader-core` graph upgrade taking priority over both), and opt-in
`ModifierCoreBridge`/`PhysicsCoreBridge`. 65/65 tests passing (`npm test`),
including a dedicated seam test proving two neighboring chunks — even at
different LOD resolutions, on intentionally steep/rough terrain — agree
EXACTLY on height at every point along their shared edge, not just
lattice-aligned ones. Clean `tsc` build. Benchmarks in
`bench/results-2026-07-03.md`. See `addons/st-addon-terrain/TUTORIAL.md` and
`addons/st-addon-terrain/examples/example-terrain.html` (single demo covering
every feature: both heightmap sources, both material modes, live sculpting,
live surface-sampler readout, mock physics-core collider demo).

Process note: this package was built across several background-agent sessions
that intermittently returned placeholder "waiting for background work"
messages instead of doing real work (same failure mode seen once during the
weather build) — real progress did land between those messages, but two
parallel/duplicate single-chunk mesh builders (`ChunkMeshBuilder`/
`TerrainChunkGrid` vs. the more complete `buildChunkGeometry`/`TerrainStreamer`)
were written independently across sessions without being reconciled. The
duplicate pair was deleted in favor of the more complete
`buildChunkGeometry`/`TerrainStreamer` implementation (the only one with real
Worker-based streaming and heightmap-edit support) during a manual review/fix
pass, along with fixing a real bug where the Worker was constructed but never
actually used (`TerrainStreamer.update()` was missing entirely — added).

**Post-completion fixes (found via live browser testing, not caught by the unit
suite alone — see the pattern noted in cellfracture's own history):**
1. `resolutionForLevel` divided the *vertex* count by the LOD divisor instead
   of the *quad* count, breaking lattice alignment between LOD levels (e.g.
   baseResolution 33 = 32 quads: dividing vertices by 2 gave 15 quads instead
   of the required 16). Fixed; added a regression test.
2. The Web Worker script (`chunkWorkerSource.ts`) never implemented skirt
   geometry at all, unlike the main-thread `buildChunkGeometry.ts` — every
   Worker-generated chunk silently had `skirtDepth=0` regardless of what was
   requested. Fixed; added a structural regression test (can't fully unit-test
   the Worker path in Node, so this is a text-level guard against the skirt
   code being dropped again).
3. **The actual root cause of visible cracks even after fixes 1-2**: skirts
   only hide a height MISMATCH between LOD levels below a bounded depth — on
   steep/rough terrain the real mismatch can exceed any reasonable
   `skirtDepth`. Fixed properly with `edgeClamp`: a chunk bordering a coarser
   neighbor now snaps its edge vertices to the same straight-line
   interpolation the coarser neighbor renders, so the two chunks' shared edges
   are byte-identical — no gap exists to hide, skirts are now pure
   defense-in-depth rather than load-bearing. `TerrainStreamer` computes this
   automatically (deterministically, from each neighbor's distance-based LOD —
   no coordination/loading-order dependency required) and passes it through
   both the sync and Worker paths. 59/59 tests passing after all three fixes,
   including a seam test with intentionally steep/rough terrain proving exact
   (not just approximate) edge match at every point, not only lattice-aligned
   ones.

**Stage 2 (`addon-trees`), Stage 3 (`addon-rocks`), Stage 4 (`addon-vegetation`)
not started.** Each only depends on `addon-terrain`'s `ISurfaceSampler` shape
(already stable), not on `addon-terrain` itself — see "Stages" below.

### `addons/st-addon-trees` — Stage 2 of the Terrain Suite BUILT (2026-07-04)

Procedural tree generation, terrain-aware scatter placement, instanced/LOD
rendering, and wind sway. `TreeGenerator` (recursive branching trunk/branch
cylinders + sphere/cone canopy, `TREE_PRESETS` for oak/pine/birch/bush/
deadTree, indexed `BufferGeometry`, every scalar clamped to a safe range so
extreme parameters — zero branch depth, near-zero height, zero radius — never
produce NaN/degenerate geometry, deterministic given the same seed), a local
`ISurfaceSampler` interface (byte-identical shape to `addon-terrain`'s, never
imported from it) consumed by `TreePlacement` (slope/altitude/moisture density
rules with smooth falloff near the thresholds rather than a hard cutoff, plus
an optional manual density-mask callback that multiplies the automatic
density — never replaces it, regression-tested with a zero-mask and a
full-mask case), `TreeScatter` (two `THREE.InstancedMesh` — full-detail and
impostor — sharing one placement; `update(cameraPosition)` swaps each
instance's visible bucket by distance via a zero-scale matrix rather than
adding/removing instances, so both meshes stay single draw calls;
`dispose()` releases geometry/material/GPU buffers with zero residual,
idempotent), `TreeWindMaterial` (built-in single-term vertex sway via
`MeshStandardMaterial.onBeforeCompile` — the same documented technique
`TerrainMaterial` uses, full PBR lighting/shadows preserved, no developer
string ever interpolated into GLSL — plus an optional local `IWindProvider`
interface byte-identical in shape to `addon-weather`'s, so `weather.wind` can
be passed in directly with zero cross-addon import), and opt-in
`GeometryNodesBridge`/`ParticleCoreBridge` stubs (structurally typed, no hard
import, mock-tested). 27/27 tests passing (`npm test`), including a
regression test for the `stripUndefined`-before-merge bug, a slope/altitude
placement-bounds test, a manual-mask-multiplies-not-replaces test, an
LOD-swap-triggers-at-distance test, a zero-cost-dispose test, and a
fallback-vs-geometry-nodes-upgrade-path drift guard. Clean `tsc` build,
security check pass (no `eval`/`Function`, no unsanitized GLSL string
interpolation, all wind/generator numeric parameters validated finite).
Benchmarks in `bench/results-2026-07-04.md` show `TreePlacement.scatter()`
and `TreeScatter` construction/`update()` scaling roughly linearly with
instance count (not O(n²): e.g. update() cost per instance actually
*decreases* from ~0.004ms at n=100 to ~0.0003ms at n=5000, consistent with
fixed per-call overhead amortizing) and `dispose()` completing in ~0.01–0.02ms
regardless of instance count (1,000 vs 10,000), proving the zero-cost-
unregister guarantee. See `addons/st-addon-trees/TUTORIAL.md` and
`addons/st-addon-trees/examples/example-trees.html` (live tree-shape
regeneration with presets, a hand-written mock sine-wave `ISurfaceSampler` as
a terrain stand-in, manual density-mask clearing demo, live wind controls,
on-screen full-LOD/impostor instance count readout).

**Deviations from spec:**
- Chunk-awareness (Stage 2's build-order step 17: consuming a `TerrainStreamer`'s
  load/unload events so scatter streams with terrain chunks) was deferred to
  Stage 5 integration rather than built here — `TreePlacement`/`TreeScatter`
  currently scatter across one fixed area per call; a developer using chunked
  terrain today calls `scatter()` once per loaded chunk by hand. This mirrors
  `addon-terrain`'s own deferral of the `deformTerrain` callback to the
  scatter packages that would call it — the same reasoning applies in
  reverse here since chunk-awareness is genuinely a Stage 5
  (multi-package-integration) concern per the original build order.
- The impostor LOD mesh is any developer-supplied `BufferGeometry` (the
  example uses a static cross-quad billboard) rather than an
  automatically camera-facing billboard — no per-frame billboard rotation
  logic was built. Documented as a known limitation in `BACKLOG.md`.

**Process note:** unlike the terrain build, no post-completion browser-testing
bugs were found this session — but the build itself required a mid-session
reconciliation: an earlier background-agent dispatch for this package
returned a placeholder "running in background" status message without
writing any files (same failure mode noted in `addon-terrain`'s history), and
after the work was taken over directly in this session, a *second*, unrelated
concurrent session was independently writing to the same package directory
at the same time — it overwrote this session's `CLAUDE.md`, `IWindProvider.ts`
(with a simpler, spec-inconsistent `sample(position, out)` shape instead of
matching `addon-weather`'s real `IWindProvider` shape as the task required),
and `TreeGenerator.ts` (with a different but comparably solid indexed-geometry
implementation) mid-build. Resolved by re-reading each affected file, keeping
the higher-quality/more spec-compliant version per file (the concurrent
session's indexed `TreeGenerator` was kept and extended with the missing
`TREE_PRESETS`/`CanopyShape` exports; `CLAUDE.md` and `IWindProvider.ts` were
restored to match the task's explicit "match addon-weather's real shape"
instruction) rather than blindly picking one session's output wholesale.

---

## Next Task — Terrain Suite Stages 3-4 (`addon-rocks`, `addon-vegetation`)

**Status:** Stage 1 (`addon-terrain`) and Stage 2 (`addon-trees`) complete —
see entries above. Stages 3-4 not started. Full spec below is unchanged from
when it was originally agreed (2026-07-03) — do not skip the layered build
order within each package.

### What It Does
A family of 4 addons that together let a developer generate a full outdoor
environment procedurally — not just the land shape, but everything that goes on
top of it (trees, rocks, grass/bushes) — with automatic, realistic placement, while
every piece stays independently swappable and every asset can be customized or
replaced with the developer's own models.

### Classification & Package Split
Four separate addons under `addons/`, private, gitignored, never pushed — same
rules as cellfracture/weather (Three.js the only hard dependency, triforge core
packages `optionalDependencies` passed in at construction time, never dynamically
imported):

- `addons/st-addon-terrain` → `@triforge/addon-terrain`
- `addons/st-addon-trees` → `@triforge/addon-trees`
- `addons/st-addon-rocks` → `@triforge/addon-rocks`
- `addons/st-addon-vegetation` → `@triforge/addon-vegetation` (grass + bushes — they
  behave similarly enough, small/dense/wind-affected scatter objects, to share one
  package instead of splitting further)

**No addon imports another addon.** Per the ecosystem's addon rule and the
non-interference policy already established for weather, these 4 packages connect
only through a small structurally-typed interface (see "Surface Sampler Contract"
below) — never a concrete class import across package boundaries. A developer
could feed `addon-trees` a heightmap from a source other than `addon-terrain` and
it would work identically.

### Surface Sampler Contract (the thing that makes 4 separate packages "blend seamlessly")
Each of `addon-trees`/`addon-rocks`/`addon-vegetation` defines its own local copy
of a small interface (same pattern as `SeededRandom` being duplicated per-addon
rather than shared):

```typescript
interface ISurfaceSampler {
  sampleHeight(x: number, z: number): number
  sampleNormal(x: number, z: number, out: Vector3): Vector3
  sampleSlope(x: number, z: number): number   // 0 = flat, 1 = vertical
  sampleMoisture?(x: number, z: number): number // optional, 0..1
}
```

`addon-terrain` exports a concrete `TerrainSurfaceSampler` implementing this shape,
built on the same heightmap used to build the terrain mesh (independent of which
LOD/chunk resolution is currently rendered, so queries are stable regardless of
camera distance). A developer passes this (or their own object matching the
shape) into the scatter packages' placement engine — none of the scatter packages
import or reference `addon-terrain` directly.

The same pattern applies to wind: each scatter package accepts an optional
`windProvider?: { sample(position: Vector3, out: Vector3): Vector3 }` — structurally
identical to `addon-weather`'s `IWindProvider`. A developer can pass
`weather.wind` (or `weather.sampleWindAt`-backed adapter) straight in without
either addon importing the other. This is the concrete mechanism behind "seamless
blending with other addons."

### Terrain↔Asset Coupling
Terrain shape is decided independently by default (no feedback loop, matches
Triforge's non-destructive philosophy) — but each scatter package accepts an
opt-in `deformTerrain?: (sampler: ISurfaceSampler, position: Vector3, footprint: number) => void`
callback a developer can wire to `addon-terrain`'s heightmap-edit API (see below)
to flatten/dent the ground under a placed rock/tree if they want that. Off by
default.

---

### `addon-terrain`

**Shape generation — noise (default) + heightmap import, no sculpting UI in this
build.** A `HeightmapProvider` interface has two built-in implementations:
- `NoiseHeightmapProvider` (default) — layered Simplex/Perlin noise with domain
  warping for erosion-like results, fully parametric (seed, octaves, roughness,
  mountain height, valley carving)
- `ImageHeightmapProvider` — developer supplies a heightmap image/Float32Array

Both expose `getHeight(x, z)` / `setHeight(x, z, value)` directly — this is the
"sculpting" data-model support: any tool (a quick HTML brush demo, or the future
Stage 2 GUI) can read/write it and call `regenerateAffectedChunks()`. No paint UI
is built as part of this addon itself.

**Chunked streaming, Web Worker generation.** `TerrainStreamer` tracks a reference
point (typically the camera) and loads/unloads chunks within a configurable
radius. Each chunk is generated (heightmap sampling + mesh building) inside a Web
Worker so the main thread never stutters; automatic fallback to synchronous
main-thread generation if `Worker` isn't available (e.g. some test/SSR
environments) — same standalone-first rule as everywhere else in the ecosystem.
Chunks use a fixed grid size with 3-4 LOD levels by distance; adjacent-chunk seams
are prevented with skirt geometry / matching edge resolution between neighboring
LOD levels (this is the single hardest correctness problem in the package — needs
its own dedicated test pass, not just "does it compile").

**Material** — `TerrainMaterial`: standalone `MeshStandardMaterial`-based
slope/altitude texture blending (grass/rock/snow by height+steepness) always
works with Three.js alone; richer blending via `shader-core` if supplied
(optional).

**Opt-in integrations:** `modifier-core` (erosion-like displacement/smoothing
pass over the heightmap), `physics-core` (heightfield collider matching the
current LOD/chunk state).

**Non-interference guaranteed** for all 17 core packages and all other addons
(weather, cellfracture, human) — no global singletons, no assumptions about scene
contents, real hooks only for the packages named above.

### `addon-trees`, `addon-rocks`, `addon-vegetation`

Each package, independently:
- **Built-in procedural generator** as the default (works with zero external
  assets): `TreeGenerator` (trunk/branch/canopy from L-system-lite or recursive
  branching parameters, species presets), `RockGenerator` (deformed/fractured
  low-poly boulder shapes, size/angularity presets), `GrassGenerator`/
  `BushGenerator` (blade/cluster billboards or simple cross-quad geometry).
  **Swappable** — a developer can supply their own `THREE.BufferGeometry`/model
  per species/type instead, identical public API either way (same rule as every
  other addon). Opt-in `geometry-nodes` upgrade path for richer node-graph-driven
  shapes.
- **Placement engine** — automatic rules (slope/altitude/moisture-driven density
  via the `ISurfaceSampler`, e.g. steep = rocks not grass, low+flat+wet = denser
  grass, high altitude = fewer trees) plus an optional manual density-mask
  override (developer supplies a texture or a `(x, z) => 0..1` function) layered
  on top of the automatic rules, not replacing them.
- **Rendering** — `THREE.InstancedMesh` for performance at scatter scale (hundreds
  to thousands of instances per chunk); distance-based LOD/impostor swap.
- **Wind** — a small built-in vertex-based sway (time-uniform driven, no external
  dependency) upgradeable via the `windProvider` structural interface described
  above; opt-in `particle-core` bridge for falling leaves/pollen-type effects.
- **Chunk-aware** — placement/instancing is done per-terrain-chunk so scattered
  objects stream in/out consistently with `addon-terrain`'s `TerrainStreamer`
  when one is supplied (each package still works standalone against a single
  static surface for a non-chunked scene).

---

### File Structure (per package, all 4 follow this shape)
```
addons/st-addon-<name>/
  src/
    index.ts
    core/            — parameters, SeededRandom (local copy), shared types
    interfaces/       — ISurfaceSampler (trees/rocks/vegetation) or
                        HeightmapProvider (terrain)
    <domain folders>  — e.g. terrain: chunks/, heightmap/, material/, worker/
                        scatter packages: generators/, placement/, rendering/
    integration/      — opt-in core-package bridges, structurally typed
  examples/
    example-<name>.html
  test/
  bench/
  package.json
  tsconfig.json
  CLAUDE.md
  TUTORIAL.md
```

### Stages (each stage = one complete, independently tested/documented module — do not start a later stage until the current one's own tests/example/docs are done)

- **Stage 1 — `addon-terrain`** (steps 1-10 below). Nothing else depends on this
  being perfect, but everything else depends on its `ISurfaceSampler` shape
  being stable, so this stage gets full build+test+bench+docs before Stage 2
  starts.
- **Stage 2 — `addon-trees`** (steps 11-18, this package only). Fully standalone
  — built and tested against a mock `ISurfaceSampler`, never a real
  `addon-terrain` import.
- **Stage 3 — `addon-rocks`** (steps 11-18, this package only). Same pattern as
  Stage 2. Can start any time after Stage 1 — does not depend on Stage 2.
- **Stage 4 — `addon-vegetation`** (steps 11-18, this package only, grass +
  bushes). Same pattern. Can start any time after Stage 1 — does not depend on
  Stage 2 or 3.
- **Stage 5 — Integration** (steps 19-20). Only stage that touches more than one
  package at once — the combined example wiring all 4 together plus the
  cross-addon weather-wind demo. Requires Stages 1-4 all complete.

### Build Order (layered — `addon-terrain` fully built & tested before the scatter packages start, since they consume its `ISurfaceSampler` shape)

**Phase A — `addon-terrain`**
1. Scaffold (package.json/tsconfig/CLAUDE.md)
2. `HeightmapProvider` interface + `NoiseHeightmapProvider` + `ImageHeightmapProvider` + tests
3. `TerrainSurfaceSampler` (implements `ISurfaceSampler`) + tests
4. Single-chunk mesh building (no streaming yet) + tests — get correctness right
   before adding streaming complexity
5. Multi-chunk grid + LOD levels + seam-free stitching (skirts/matching edges) +
   dedicated seam tests (sample heights at chunk boundaries from both
   neighboring chunks, assert they match)
6. `TerrainStreamer` (load/unload by reference-point distance) + Web Worker
   generation with main-thread fallback + tests
7. `TerrainMaterial` (standalone blend + shader-core opt-in)
8. Opt-in `modifier-core` (erosion pass) + `physics-core` (heightfield collider)
   bridges + mock tests
9. Heightmap edit API (`setHeight` + `regenerateAffectedChunks`) + tests
10. Example HTML, full test suite, security check, benchmark (chunk gen time,
    streaming zero-hitch proof), TUTORIAL.md

**Phase B — `addon-trees`, `addon-rocks`, `addon-vegetation` (can proceed in
parallel with each other once Phase A is done and tested)**
11. Scaffold each package
12. Local `ISurfaceSampler` interface copy + built-in procedural generator (one
    per package) + tests, verified against a mock sampler (no `addon-terrain`
    dependency in tests)
13. Placement engine — automatic rules + manual override + tests
14. `THREE.InstancedMesh` rendering + LOD/impostor + tests
15. Wind sway (built-in + `windProvider` interface) + opt-in `particle-core`
    bridge + tests
16. Opt-in `geometry-nodes` generator upgrade path + tests
17. Chunk-awareness (consumes `TerrainStreamer` events if supplied, standalone
    single-surface mode otherwise) + tests
18. Example HTML per package, full test suite, security check, benchmark
    (instance count scaling, confirm no O(n²)), TUTORIAL.md

**Phase C — Integration**
19. One combined example HTML wiring all 4 packages onto one chunked terrain,
    demonstrating: automatic placement, a swapped-in custom tree model, wind
    sway, and (per the addon rule) `weather.wind` passed into `addon-vegetation`
    as a live demonstration of cross-addon blending without any import between
    them
20. Update `HANDOVER.md` + `BACKLOG.md` + memory marking each package complete,
    same as cellfracture/weather

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
