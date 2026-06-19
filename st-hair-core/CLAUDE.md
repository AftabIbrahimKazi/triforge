# st-hair-core — Claude Code Guide

Hair and fur strand rendering for Three.js, matching Blender's Hair Particle System.

## Package Structure

```
src/
  core/
    Strand.ts          — Strand interface, Catmull-Rom spline, RMF frames
    HairSystem.ts      — Main orchestrator: strands → modifiers → geometry
  geometry/
    tubeGeometry.ts    — Circular cross-section tube per strand
    ribbonGeometry.ts  — Flat quad strip per strand
    lineGeometry.ts    — Line segments (dense hair / grass)
  modifiers/
    KinkModifier.ts    — WAVE / CURL / RADIAL / BRAID displacement
    ClumpModifier.ts   — Pull child strands toward parent strands
  generators/
    StrandGenerator.ts — Distribute strands on a BufferGeometry surface
  index.ts             — Public API
```

## Key Design Decisions

- **Catmull-Rom spline** — `sampleSpline` uses the standard `_cr` formulation with clamped endpoint ghosts.
- **Double Reflection Method (RMF)** — `computeRMFrames` propagates twist-free frames along the curve. Avoids the flip artifacts of Frenet-Serret frames.
- **Area-weighted distribution** — `StrandGenerator` builds a CDF from triangle areas so dense mesh regions don't get over-sampled.
- **Non-mutating modifiers** — `applyKink` and `applyClump` always return new `Strand` objects.
- **One-shot build** — `HairSystem.build()` is expensive for large strand counts (tube mode). It is not intended for per-frame calls; animate via material uniforms instead.

## Performance Limits (from bench/results-2026-05-26.md)

| Operation            | Strands | ms    |
|----------------------|---------|-------|
| generate + kink      | 2000    | ~3.5  |
| build (tube, 4cs)    | 500     | ~11   |
| build (ribbon)       | 2000    | ~11   |
| build (line)         | 2000    | ~5.6  |

## Commands

```bash
npm run build   # TypeScript compile → dist/
npm test        # 45 tests via node test/run-tests.js
npm run bench   # Performance benchmark
```
