# @triforge/context-pool-core — Package Guide

Root CLAUDE.md rules always take precedence. This file adds package-specific notes.

## What This Package Does
Stage 2 of the render-budget feature (see [[render-budget-core]]/CLAUDE.md for Stage 1). Lets any number of logical "canvases" (carousel orbs, thumbnail previews, etc.) share **one** real rendering context instead of each creating its own — the actual fix for a real bug where one `WebGLRenderer` per canvas silently exhausted the browser's WebGL context ceiling on mobile, with the browser force-losing the oldest contexts with zero errors.

The core `ContextPool` class is **engine-agnostic** and has no dependency on Three.js or any other triforge package — it only decides *which* registered clients get to render this frame and *where* (a viewport rect), based on visibility and a context-count budget. `ThreeContextAdapter` (imported from the `./three` subpath, not the package root) is the one Three.js-specific piece: it wraps a single `THREE.WebGLRenderer` and turns the pool's decisions into real `setScissor`/`setViewport`/`render()` calls.

## Internal Structure
- `core/types.ts` — `Rect`, `ContextPoolClient`, `ContextPoolConfig`, `TickResult`
- `core/ContextPool.ts` — the scheduler: visibility check, sticky-active selection, budget enforcement
- `adapters/ThreeContextAdapter.ts` — Three.js glue: shared renderer, scissor/viewport math (including the DOM-to-GL Y-flip), context-loss handling
- `index.ts` — exports the engine-agnostic core only
- A separate `./three` export subpath (`context-pool-core/three` → `dist/adapters/ThreeContextAdapter.js`) keeps the Three.js-specific code out of the main entry point, so a consumer using a different engine never pulls in Three.js-shaped types

## Key Invariants

### `render-budget-core` and this package never import each other
Each package does one job. A consumer wires `RenderBudgetPlan.maxConcurrentContexts` (from `render-budget-core`) into `ContextPoolConfig.maxConcurrent` (or `ThreeContextAdapterConfig.maxConcurrent`) itself — neither package knows the other exists.

### Sticky selection — never re-shuffle who's active without cause
`ContextPool.tick()` keeps a client active across frames as long as it stays visible, even if a new, equal-or-higher-priority client also becomes visible and the budget is full. Only when an active client goes hidden (or the budget grows) does a waiting client take a slot. This exists specifically to prevent visible flicker from re-ordering who renders every single frame — a naive "highest priority visible wins, recomputed from scratch each tick" policy would look broken in practice even though it's logically simpler.

### `Rect` is DOM convention (top-left origin, y-down) everywhere in the core
`ContextPool` never assumes a GL coordinate system. The Y-flip to GL's bottom-left-origin, y-up convention happens exactly once, in `ThreeContextAdapter.renderScissored()`, using the canvas height captured that frame. A raw-WebGL or Babylon adapter would do its own flip (or none, if the engine already uses DOM convention) — that's why the flip isn't in the core.

### The whole canvas is cleared once per frame, not per-client
`ThreeContextAdapter.renderFrame()` disables the scissor test and calls `renderer.clear()` before rendering any active client. Without this, a client that goes from active to hidden/skipped would leave stale pixels in its old viewport rect forever (the shared canvas is never otherwise touched for that region again).

### Context loss on the one shared context is still handled
Even with only one real context instead of N, that one context can still be lost (GPU driver reset, mobile tab backgrounding). `ThreeContextAdapter` listens for `webglcontextlost` (calling `event.preventDefault()`, required by spec to allow eventual restoration) and `webglcontextrestored`, no-opping `renderFrame()` while lost rather than throwing into a dead context.

## Testing
```bash
cd context-pool-core
npm run build   # required: tests import from dist/
npm test
```
20 tests: `ContextPool` visibility/budget/sticky-selection/coordinate-conversion (fake clients, no DOM needed), `ThreeContextAdapter` integration (fake `WebGLRenderer` + a real Node `EventTarget`-based fake canvas for context-loss events).

## What NOT to Do
```ts
// WRONG — never import render-budget-core here, or vice versa
import { initRenderBudget } from '@triforge/render-budget-core' // wrong — wire the number at the call site instead

// WRONG — never bake a GL Y-flip into ContextPool itself
// (core/ContextPool.ts stays DOM-convention-only; flips belong in the adapter)

// WRONG — never create a second WebGLRenderer per registered scene
// (that's the exact bug this package exists to prevent)

// CORRECT
const adapter = new ThreeContextAdapter({ renderer: sharedRenderer, maxConcurrent: plan.maxConcurrentContexts })
adapter.registerScene('orb-1', { scene, camera, anchor: orbElement })
```
