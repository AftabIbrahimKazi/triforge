# Handover — A/B render pipeline (in progress)

Plan: [handover/plans/ab-render-pipeline-plan.md](plans/ab-render-pipeline-plan.md)

## Decision (2026-11-16, dev)
Implemented via Kaggle (`/kaggle`); Claude reviews and does the judgment/GPU work. Thresholds confirmed as proposed: >=25% lower mean DeltaE than A, p95 <= 16.7 ms on the weak device, extra download <= 25 MB. Head model/licence still undecided.

## Resume point
- Done: K1–K10 (`tools/ab-test/`, 33/33 tests, reviewed and brought to standard by hand), C1, C3 and C4 for scene 1 (`examples/ab-test/ab-room.html`, `?variant=A|R`, `?samples=N`).
- First numbers (R 64 samples vs A, 640x360, 4 poses): mean DeltaE ~38–40, p95 ~54–60, SSIM ~0.08–0.12. A floods the enclosed room with unoccluded env light; that is the gap B/C must close.
- Next: C5 (throwaway bake for B, ray-traced AO/denoise spike for C), scenes 2–4, C6 (multi-device runs, results file), C7 (apply the decision rule; only then TUTORIAL/BACKLOG/ECOSYSTEM updates).
- Run recipe: `python -m http.server 8123` from the repo root, then `node tools/ab-test/harness/capture.mjs --headless --width 640 --height 360 --url "http://localhost:8123/examples/ab-test/ab-room.html?samples=64" --out .ab-out --variant R --poses 4`. Headed Chrome closed mid-run on R; use `--headless`. R's path-tracer shader takes ~45 s to compile; each pose is slow.
- Known: R frame times are meaningless (readPixels does not wait on the tracer target). `st-pathtracer-core` wrapper leaves raster fallback, 100 ms render delay and 500 ms fade on; set `renderDelay=0, minSamples=0, fadeDuration=0, rasterizeScene=false` for offline captures (C4 finding).
- Locks: none held.

## Same-session side effects (uncommitted, not part of this task)
- three.js bumped to 0.187.0 across all package.json files and 231 example importmaps; tests pass except pre-existing compositor SSAO failure and missing test folders in metaball/pathtracer.
- `KIT_GAPS.md` gaps 2–4 added.
