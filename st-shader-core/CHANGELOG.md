# Changelog

All notable changes to `@triforge/shader-core` are documented here.
Format follows `coding-standards/versioning-standards.md` (RULE V-08).

---

## [0.3.0] — 2026-07-07

### Added
- `shader` sockets now carry a vec4 (RGB + alpha) instead of vec3 — alpha flows
  end-to-end from `PrincipledBSDF.alpha` through `AddShader`/`MixShader`/
  `ShaderToRGB` to `MaterialOutput`'s compiled `gl_FragColor`.
- `ShaderNode.wantsTransparency()` — compiled `ShaderMaterial.transparent` is
  now set automatically whenever alpha can read below 1.0 (literal or
  connected). `PrincipledBSDF` overrides this based on its `alpha` input.
- `CompileContext` gained color(vec3)↔shader(vec4) implicit conversions
  (`.rgb` narrowing, `vec4(v, 1.0)` widening), alongside the existing
  vector(vec2) conversions.

### Fixed
- Per-fragment alpha through `MaterialOutput` (FINDINGS.md #1) — the 0.2.0
  changelog entry claimed this was already implemented; that was incorrect.
  The fix only ever reached `MaterialOutput.toPhysicalMaterial()` (the
  path-tracer conversion path); the `compile()` → `ShaderMaterial` path used
  by every real node graph still hardcoded `gl_FragColor = vec4(sv, 1.0)` and
  silently discarded `PrincipledBSDF`'s `alpha` parameter. Now genuinely
  fixed and covered by a reproducer test on the compiled material, not the
  conversion path.
- `ShaderToRGB.Alpha` output now returns the real alpha channel instead of a
  hardcoded `1.0`.

### Changed
- `AddShader` combines alpha as `max(a.a, b.a)`; `MixShader` blends alpha
  along with color via `mix()` on vec4 (matches Blender's Mix Shader).

No public API changes — node constructors, socket names, and method
signatures are unchanged. Default (`alpha` omitted) behavior is unchanged:
fully opaque, `transparent: false`.

---

## [0.2.1] and earlier

Not individually changelogged before this file was introduced. See
`BACKLOG.md` in the monorepo root for the security-audit and FINDINGS.md
follow-up history covering 0.1.1 → 0.2.1.
