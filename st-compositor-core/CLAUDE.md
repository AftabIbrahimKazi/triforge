# st-compositor-core — Claude Code Guide

Post-processing node graph. Dual-backend: Three.js default, pmndrs/postprocessing opt-in.
Root CLAUDE.md rules always take precedence.

---

## Package Structure

```
src/
  core/
    BasePass.ts           — abstract base class for all passes
    CompositorBackend.ts  — 'three' | 'pmndrs' type
    CompositorOutput.ts   — terminal node; builds and runs the EffectComposer
  passes/
    Bloom.ts              BrightnessContrast.ts  Blur.ts
    ChromaticAberration.ts ColorBalance.ts       DepthOfField.ts
    Exposure.ts           FilmGrain.ts           Gamma.ts
    HueSaturation.ts      Mix.ts                 Pixelate.ts
    Sharpen.ts            Vignette.ts
  index.ts                — public exports
test/
  run-tests.js            — 59 Node.js tests (no framework)
```

---

## Key Invariants

### Every pass must have:
- `readonly passType: string` — unique identifier
- `parameters: { [key: string]: number }` — all scalar inputs as plain numbers (GSAP-safe)
- `_buildThree(width, height, registry)` — returns a Three.js pass object
- `_threePassDeps()` — returns names of `three/addons/postprocessing/*.js` files to load (e.g. `['UnrealBloomPass']`)

### pmndrs-compatible passes also override:
- `_buildPmndrs(registry)` — returns a pmndrs Effect object
- `get _isPmndrsEffect(): boolean` — returns `true`

### PassRegistry = `Record<string, unknown>`
The registry holds dynamically-loaded constructors from `three/addons` and always contains:
- `_scene`  — the Three.js Scene (injected by CompositorOutput)
- `_camera` — the Three.js Camera (injected by CompositorOutput)

Passes that need scene/camera (e.g. DepthOfField → BokehPass) must read them from the registry.
They must NOT store a reference to scene/camera in the constructor.

### No static imports of three/addons or postprocessing
All module loading is dynamic (`import(... as string)`) inside `CompositorOutput`.
Passes declare what they need via `_threePassDeps()`. They never import pass classes themselves.

### OutputPass is mandatory
Three.js r152+ requires `OutputPass` at the end of every EffectComposer chain.
`CompositorOutput._compileThree()` always appends it automatically.

---

## Adding a New Pass

1. Create `src/passes/MyEffect.ts`
2. Extend `BasePass`
3. Declare `parameters` with all scalar inputs as numbers
4. Implement `_buildThree(w, h, reg)` — cast reg entries: `reg['MyPass'] as (new (...a: unknown[]) => unknown) | undefined`
5. Override `_threePassDeps()` to return the module name(s) needed
6. If pmndrs support: override `_buildPmndrs(reg)` and `get _isPmndrsEffect()`
7. Export from `src/index.ts` (class + options type)
8. Add tests in `test/run-tests.js`
9. Update `TUTORIAL.md` with a usage example

---

## Parameter Naming

Match Blender's parameter names exactly. Examples:
- `strength` not `intensity` (Bloom/Glare)
- `threshold` not `cutoff` (Bloom/Glare)
- `darkness` + `offset` (Vignette/Lens Distortion)
- `exposure` in EV stops (Exposure node)
- `greyscale` (Film node — Blender's spelling)

---

## Three.js FilmPass Constructor

Three.js r165 `FilmPass` takes exactly two arguments:
```typescript
new FilmPass(intensity: number, grayscale: boolean)
```
The old 4-argument form (`noiseIntensity`, `scanlinesIntensity`, `scanlinesCount`, `grayscale`) was removed.

---

## Testing

```bash
cd st-compositor-core
node test/run-tests.js
```

59 tests covering: construction/defaults, custom options, runtime mutation,
`_threePassDeps`, pmndrs flags, `_buildThree` error paths, `_buildPmndrs` default behaviour.

No test framework — plain Node.js assertions.

---

## What Belongs Here vs Elsewhere

| Concern | Location |
|---|---|
| Post-processing passes | `src/passes/` |
| EffectComposer wiring | `src/core/CompositorOutput.ts` |
| Surface shading, BSDF, textures | `st-shader-core` |
| Scene geometry, modifiers | `st-modifier-core` |
| Particles | `st-particle-core` |

---

## Phase 2 / Future Work (see root BACKLOG.md)

- Bloom Streaks (Glare → Streaks)
- Lens Flare
- Motion Blur
- Screen Space Ambient Occlusion (SSAO)
- Screen Space Reflections (SSR)
- Depth of Field (bokeh) improvement
- Pass graph with non-linear ordering (DAG)
- LUT (Look Up Table) color grading
