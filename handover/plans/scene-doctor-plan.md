# scene-doctor-core plan

Package: `@triforge/scene-doctor-core`, Infra section (no st- prefix, like render-budget-core / context-pool-core). Engine-agnostic core, `/three` subpath adapter, optional three peer dep. Imports no other triforge package.

## Modules
- core/Finding, Rule registry, Reporter. Pure data, no Three.js.
- rules/runtime: NaN/Inf, zero scale, off-frustum, black frame, shader errors, missing textures, leaks, budgets, silent issues.
- rules/static: source scanner (any/eval/GLSL loops/dispose/loop allocs/ecosystem rules). Node CLI under /node subpath.
- runner: Playwright headless (playwright-core optional peer) collects console/page errors per example.
- panel: dev overlay, sliders from every `parameters` object, edits as {path,from,to}, `window.__sceneDoctor`.
- adapters: `AiAdapter` interface (local model / Kaggle), no default. Never required.

## Token-efficiency contract
- Findings dedupe by fingerprint: rule+object path+cause, count instead of repeats.
- Rank by severity. Hard cap `maxTokens`, estimated by chars/4. Overflow becomes one summary line.
- Delta mode: report only findings new or changed since the last export.
- Formats: `compact` (default, short keys), `json`, `md`. Same data.
- Snapshots trimmed to objects with findings or edits.

## Dev-only
Activates via `?doctor=1` or explicit `SceneDoctor.attach()`. `scene-doctor strip-check <dir>` fails if its marker string is in build output.

## Steps
a probe + Finding schema + reporter
b runtime rules, static scanner, headless runner
c panel + export + delta
d strip-check, AI adapter interface, example, tests, bench, docs
