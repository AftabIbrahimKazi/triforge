# Changelog

All notable changes to `@triforge/scene-doctor-core` are documented here.

## [0.2.0] — 2026-11-17

### Added
- `EditSession.driven()` and `window.__sceneDoctor.driven()`: list properties your own code rewrites (animated values).
- Rules `oversized-texture`, `npot-texture` and `oversized-shadow-map`.

### Changed
- Exported edits now leave out driven properties, so an animated position no longer appears as a slider edit.

## [0.1.0] — 2026-11-17

### Added
- `SceneDoctor`, deduplicated and token-capped `Reporter` (compact, json, md formats, delta mode).
- Scene and renderer rules: non-finite geometry and transforms, zero scale, unloaded textures, shader compile errors, draw-call and triangle budgets, resource leaks, black and flat frames.
- Static source scanner, page collector, `scene-doctor` CLI (`scan`, `strip-check`).
- `EditSession`, `DevPanel`, `buildExport`, optional `askAdapter`.
