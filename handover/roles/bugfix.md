# Role — Package Bugfix Sweep

## Mission
Go through every existing package in the ecosystem and fix bugs — run each package's own test suite, find regressions/defects, fix them in place, re-benchmark where a `bench/` baseline exists.

## Owned paths
- st-animation-core/, st-compositor-core/, st-core-types/, st-curve-core/, st-fluid-core/, st-geometry-nodes/, st-hair-core/, st-keyframe/, st-metaball-core/, st-modifier-core/, st-particle-core/, st-pathtracer-core/, st-physics-core/, st-shader-core/, st-uv-core/, st-volume-core/
- radius-parametric-geometry/, render-budget-core/, context-pool-core/
- addons/st-addon-human/
- TUTORIAL.md, BACKLOG.md (additions only, only if a fix changes a public API/behavior)

## Forbidden paths
- No cross-package imports introduced to fix a bug (except via `st-core-types`) — a fix that needs one is a design problem, flag it instead of patching around it.
- Don't touch `handover/board.md` other than this role's own row; don't touch other roles' charters.

## Definition of done
Per package: existing test suite passes (`npm test`), the specific bug's repro no longer reproduces, no mutation introduced into previously non-destructive modifiers/node graphs, benchmark re-run and compared against the stored baseline if one exists. TUTORIAL.md updated only if the fix changes a signature or documented behavior.
