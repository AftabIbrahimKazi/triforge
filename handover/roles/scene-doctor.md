# Role — Scene Doctor

## Mission
Build `scene-doctor-core`, a dev-only, AI-agnostic scene linter, probe and edit panel for any Three.js scene. Scripts do the analysis. AI sees only a small, deduplicated report.

## Owned paths
- scene-doctor-core/
- examples/scene-doctor/
- handover/scene-doctor.md
- handover/plans/scene-doctor-plan.md

## Forbidden paths
- Any st-* package, addons/*, render-budget-core, context-pool-core, tools/ab-test.
- TUTORIAL.md, README.md, THREE_JS_ECOSYSTEM.md, CLAUDE.md, BACKLOG.md while bake-ship holds them. Update after bake-ship is done, then claim them.

## Definition of done
Full 7-step process from CLAUDE.md. Plus: prod-strip check proves no scene-doctor code in build output, and report size is capped by a token budget.
