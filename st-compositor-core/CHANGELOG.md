# Changelog

All notable changes to `@triforge/compositor-core` are documented here.

## [0.1.4] — 2026-11-17

### Fixed
- SSAO clipping planes handled correctly (test added).
- Optional `postprocessing` import no longer uses `Function()` (banned ecosystem-wide); it now uses a variable-specifier dynamic import.
