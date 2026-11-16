# Handover — pathtracer-offline

## Resume point
- Done: `offlineMode` option and exported `applyOfflineMode()` in `st-pathtracer-core` (v0.2.0), `compiling` getter, fix for the per-frame `updateCamera()` reset (accumulation never built up with three-gpu-pathtracer 0.0.27), `test/run-tests.js` (5 tests), package `TUTORIAL.md`, root TUTORIAL.md row, example `examples/pathtracer/example-pathtracer-offline.html` (verified headless: 64/64 samples).
- Not done: `npm run bench` (no GPU-free benchmark is meaningful; flagged), BACKLOG.md entry (BACKLOG.md does not exist locally; it is gitignored). Backlog items to add when it exists: `_cameraChanged` only compares position, not rotation; wrapper types say `setScene` returns a Promise but 0.0.27 is synchronous.
- Locks: released.
