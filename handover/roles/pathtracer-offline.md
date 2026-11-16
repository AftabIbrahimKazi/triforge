# Role — Path tracer offline mode

## Mission
Add an opt-in `offlineMode` to `st-pathtracer-core`'s `PathTracerRenderer` so offline and test captures get a pure path-traced image: no raster fallback, no render delay, no fade. Found by the A/B render work (C4); see `handover/ab-render-pipeline.md`.

## Owned paths
- st-pathtracer-core/ (src, test, dist, package.json version, TUTORIAL.md if created)
- TUTORIAL.md and BACKLOG.md at the root (additions only)
- examples/pathtracer/

## Forbidden paths
- Any other package. No imports from other packages (only `three`, `three-gpu-pathtracer`).
- Do not change the existing default behaviour or the `parameters` shape: `offlineMode` defaults to off.

## Definition of done
Default behaviour unchanged, `offlineMode` documented in the package tutorial, tests pass, build is clean, root tutorial and backlog updated.
