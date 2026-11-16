# Lane Board
Updated continuously by active sessions. Dev clears `done` rows. `Files` lists every path the task will touch — new claims require every listed file to be free in `locks.md` (see `handover/PROTOCOL.md`).

| Role | Task | Files | Status | Started |
|---|---|---|---|---|
| bugfix | Package-by-package bugfix sweep (all st-* packages, radius-parametric-geometry, render-budget-core, context-pool-core, addon-human) | st-*/**, radius-parametric-geometry/**, render-budget-core/**, context-pool-core/**, addons/st-addon-human/** | done (addon-human skipped — incomplete placeholder, see handover/bugfix.md) | 2026-10-12 |
| ab-render | A/B render pipeline harness (plan: handover/plans/ab-render-pipeline-plan.md; implement via Kaggle) | tools/ab-test/**, examples/ab-test/**, handover/ab-render-pipeline.md, handover/plans/ab-render-pipeline-plan.md | in progress — K1–K10 done, C1–C4 done for scene 1; next C5 (bake spike for variant B) | 2026-11-16 |
