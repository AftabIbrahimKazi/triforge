# Handover — A/B render pipeline (in progress)

Plan: [handover/plans/ab-render-pipeline-plan.md](plans/ab-render-pipeline-plan.md)

## Decision (2026-11-16, dev)
Implemented via Kaggle (`/kaggle`); Claude reviews and does the judgment/GPU work. Thresholds confirmed as proposed: >=25% lower mean DeltaE than A, p95 <= 16.7 ms on the weak device, extra download <= 25 MB. Head model/licence still undecided.

## Resume point
- Done: K1–K10 (`tools/ab-test/`, 33/33 tests, reviewed and brought to standard by hand), C1, C3 and C4 for scene 1 (`examples/ab-test/ab-room.html`, `?variant=A|R`, `?samples=N`).
- First numbers (R 64 samples vs A, 640x360, 4 poses): mean DeltaE ~38–40, p95 ~54–60, SSIM ~0.08–0.12. A floods the enclosed room with unoccluded env light; that is the gap B/C must close.
- C5 variant B done (spike, no tests): `examples/ab-test/bake-lightmaps.js` bakes per-face 24x24 lightmaps (sun + sky + 1 diffuse bounce, analytic ray-box, 64 spp) in 1.2 s, ~0.29 MB as half floats. Scene 1, R(64spp) vs B: mean DeltaE 3.2–3.7, p95 9–10, SSIM 0.30–0.36; frame p50 1.5 ms, p95 2.4 ms (A: DeltaE ~39, p50 3.9 / p95 6.8 ms). Caveat: B bakes the same sun/sky as R and the scene is static; dynamic objects not tested. Bug to remember: BoxGeometry face frames are local space, translate by box centre.
- Scene 4 (moving ball, `?dynamic=1`, ball on sunlit floor; B lights it with sun + 0.15 ambient, no shadow): vs R, whole frame B dE 3.4–4.2 (A ~38–41); ball region B dE 3.6–6.3, p95 12–30 (missing contact shadow), A ~36. Pose 3 ball is off-screen. Ambient 0.15 is my guess and moves B's ball score. capture.mjs now writes `<variant>-meta.json` (ball regions).
- Scene 2 outdoor (`?scene=outdoor`, 60 m ground, 6 trees, 2 buildings, low sun; bake 4 texels/m, max 256) with ball visible in all poses, vs R (64spp, 640x360): whole-frame mean dE A 2.8–4.2, B 3.1–4.8 (B NOT better); ball-region A 3.5–4.4, B 4.6–8.2 (p95 up to 23). Frame p50/p95: A 3.5/5.1 ms, B 1.9/4.6 ms. Reading: baking only wins in the enclosed interior; in an open, directly-lit scene the raster baseline is already close to the reference, so the section 5 rule (>=25% lower dE than A) fails for B outdoors. Variant C probably only matters for interiors, where B already matches R.
- Next: variant C prototype (ray-traced AO/denoise spike), scenes 2–4, C6 (multi-device runs, results file), C7 (apply the decision rule; only then TUTORIAL/BACKLOG/ECOSYSTEM updates).
- Run recipe: `python -m http.server 8123` from the repo root, then `node tools/ab-test/harness/capture.mjs --headless --width 640 --height 360 --url "http://localhost:8123/examples/ab-test/ab-room.html?samples=64" --out .ab-out --variant R --poses 4`. Headed Chrome closed mid-run on R; use `--headless`. R's path-tracer shader takes ~45 s to compile; each pose is slow.
- Known: R frame times are meaningless (readPixels does not wait on the tracer target). `st-pathtracer-core` wrapper leaves raster fallback, 100 ms render delay and 500 ms fade on; set `renderDelay=0, minSamples=0, fadeDuration=0, rasterizeScene=false` for offline captures (C4 finding).
- Locks: none held.

## Same-session side effects (uncommitted, not part of this task)
- three.js bumped to 0.187.0 across all package.json files and 231 example importmaps; tests pass except pre-existing compositor SSAO failure and missing test folders in metaball/pathtracer.
- `KIT_GAPS.md` gaps 2–4 added.
