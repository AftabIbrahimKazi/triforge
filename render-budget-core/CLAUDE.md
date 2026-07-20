# @triforge/render-budget-core — Package Guide

Root CLAUDE.md rules always take precedence. This file adds package-specific notes.

## What This Package Does
Engine-agnostic device and network profiling, turned into a render-quality "budget": which texture variant to load, how complex a shader graph is safe to compile, and how many simultaneous WebGL contexts are safe to hold. Built in response to a real mobile bug (silent AVIF decode failures, a procedural nebula shader failing to compile under `mediump`, and WebGL context exhaustion from too many simultaneous carousel renderers) — the goal is to make that entire class of bug structurally harder to reintroduce, not just fix the one site that had it.

This package has **no Three.js dependency and no dependency on any other triforge package** — it's pure TypeScript, engine-agnostic by design. Three.js (or any other engine) only enters at the call site, when a consumer checks `plan.shaderComplexity` before choosing which material to build, or hands `plan.maxConcurrentContexts` to something like `context-pool-core` (a separate package).

## Internal Structure
- `core/types.ts` — all public types: `HardwareProfile`, `NetworkProfile`, `RenderBudgetPlan`, the injectable env interfaces (`HardwareProbeEnv`, `NetworkProbeEnv`, `BudgetStorage`)
- `core/DeviceProfiler.ts` — `profileHardware()`/`profileNetwork()` (the actual probing logic) + `createBrowserHardwareEnv()`/`createBrowserNetworkEnv()` (the only place this package touches real browser globals)
- `core/BudgetPlanner.ts` — `planBudget()`: pure decision function, no I/O, implements the full precedence order
- `core/RenderBudgetSystem.ts` — `init()`: the orchestrator (caching, override precedence, evaluation order)

## Key Invariants

### Everything browser-facing is behind an injectable env
`HardwareProbeEnv` and `NetworkProbeEnv` are the only seams into real globals (`document`, `Image`, `navigator.connection`, `fetch`). `profileHardware()`/`profileNetwork()` never touch a global directly — they only call methods on the env passed in. This is what makes the probing logic testable at all (real GPU/network state can't be simulated in a test runner) and is a **hard requirement for any future change to this file** — don't reach for a global from inside the probe functions themselves.

### The context-count probe and the texture-size read happen in the same pass
`probeContextsAndTextureSize()` reads `MAX_TEXTURE_SIZE` from the *first* context created while probing the context ceiling, rather than creating a separate context afterward. A real `WEBGL_lose_context` release is asynchronous — a second `createWebGLContext()` call right after exhausting the probed ceiling isn't guaranteed to succeed. (This was a real bug caught by the test suite during initial development, not a hypothetical.)

### Precedence order (see BudgetPlanner.planBudget)
1. Manual override (user or capped dev override) wins outright.
2. `saveData === true` forces the most conservative **texture tier only** — shader complexity and context budget are hardware-only concerns, bandwidth has no bearing on whether a device can safely compile a shader or hold N contexts.
3. Otherwise, texture tier = `min(hardwareTier, networkTier)` — neither categorically outranks the other.

### Dev override can only make things worse, never better
`allowDevOverride` (via `?forceQuality=`) is capped so it can only force a *lower* tier than what auto-detection found — this exists purely so a developer can exercise every tier's code path without needing matching physical hardware, not so a real visitor could force a tier their device can't actually handle and file an unreproducible bug report.

### Hardware profile is cached; network profile never is
Hardware (context ceiling, texture size, AVIF/WebP support) doesn't change between visits — cached in `localStorage` under a versioned key (`HARDWARE_CACHE_VERSION`); bump that constant if the probing logic changes in a way that invalidates old cached values. Network conditions change constantly, even mid-session on mobile — never cached, re-probed on every `init()` call.

## Adding a New Probe or Tier Input
1. Add the field to `HardwareProfile` or `NetworkProfile` in `types.ts`.
2. Add the actual probing logic to `profileHardware()`/`profileNetwork()`, behind the existing env interfaces (extend the env interface if a new browser API is needed).
3. Add the real-browser implementation to `createBrowserHardwareEnv()`/`createBrowserNetworkEnv()`.
4. Wire the new field into `planBudget()`'s tier logic if it affects a decision.
5. Add fake-env tests for: the new probe's happy path, its failure path (must degrade to a safe fallback, never throw), and how it changes `planBudget()`'s output.

## Testing
```bash
cd render-budget-core
npm run build   # required: tests import from dist/
npm test
```
25 tests: hardware/network profiling (happy path + fallback + rejection handling), `planBudget()` precedence (all combinations from the design's precedence order), and `initRenderBudget()` integration (caching, user override, dev override capping).

## What NOT to Do
```ts
// WRONG — never touch a global directly inside a probe function
function profileHardware() {
  const canvas = document.createElement('canvas') // breaks testability
}

// CORRECT — go through the injected env
function profileHardware(env: HardwareProbeEnv) {
  const gl = env.createWebGLContext()
}

// WRONG — never import three or any other triforge package here
import * as THREE from 'three' // this package is engine-agnostic by design

// WRONG — never let a dev override beat the auto-detected floor
if (allowDevOverride) return { ...override } // must cap to min(override, auto)
```
