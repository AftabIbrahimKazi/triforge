# Changelog

All notable changes to `@triforge/shader-core` are documented here.
Format follows `coding-standards/versioning-standards.md` (RULE V-08).

---

## [0.4.2] — 2026-07-08

### Fixed
- **`Bump({ method: 'uv-offset' })` still broke WebGL2 compilation after the
  0.4.1 hoisting fix.** The 0.4.1 fix hoisted `#extension` lines within
  shader-core's own compiled output, but `OutputNode.compile()` builds a
  plain `THREE.ShaderMaterial`, and three.js's `WebGLProgram.js` always
  injects its own `luminance()`/colorspace prefix block ahead of the
  compiled fragment source — entirely outside `CompileContext`'s control.
  No amount of hoisting inside shader-core's output can place `#extension`
  ahead of that prefix, so the ordering error persisted for any real render.
  Fixed by removing the `#extension GL_EXT_shader_texture_lod : enable` line
  from `Bump.compileDefs()` entirely rather than hoisting it: three.js's
  WebGL2/ESSL3 code path already `#define`s `texture2DLodEXT` to the core
  `textureLod()` built-in, so the extension was dead code in the only target
  three.js actually compiles against (WebGL2) and can simply be omitted. No
  change to `compileCall()` or the sampling math.

---

## [0.4.1] — 2026-07-07

### Fixed
- **`Bump({ method: 'uv-offset' })` shader compile failure on WebGL2** — the
  `#extension GL_EXT_shader_texture_lod : enable` pragma was emitted inline
  in `Bump.compileDefs()`, landing mid-file in the assembled fragment shader
  (after other nodes' uniforms/functions). ESSL3 (WebGL2) requires
  `#extension` directives before any non-preprocessor token, so any graph
  combining `uv-offset` Bump with another defs-emitting node
  (e.g. `PrincipledBSDF`) failed to compile with `VALIDATE_STATUS false`:
  `'#extension GL_EXT_shader_texture_lod : enable' : extension directive must
  occur before any non-preprocessor tokens in ESSL3`.
  Fixed generally at `CompileContext`, not in `Bump`: any node's
  `compileDefs()` output is now scanned for `#extension` lines, which are
  stripped out, deduplicated, and hoisted to the first line of the compiled
  fragment shader (before `precision`) — so any current or future node that
  needs a GLSL extension gets correct placement automatically, no per-node
  opt-in required. `Bump`'s local `#ifndef`-guard workaround for this (added
  in 0.4.0) is no longer needed and was removed; the extension line is now
  emitted plainly and deduplicated centrally instead.
- Investigated whether the extension is even needed on WebGL2: three.js's
  `WebGLProgram` auto-`#define`s `texture2DLodEXT` → `textureLod` when
  running GLSL ES 100-style shader source against a WebGL2 context, making
  the `#extension` pragma inert there (harmless — GLSL treats an unknown
  `: enable` extension as a warning, not an error). `CompileContext.compile()`
  has no renderer/context available at graph-compile time to reliably gate
  the pragma per-target, so hoisting (renderer-agnostic) is the fix rather
  than a WebGL1-only conditional — it's correct under both WebGL1 (where the
  pragma is load-bearing) and WebGL2 (where it's a no-op).

2 new regression tests (91/91 passing, up from 90) — one reproducing the
original ordering bug with a combined `Bump(uv-offset) + PrincipledBSDF`
graph, one confirming multi-instance dedup still holds.

---

## [0.4.0] — 2026-07-07

### Added
- **`TransparentBSDF`** node (Blender's "Transparent BSDF" equivalent) — no
  inputs, always compiles to `vec4(0.0, 0.0, 0.0, 0.0)`. Combine with
  `MixShader`/`AddShader` to build fresnel-fade, rim-light, or cutout-foliage
  materials without a hand-written GLSL terminal node (FINDINGS.md #7).
- Per-component parameter aliases for any vector-typed live uniform parameter:
  `node.parameters['location.x']` (and `.y`/`.z`) now read/write the same
  underlying uniform array as the whole-vector `node.parameters.location`
  getter/setter, in sync in both directions. Implemented once at the shared
  `ShaderNode._wireParameters` layer, so it applies to every current and
  future node with a vector uniform param, not just `Mapping`. Unblocks
  `@triforge/keyframe`'s `KeyframeTrack` animating a single axis (FINDINGS.md #8).
- `Bump` gained a `method: 'derivative' | 'uv-offset'` option (default
  `'derivative'`, unchanged). `'uv-offset'` mode samples an explicit height
  texture (`uniformName`) at `uv ± texelSize` offsets via `texture2DLodEXT`
  at a fixed `lod`, independent of screen-space derivatives — stable across
  camera distance for texture-driven relief. Same `strength * distance * 50.0`
  output scaling as `'derivative'` mode. Resolves the undocumented
  `Bump`/`TextureBump` duplication a consumer had worked around with a
  hand-written node.

No breaking changes — all three additions are opt-in / additive.
12 new regression tests (90/90 passing, up from 78).

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
