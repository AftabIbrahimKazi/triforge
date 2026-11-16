# Lane Board
Updated continuously by active sessions. Dev clears `done` rows. `Files` lists every path the task will touch — new claims require every listed file to be free in `locks.md` (see `handover/PROTOCOL.md`).

| Role | Task | Files | Status | Started |
|---|---|---|---|---|
| bugfix | Package-by-package bugfix sweep (all st-* packages, radius-parametric-geometry, render-budget-core, context-pool-core, addon-human) | st-*/**, radius-parametric-geometry/**, render-budget-core/**, context-pool-core/**, addons/st-addon-human/** | done (addon-human skipped — incomplete placeholder, see handover/bugfix.md) | 2026-10-12 |
| ab-render | A/B render pipeline harness (plan: handover/plans/ab-render-pipeline-plan.md; implement via Kaggle) | tools/ab-test/**, examples/ab-test/**, handover/ab-render-pipeline.md, handover/plans/ab-render-pipeline-plan.md | in progress — K1–K10 done, C1–C4 done for scene 1; next C5 (bake spike for variant B) | 2026-11-16 |
| pathtracer-offline | Opt-in offlineMode for PathTracerRenderer (st-pathtracer-core) | st-pathtracer-core/**, examples/pathtracer/**, TUTORIAL.md, BACKLOG.md, handover/roles/pathtracer-offline.md, handover/pathtracer-offline.md | done — v0.2.0, tests pass | 2026-11-16 |
| bake-ship | Build st-bake-core, side-by-side example, audit all packages, release (see handover/bake-ship.md) | st-bake-core/**, examples/bake/**, TUTORIAL.md, THREE_JS_ECOSYSTEM.md, CLAUDE.md, README.md, st-*/** (audit fixes only), handover/bake-ship.md | in progress — step 1 done (uncommitted), next step 2 example | 2026-11-16 |
| scene-doctor | Build scene-doctor-core: dev-only scene linter/probe/edit panel, AI-agnostic, token-capped reports (plan: handover/plans/scene-doctor-plan.md) | scene-doctor-core/**, examples/scene-doctor/**, handover/scene-doctor.md, handover/plans/scene-doctor-plan.md, handover/roles/scene-doctor.md | claimed — scaffold next | 2026-11-17 |
