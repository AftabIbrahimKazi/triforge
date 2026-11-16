# A/B plan — which render approach earns its place in Triforge

Status: PLANNED 2026-11-16 (Claude session). **Implementation runs in the next session via Kaggle (`/kaggle`), not Claude** — see "Execution split". Linked from `handover/ab-render-pipeline.md`.

## 1. Why this exists

Ideas collected this session (ThreeRT analysis, `triforge-neural-render-plan-v2.md`, `webgpu-realism-120fps-plan.md`) are hypotheses. Nothing is measured. Before any new package (`st-bake-core`, denoise/temporal passes, neural pass) is built, a repeatable A/B harness decides which approaches beat the baseline on quality, frame time and download size, on the same scenes and camera paths.

Question the harness answers: **for a website 3D scene that loads fast, which route gives the most ray-traced-looking result per millisecond and per megabyte?**

## 2. Contenders (variants)

| ID | Variant | Built from |
|---|---|---|
| R | Reference: progressive path trace, high samples, no denoise | `st-pathtracer-core` (wraps `three-gpu-pathtracer`, WebGL, progressive) |
| A | Baseline raster: HDRI + shadow maps + existing `st-compositor-core` post | existing packages |
| B | Baked lightmaps + light probes + raster | new throwaway bake script |
| C | Raster + live hybrid ray-traced AO/reflections + denoise | prototype pass |
| D | B + C | combination |
| E | Idle progressive path tracing (optional) | `st-pathtracer-core` |

R is the ground truth for every ΔE/SSIM number, as ThreeRT does (its offline render, no clamps, no denoiser).

## 3. Scenes and camera paths

1. Interior room with a window (bounce light, soft shadows).
2. Outdoor environment (sky, foliage, large shadows).
3. One scanned head or character (skin, eyes). **Open: which model and licence — dev decides.**
4. One moving object in scene 1 (tests baked light on a dynamic object).

Each scene has a fixed deterministic camera path (N poses). Every variant renders the same poses.

## 4. Metrics

- Quality: mean and p95 CIE ΔE (CIEDE2000) and mean SSIM against R, overall and per region (face, shadow, reflection, sky).
- Speed: GPU/frame ms per pose, reported as p50/p95/p99 and fps, on each test device.
- Load: download size (MB), time to first usable frame on a throttled connection.
- Failure notes (manual): ghosting, light leaks, dynamic-object mismatch.

## 5. Decision rule (fixed before any run)

- Adopt a variant only if it beats A on mean ΔE by a margin the dev signs off (propose: ≥ 25% lower), stays within the frame budget on the weak device (propose: p95 ≤ 16.7 ms), and its extra download is under the agreed size (propose: ≤ 25 MB total for any model/bake assets).
- If D does not beat B by enough to justify C's cost, drop C. If B alone meets the bar, ship bake-first.
- No claim goes into README/TUTORIAL until a results file under `bench/` backs it. Do not claim "DLSS-level" anywhere.

Thresholds in parentheses are proposals; the dev confirms them at the start of the implementation session.

## 6. Preconditions (state as of 2026-11-16)

- three.js is `0.187.0` in every package (bumped this session, uncommitted).
- `npm test` passes in every package except: `st-compositor-core` (1 failing: "SSAO gives its normal render the same clipping planes it was given", probably the uncommitted SSAO.ts edit from another session), and `st-metaball-core` / `st-pathtracer-core` (no `test/` folder, `npm test` points at a missing file).
- `st-pathtracer-core` needs `three-gpu-pathtracer` and `three-mesh-bvh` (optional). The harness is tooling, not a package, so it may depend on them; no package may import the harness.
- Pathtracer reference and variants need a real GPU browser: harness captures with Playwright + Chrome, not headless Node.

## 7. Execution split

**Kaggle (qwen3-coder, mechanical, unit-testable in Node, no GPU/browser needed):** Tasks K1–K10 in section 9. Each has a local `Check:`.

**Claude (judgment, GPU/browser, design):** C1–C7 in section 10. The Kaggle model never sees these, never reviews its own work.

Order: run `/kaggle plan` on this file (free; validates format and estimates minutes) → `/kaggle run` → `/kaggle fetch`/`review` → Claude reads failures and the diff, fixes, runs tests → then Claude does C1–C7.

## 8. Layout (all new, nothing in packages changes)

```
tools/ab-test/
  package.json            ESM, deps: pngjs; devDeps: playwright-core
  src/color.js            sRGB -> Lab, deltaE76, deltaE2000
  src/ssim.js             mean SSIM on luminance
  src/stats.js            percentile, frame-time summary
  src/camera-path.js      deterministic Catmull-Rom camera path
  src/png-io.js           read/write PNG <-> {width,height,data}
  src/compare.js          compare(ref, test, regions) -> metrics
  src/report.js           results -> markdown table
  compare-cli.js          node compare-cli.js ref.png test.png
  harness/capture.mjs     Playwright: drive a page, save PNG per pose, collect frame times
  test/*.test.js          node:test
examples/ab-test/         scene pages (Claude, section 10)
st-*/bench/results-[date].md   (repo rule; results of the A/B go in the relevant package bench/ plus tools/ab-test/results/)
```

Conventions for all K tasks: ES modules (`import`/`export`), `.js` files, `"type": "module"` in `tools/ab-test/package.json`, tests use `node:test` and `node:assert/strict`, no `any`/`eval`/`Function()`, no dependencies except `pngjs` (png-io only) and Node built-ins, no `console.log` in `src/` modules, parameters validated as finite numbers (throw `RangeError` otherwise). Plain JS with JSDoc types (tools and demos are plain JS per the project's script standard; packages stay TS-strict).

## 9. Kaggle tasks (copy-ready; one or two files each; text stands alone)

## Task K1: ab-test package manifest
Target: tools/ab-test/package.json
Check: node -e "const p=JSON.parse(require('fs').readFileSync('tools/ab-test/package.json','utf8')); if(p.type!=='module'||!p.dependencies.pngjs||!p.devDependencies['playwright-core']||!p.scripts.test) process.exit(1)"
Standards: CX-1
Context: none
Write tools/ab-test/package.json as strict JSON. Fields: "name": "@triforge/ab-test", "private": true, "version": "0.0.1", "type": "module", "description": "A/B harness: ΔE and SSIM against a reference render, frame-time stats, camera paths", "scripts": {"test": "node --test test/"}, "dependencies": {"pngjs": "^7.0.0"}, "devDependencies": {"playwright-core": "^1.65.0"}, "engines": {"node": ">=24"}. No other fields, no comments.

## Task K2: CIE color difference
Target: tools/ab-test/src/color.js, tools/ab-test/test/color.test.js
Check: node --test tools/ab-test/test/color.test.js
Standards: CX-1
Context: none
ES module `tools/ab-test/src/color.js` exporting: `srgbToLab(r, g, b)` taking 8-bit sRGB (0-255) and returning `[L, a, b]` using the D65 white point (Xn=0.95047, Yn=1.0, Zn=1.08883), sRGB gamma decode, the standard sRGB-to-XYZ matrix, and the CIE Lab f() with epsilon 216/24389 and kappa 24389/27; `deltaE76(lab1, lab2)` Euclidean distance of two `[L,a,b]` arrays; `deltaE2000(lab1, lab2)` the CIEDE2000 formula with kL=kC=kH=1 (Sharma, Wu, Dalal 2005, including the hue-angle handling for the 180-degree wrap and the rotation term RT). Throw `RangeError` if any input is not a finite number. Write `tools/ab-test/test/color.test.js` with `node:test` and `node:assert/strict` using `import { srgbToLab, deltaE76, deltaE2000 } from '../src/color.js'`. Tests: srgbToLab(255,255,255) is within 0.01 of [100,0,0]; srgbToLab(0,0,0) is within 0.01 of [0,0,0]; deltaE76 of identical colors is 0; deltaE76 of [100,0,0] and [0,0,0] is 100; deltaE2000([50.0000,2.6772,-79.7751],[50.0000,0.0000,-82.7485]) is within 0.0001 of 2.0425 (Sharma pair 1); deltaE2000 of identical colors is 0; NaN input throws RangeError.

## Task K3: SSIM
Target: tools/ab-test/src/ssim.js, tools/ab-test/test/ssim.test.js
Check: node --test tools/ab-test/test/ssim.test.js
Standards: CX-1
Context: none
ES module `tools/ab-test/src/ssim.js` exporting `ssim(a, b, width, height)` where `a` and `b` are `Uint8ClampedArray` or `Uint8Array` of RGBA pixels (length width*height*4, alpha ignored). Convert each pixel to luminance `Y = 0.2126*R + 0.7152*G + 0.0722*B` (0-255 scale), then compute mean SSIM with an 11x11 Gaussian window (sigma 1.5, weights normalised), constants `C1=(0.01*255)^2` and `C2=(0.03*255)^2`, windows that fit fully inside the image only ("valid" mode), average of the SSIM map as the result in [-1, 1]. If width or height is below 11, use a uniform window of `min(width,height)` (odd, at least 1) instead. Throw `RangeError` if the array lengths do not equal width*height*4 or width/height are not positive integers. Write `tools/ab-test/test/ssim.test.js` with `node:test`/`node:assert/strict`, importing `{ ssim } from '../src/ssim.js'`. Tests: identical 32x32 random-looking image (use a fixed LCG, seed 12345, not Math.random) gives 1 within 1e-9; all-black vs all-white 32x32 gives a value below 0.01; a 32x32 gradient vs the same gradient with +10 brightness gives a value above 0.9 and below 1; wrong array length throws RangeError.

## Task K4: frame-time statistics
Target: tools/ab-test/src/stats.js, tools/ab-test/test/stats.test.js
Check: node --test tools/ab-test/test/stats.test.js
Standards: CX-1
Context: none
ES module `tools/ab-test/src/stats.js` exporting: `percentile(values, p)` — copies and sorts ascending, linear interpolation at index `(n-1)*p/100`, `p` in [0,100], throws `RangeError` for empty input or `p` outside [0,100] or non-finite values; `summarizeFrameTimes(ms)` taking an array of frame times in milliseconds and returning `{ count, mean, min, max, p50, p95, p99, fps }` where `fps = 1000 / mean`, throws `RangeError` for empty input or any non-finite or negative value; `budgetVerdict(summary, budgetMs)` returning `{ withinBudget: summary.p95 <= budgetMs, headroomMs: budgetMs - summary.p95 }`. Write `tools/ab-test/test/stats.test.js` with `node:test`/`node:assert/strict`. Tests: percentile of 1..100 at 95 is within 1e-9 of 95.05; percentile at 0 is 1 and at 100 is 100; summarizeFrameTimes of [10,10,10,10] gives mean 10, fps 100, p95 10; budgetVerdict with p95 12 and budget 16.7 is withinBudget true and headroomMs within 1e-9 of 4.7; empty array throws RangeError; a NaN value throws RangeError.

## Task K5: deterministic camera path
Target: tools/ab-test/src/camera-path.js, tools/ab-test/test/camera-path.test.js
Check: node --test tools/ab-test/test/camera-path.test.js
Standards: CX-1
Context: none
ES module `tools/ab-test/src/camera-path.js` exporting `createCameraPath(keyframes)` and `samplePath(path, count)`. A keyframe is `{ position: [x,y,z], target: [x,y,z] }`. `createCameraPath(keyframes)` validates (at least 2 keyframes, every coordinate finite, else `RangeError`) and returns `{ keyframes }` (a copy). `samplePath(path, count)` returns an array of `count` poses `{ position, target }` evenly spaced in the path parameter from 0 to 1 inclusive (count at least 2, integer, else `RangeError`), using uniform Catmull-Rom interpolation separately for position and target, with the end keyframes duplicated as the missing neighbours so the path starts exactly on the first keyframe and ends exactly on the last. Pure math, no imports, no randomness, results must be identical on every call. Write `tools/ab-test/test/camera-path.test.js` with `node:test`/`node:assert/strict`. Tests: with 3 keyframes and count 5, the first pose position equals keyframe 0 position and the last equals the last keyframe within 1e-9; the middle pose (index 2) position equals keyframe 1 position within 1e-9; two calls return deeply equal results; count 1 throws RangeError; a keyframe with NaN throws RangeError.

## Task K6: PNG read/write
Target: tools/ab-test/src/png-io.js
Check: node --check tools/ab-test/src/png-io.js
Standards: CX-1
Context: none
ES module `tools/ab-test/src/png-io.js` using `import { PNG } from 'pngjs'` (pngjs v7, CommonJS package; use the named import `{ PNG }`). Export `readPng(path)` (async; reads the file with `node:fs/promises`, parses with `PNG.sync.read`, returns `{ width, height, data }` where `data` is a `Uint8Array` of RGBA bytes) and `writePng(path, image)` (async; `image` is `{ width, height, data }`, validates that `data.length === width*height*4` else throws `RangeError`, creates the parent directory with `mkdir` recursive, writes with `PNG.sync.write`). No other exports, no console output.

## Task K7: compare two images
Target: tools/ab-test/src/compare.js, tools/ab-test/test/compare.test.js
Check: node --test tools/ab-test/test/compare.test.js
Standards: CX-1
Context: none
ES module `tools/ab-test/src/compare.js`. It imports `{ srgbToLab, deltaE2000 } from './color.js'` (srgbToLab(r,g,b) takes 0-255 sRGB and returns [L,a,b]; deltaE2000(lab1, lab2) returns a number) and `{ ssim } from './ssim.js'` (ssim(a, b, width, height) takes two RGBA byte arrays and returns mean SSIM in [-1,1]), and `{ percentile } from './stats.js'` (percentile(values, p), p in 0..100). Export `compareImages(ref, test, regions = {})` where `ref` and `test` are `{ width, height, data }` with RGBA bytes; throw `RangeError` if dimensions differ. Return `{ overall, regions }`. `overall` is `{ meanDeltaE, p95DeltaE, ssim }` over all pixels (deltaE2000 per pixel, alpha ignored). `regions` maps each key of the input `regions` object to the same three metrics for that region only; each region is `{ x, y, width, height }` in pixels, clamped to the image, a region that ends up empty gives `null`. Do not use object keys from user input without checking they are own enumerable keys (use `Object.keys`, and create the output with `Object.create(null)` to avoid prototype pollution). Write `tools/ab-test/test/compare.test.js` with `node:test`/`node:assert/strict`: two identical 16x16 images give meanDeltaE 0, p95DeltaE 0 and ssim within 1e-9 of 1 (note: a 16x16 image uses the 11x11 window); a black image vs a white image gives meanDeltaE above 90; different dimensions throw RangeError; a region `{x:0,y:0,width:8,height:8}` named `face` returns a metrics object under `regions.face`; a region fully outside the image returns null.

## Task K8: results report
Target: tools/ab-test/src/report.js, tools/ab-test/test/report.test.js
Check: node --test tools/ab-test/test/report.test.js
Standards: CX-1
Context: none
ES module `tools/ab-test/src/report.js` exporting `renderReport(title, rows, budgetMs)`. `rows` is an array of `{ variant: string, scene: string, meanDeltaE: number, p95DeltaE: number, ssim: number, frameP50: number, frameP95: number, fps: number, downloadMB: number }`. Return a markdown string: a `# <title>` heading, one line `Frame budget: <budgetMs> ms (p95)`, then one table per distinct scene (heading `## <scene>`) with the columns `Variant | ΔE mean | ΔE p95 | SSIM | Frame p50 (ms) | Frame p95 (ms) | FPS | Download (MB) | Budget`. Numbers to 2 decimals (SSIM 3 decimals). The `Budget` cell is `ok` when `frameP95 <= budgetMs` else `over`. Rows keep their input order inside each scene; scenes keep first-appearance order. Escape the pipe character in variant and scene strings. Throw `RangeError` for an empty rows array or a non-finite `budgetMs`. Write `tools/ab-test/test/report.test.js` with `node:test`/`node:assert/strict`: two rows in one scene produce one `## ` scene heading and a table with 2 data rows; a row with frameP95 20 and budget 16.7 shows `over`; a variant name containing `|` is escaped as `\|`; empty rows throws RangeError.

## Task K9: Playwright capture driver
Target: tools/ab-test/harness/capture.mjs
Check: node --check tools/ab-test/harness/capture.mjs
Standards: CX-1
Context: none
ES module script `tools/ab-test/harness/capture.mjs` run as `node capture.mjs --url <page-url> --out <dir> --variant <id> --poses <n> [--width 1280] [--height 720] [--chrome <path>]`. It uses `import { chromium } from 'playwright-core'` and `node:util` `parseArgs`. It launches Chrome via `chromium.launch({ executablePath: chromePath or undefined, channel: chromePath ? undefined : 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--use-angle=default'] })`, opens a page of the given size, navigates to `<url>?variant=<variant>&poses=<n>` (build the URL with the `URL` class, set the search params, never string-concatenate), waits up to 120 seconds for `window.__ab && window.__ab.ready === true`, then for pose index 0..n-1: `await page.evaluate((i) => window.__ab.renderPose(i), i)` (returns a Promise that resolves when the pose is fully rendered and, for the reference variant, converged), then `page.screenshot({ path: <out>/<variant>-pose<i>.png })` (zero-padded index width 3). After all poses read `await page.evaluate(() => window.__ab.frameTimes)` (array of frame times in milliseconds) and write it as `<out>/<variant>-frametimes.json` (`JSON.stringify` with 2-space indent). Validate that `variant` matches `/^[A-Za-z0-9_-]{1,16}$/` and that `poses` is a positive integer; exit with a message on stderr and code 1 on bad arguments or on a timeout. Always close the browser (try/finally). Use `node:fs/promises` `mkdir` recursive for the output directory.

## Task K10: compare CLI
Target: tools/ab-test/compare-cli.js
Check: node --check tools/ab-test/compare-cli.js
Standards: CX-1
Context: none
ES module CLI `tools/ab-test/compare-cli.js` run as `node compare-cli.js <ref.png> <test.png> [--regions regions.json]`. It imports `{ readPng } from './src/png-io.js'` (async, returns `{ width, height, data }`), `{ compareImages } from './src/compare.js'` (compareImages(ref, test, regions) returns `{ overall: { meanDeltaE, p95DeltaE, ssim }, regions }`), `parseArgs` from `node:util`, and `readFile` from `node:fs/promises`. If `--regions` is given, read and `JSON.parse` the file (an object mapping a name to `{ x, y, width, height }`; reject anything that is not a plain object with `RangeError`). Print the result with `process.stdout.write(JSON.stringify(result, null, 2) + '\n')`. On any error print the message to stderr and set `process.exitCode = 1`. Do not use `process.exit()` directly.

## 10. Claude tasks (next session, after the Kaggle output is reviewed)

C1. Review and fix Kaggle output: run `node --test tools/ab-test/test/`, `npm install` in `tools/ab-test`, security check, run the Kaggle `review`; no model self-review.
C2. Confirm decision thresholds and the head model with the dev (section 5, section 3 open item).
C3. `examples/ab-test/ab-room.html` + shared page module exposing `window.__ab { ready, renderPose(i), frameTimes }` and `?variant=`. Variant A first. R uses `st-pathtracer-core` (`PathTracerRenderer`, progressive to a fixed sample count). Capture one pose end to end with `capture.mjs`, run `compare-cli.js` A vs R.
C4. Smoke-test `st-pathtracer-core` as R: samples, convergence time, determinism (same seed, same image within tolerance).
C5. Throwaway bake for B (lightmap + probes from R's tracer) and variant C prototype (ray-traced AO/reflection + denoise). Spike only; no new package yet.
C6. Run all scenes/variants, on this machine and (dev) on a weak laptop and a phone; write `tools/ab-test/results/results-[date].md` via `report.js`, copy summary to the relevant `bench/results-[date].md`.
C7. Apply the section 5 rule, write conclusions, then and only then update root `TUTORIAL.md`, `BACKLOG.md` and `THREE_JS_ECOSYSTEM.md`, and decide which new packages (`st-bake-core`, denoise/temporal passes, neural pass) get built.

## 11. Risks

- Kaggle model writes ESM/CJS mixes → every task names the module style (done); K7/K10 restate the imported signatures because the model sees no other files.
- ΔE/SSIM against a still reference can punish lighting that looks fine → also view region crops and score by region.
- `three-gpu-pathtracer` convergence and noise may not be a clean ground truth on skin/eyes → check in C4 before trusting any number.
- Phone and weak-laptop numbers need the dev to run pages on real hardware.
- Bake-time/lightmap size scales with scene size; the bake spike is not proof for large worlds.

## 12. Estimate

Kaggle: ~5 min cold start + ≤1 min per task ≈ 15 min GPU, 10 tasks. Claude C1–C7: several sessions; C3–C6 dominate.
