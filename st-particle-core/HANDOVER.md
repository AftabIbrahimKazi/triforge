# st-particle-core — Development Handover

## Track A — Blender Particle System Parity

| Phase | Description | Status |
|---|---|---|
| A1 | Core architecture — Particle, ParticleSystem, BaseEmitter/Force/Renderer, SeededRandom | ✅ Done |
| A2 | Emission Controls — seed, lifetimeRandom, evenDistribution, emission window | ✅ Done |
| A3 | Velocity & Rotation Controls — objectInherit, worldVelocity, rotation panel, angular velocity | ✅ Done |
| A4 | Force fields — full Blender effector set | ✅ Done (9 forces) |
| A5 | Render modes — Billboard, Line, Instance, Collection | ✅ Done |
| A6 | Source vertex groups — weight-painted emission zones | ✅ Done |
| A7 | Children — sub-particles, simple/interpolated, clumping | ✅ Done |
| A8 | Cache / Bake — deterministic replay at any time | ✅ Done |

## Track B — Advanced Systems

| Phase | Description | Status | Blocked By |
|---|---|---|---|
| B1 | Boids flocking AI | ✅ Done | — |
| B2 | Keyed physics | Stubbed (blocked) | st-keyframe |
| B3 | SPH fluid particles | Stubbed (blocked) | st-fluid-core |
| B4 | Hair/strand render | Stubbed (blocked) | st-hair-core |

## Track C — Physics Panel & Display Panel

| Phase | Description | Status |
|---|---|---|
| C1 | Collision / Deflectors — DeflectorCollider, addDeflector, bounce + dieOnHit | ✅ Done |
| C2 | Texture Emission Density — MeshEmitter.densityTexture (red channel CDF) | ✅ Done |
| C3 | Display Colour Modes — BillboardRenderer + LineRenderer colourMode 0/1/2 | ✅ Done |
| C4 | Scale Time — ParticleSystem.parameters.scaleTime (0=freeze, <0=reverse) | ✅ Done |

## Track D — Physics Completeness

| Phase | Description | Status |
|---|---|---|
| D1 | Display Amount — wire `parameters.displayAmount` in all 4 renderers | ✅ Done |
| D2 | Size Deflect — `DeflectorCollider.checkCrossing` uses `particle.size * 0.5` as collision radius | ✅ Done |
| D3 | Self Effect — O(n²) inter-particle elastic collision pass in `ParticleSystem._stepSelfCollision` | ✅ Done |
| D4 | TextureForce — `src/forces/TextureForce.ts`, per-particle force from DataTexture RGB→XYZ | ✅ Done |

## Architecture Notes

- **No cross-package imports** — only `three` is imported as a peer dependency
- **parameters objects** — all scalar inputs on every class, GSAP-compatible
- **worldVelocity** — set `emitter.worldVelocity` each frame before `sys.update()` for objectInherit to work
- **rotation** — `particle.rotation` (Vector3 of Euler angles) is integrated from `particle.angularVel` in `_stepNewtonian`. Physics mode `'none'` does NOT integrate rotation — set `physics: 'newtonian'` if you want particles to spin over time.
- **ObjectRenderer** — must use `billboard: false` to see particle rotation; billboard mode ignores rotation and always faces camera
- **Children (A7)** — `ParticleSystem.parameters.{childCount, childSpread, childType}` (all numbers, GSAP-animatable). Children are generated each frame in `BaseRenderer.expandWithChildren()`. `_childRng` is reset from `parameters.seed` each frame for stable child positions. `_drawBuf` and `_aliveBuf` in BaseRenderer are pre-allocated in each renderer's constructor via `this._allocDrawBuf(max)` — no heap allocations inside `update()`. CollectionRenderer uses `drawBuf[i].poolIdx` so children inherit their parent's mesh assignment.
- **Cache / Bake (A8)** — `ParticleCache` in `src/core/ParticleCache.ts`. `sys.bake(startSec, endSec, fps)` resets, warms up, and records `Math.ceil((end-start)*fps)+1` frames as `number[][]` (12 floats/particle: pos+vel+rot+size+normalised+alive). After bake, `update(dt)` calls `seek()` instead of simulating. `unbake()` clears the cache and resets to live. `seek()` is zero-allocation (writes into existing Particle objects). `toJSON()/fromJSON()` round-trips via plain JS arrays. `sys.pool` getter provides package-internal pool access.
- **Boids (B1)** — `BoidForce` in `src/forces/BoidForce.ts`. Constructor takes `pool: Particle[]` reference (same injection pattern as ChargeForce). Single-pass neighbour scan with three accumulators (sep/align/cohesion). Force and velocity clamped per-step. Blender panel params (separationWeight etc.) are exposed as numeric stubs for GSAP.
- **Stubs (B2/B3/B4)** — `KeyedPhysics` (`src/physics/`), `SPHPhysics` (`src/physics/`), `StrandRenderer` (`src/renderers/`). All no-op with one-time `console.warn`. All export `parameters` objects. StrandRenderer extends BaseRenderer and returns a `THREE.Group`.

## Test Suite

Run from `st-particle-core/`:

```sh
npm run build && npm test
```

125 tests — covers renderers, emission controls, velocity & rotation controls, source vertex groups, children (A7), cache/bake (A8), boids (B1), stubs for B2/B3/B4, C1 (collisions), C2 (texture density), C3 (colour modes), C4 (scale time), D1 (displayAmount), D2 (size deflect), D3 (self effect), D4 (TextureForce).
