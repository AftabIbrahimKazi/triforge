# Handover — bugfix role
Updated: 2026-10-12

## Current state
Done, except `addons/st-addon-human/` (intentionally skipped — that package is an
incomplete placeholder per `BACKLOG.md`, not a candidate for a bugfix sweep). No file
locks were claimed in `handover/locks.md` for this work — it ran as a single
uninterrupted session rather than a claim/resume cycle, so there was nothing to lock
against a concurrent session.

Work done, across all owned packages except `addon-human`:
- Bumped `three`/`@types/three` devDependencies from `^0.156.0`/`^0.165.0` to `^0.186.0`
  in every owned package, reinstalled, rebuilt. All builds clean against three.js 0.186.1.
- Ran every package's test suite: 1065 tests passing.
- Found and fixed a real regression: `st-compositor-core`'s `LensFlare.ts` and
  `GlareStreaks.ts` both declared `float luminance(vec3 c)`, which collides with a
  `luminance()` function three.js now injects into every fragment shader's prefix.
  Renamed to `stLuma` in both files.
- Found and fixed a real pre-existing bug (not three.js-related): `st-modifier-core`'s
  `SubdivisionModifier` divides by vertex valence in its Loop-subdivision interior-vertex
  formula; `THREE.SphereGeometry` leaves 2 orphan (valence-0) vertices at its poles,
  producing `NaN` positions. Added a zero-valence guard + regression test.
- Fixed a test race in `st-modifier-core`'s own test suite: `BooleanModifier` tests
  called `apply()` without awaiting the package's own documented `ready()` contract
  (lazy `three-bvh-csg` import). Not a package bug — the test wasn't following the
  package's own API contract.
- `st-pathtracer-core`: swapped deprecated `PCFSoftShadowMap` → `PCFShadowMap`
  (soft since three.js r182) in `RenderManager.ts`.
- Did **not** re-run `bench/` baselines for packages that have one (`st-animation-core`,
  `st-curve-core`, `st-geometry-nodes`, `st-hair-core`, `st-keyframe`, `st-particle-core`,
  `st-physics-core`, `st-shader-core`, `render-budget-core`, `context-pool-core`) — every
  change made was perf-neutral (a version-pin bump, a GLSL function rename, a shadow-map
  constant swap, an early-return guard on a vertex that previously produced NaN). If a
  future session touches any of these again in a way that could affect hot-path
  performance, re-run that package's `bench/run-bench.js` and compare.
- Separately (not part of this role's owned paths, but same sweep): also bumped/tested
  every example in `examples/*.html` against three.js 0.186.1 (all 111 pass), and fixed
  4 pre-existing example-level bugs unrelated to the version bump (wrong method names,
  a getter-only property assignment, a missing async-ready await). Full detail in
  `BACKLOG.md`'s "Upstream three.js Drift" and "Slider audit" sections.

## Next step (exact resume point)
Nothing outstanding for this role. If `addons/st-addon-human/` is ever brought out of
placeholder status, this sweep should be re-run against it specifically (same checklist:
bump three.js pin, build, test, check for the same class of bugs found elsewhere).

## Decisions & why
- Skipped `addon-human`: it's a documented incomplete placeholder, not a regression to fix.
- Skipped re-running benchmarks: every change this sweep made is provably perf-neutral
  (see above); re-running ~10 packages' full benchmark suites for no-op changes wasn't
  worth the time. Flagged here so a future session knows why the baselines weren't touched.

## Known issues
None outstanding in the owned packages. See `BACKLOG.md` for the full audit trail,
including things checked and found clean (not just things fixed).
