# Ecosystem Backlog

Features deferred due to dependencies, complexity, or being out of current scope.
This is a living document — update it as features are added or priorities change.

---

## Packages To Build

| Package | Description | Status |
|---|---|---|
| ~~`st-modifier-core`~~ | Blender-matched modifier stack | **Done** |
| ~~`OceanModifier` + `OceanAttribute`~~ | Gerstner wave ocean with foam attribute + shader node | **Done** |
| ~~`st-particle-core`~~ | Blender-matched particle system — all phases | **Done** — see breakdown below |
| ~~`st-volume-core`~~ | Ray-marched volumetric media — fog, smoke, fire | **Done** — `VolumeBox` with full GLSL ray march |
| ~~`st-geometry-nodes`~~ | Grid, UVSphere, IcoSphere, Cylinder, Cone, Cube, Circle, BoundingBox, ConvexHull, ExtrudeMesh, RealizeInstances, CurveToMesh, ResampleCurve, SetCurveRadius — 44 tests | **Done** |
| ~~`st-keyframe`~~ | KeyframeTrack, AnimationClip, AnimationMixer, buildClip, 30 easings, QuaternionTrack (SLERP) — 49 tests | **Done** |
| ~~`st-animation-core`~~ | ShapeKeyMesh, Armature (FK + 2-bone IK), SkinBinding, NLATrack, NLAEditor, ExpressionDriver — 45 tests | **Done** |
| ~~`st-curve-core`~~ | BezierCurve, NURBSCurve, CatmullRomCurve, CurveTube, CurveBevel, PathFollow, RMF frames, handle modes (aligned/vector/free), bevelFactor — 66 tests | **Done** |
| ~~`st-physics-core`~~ | ClothSimulator (self-collision + pressure), SoftBodySimulator, RigidBodyWorld + constraints — 49 tests | **Done** |
| ~~`st-compositor-core`~~ | 28 passes: Bloom, DepthOfField, GaussianBlur, GlareStreaks, MotionBlur, RenderLayers, LensFlare, EdgeDetect, LUT + more — 82 tests | **Done** |
| ~~`st-hair-core`~~ | HairSystem (tube/ribbon/line), StrandGenerator, KinkModifier, ClumpModifier, HairDynamics (Verlet + constraints + collision) — 51 tests | **Done** |
| ~~`st-uv-core`~~ | 6 unwrappers + PackIslands + true vertex-splitting seam cuts (LSCM + ABF) — 57 tests | **Done** |
| ~~`st-fluid-core`~~ | Full FLIP fluid + SPH | **Done** — `FLIPSimulator` (FLIP + PCG pressure solve), `SPHSimulator`, `MarchingCubes`, `FluidEmitter` |
| ~~`st-pathtracer-core`~~ | Raster ↔ path-tracer toggle | **Done** — `RenderManager` (mode toggle + camera-reset), `PathTracerRenderer` (wraps `three-gpu-pathtracer`); `MaterialOutput.toPhysicalMaterial()` bridges shader nodes to path tracer |
| ~~`st-metaball-core`~~ | Organic iso-surface from scalar field blobs | **Done** — `MetaballWorld` + `MetaballObject`, wraps Three.js `MarchingCubes`, negative balls, live `update()` |
| ~~`st-core-types`~~ | Shared TypeScript interfaces | **Done** — 16 interfaces: IAnimatable, IModifier, IGeometryProvider, ICurve, IStrand, IEmitter, IForce, IParticleLike, IParticlePool, IRenderer, IKeyframeTarget, IShaderNode, IOutputNode, ICollider, IConstraint, IRigidBody, IPoseBone |

---

## `st-particle-core` — Full Blender Particle System Inventory

### Phase 1 — Core simulation ✓

#### Emission panel ✓
| Feature | Status |
|---|---|
| Total count, seed, start/end time, lifetime + randomness | **Done** |
| Emit from verts / faces / volume, even distribution, random order | **Done** |
| ~~Respect modifier stack geometry~~ | **Done** — `setGeometryProvider(() => BufferGeometry)` callback on `ParticleSystem`; called once per `update()`. No cross-package import — user wires `() => stack.apply()`. |

#### Velocity / Rotation panels ✓
All velocity and rotation features done.

#### Physics — Newtonian panel ✓
All Newtonian physics features done.

#### Render panel ✓
| Renderer | Status |
|---|---|
| `NoneRenderer` (invisible) | **Done** |
| `BillboardRenderer` / `HaloRenderer` | **Done** |
| `LineRenderer` | **Done** |
| `ObjectRenderer` / `InstanceRenderer` | **Done** |
| `CollectionRenderer` | **Done** |
| `StrandRenderer` (line/tube, density threshold) | **Done** |

#### Display panel
| Feature | Status |
|---|---|
| `displayAmount` (% in viewport) | **Done** |
| Colour by velocity / age (`colourMode`) | **Done** |
| Show/hide emitter mesh | **Done** — `ParticleSystem.showEmitter(mesh, visible)` |
| ~~Viewport display size~~ | **Done** — `displayAmount` [0–1] on `StrandRenderer.parameters`; culls strands without affecting simulation |

---

### Phase 2 — Force fields ✓

All force types done: `ForceField`, `WindForce`, `VortexForce`, `MagneticForce`, `HarmonicForce`,
`ChargeForce`, `LennardJonesForce`, `TextureForce`, `TurbulenceForce`, `DragForce`,
`CurveGuideForce`, `FlowFieldForce`.

| Field | Status |
|---|---|
| ~~`FlowField` (follow fluid sim)~~ | **Done** — `velocityFn` callback on `FlowFieldForce` connects to any fluid sim |
| ~~`BoidField` (boid rule effector)~~ | **Done** — `BoidField` force in `st-particle-core`; repel/attract radius + strength; pass `otherSystem.pool` as source |

---

### Phase 3 — Source / Children / Cache ✓

| Feature | Status |
|---|---|
| Vertex group → density, size | **Done** |
| Vertex group → strand length / clump / roughness | **Done** — `lengthAttribute`, `clumpAttribute`, `roughnessAttribute` in `StrandRenderer` |
| Texture → emission density | **Done** |
| Children (simple / interpolated), childCount, childSpread | **Done** |
| Bake / cache | **Done** |

---

### Phase 4 — Boids ✓

All boid rules done: separation, alignment, cohesion, obstacle avoidance, leader following,
flight/ground modes, collision stiffness, banking, pitch.

---

### Phase 5 — Keyed physics ✓

`KeyedPhysics` blends positions/velocities between target pools. Timing via `st-keyframe AnimationMixer`.

---

### Phase 6 — SPH fluid particles

| Feature | Status |
|---|---|
| `SPHPhysics` (Müller 2003 — Poly6 + Spiky + Viscosity) | **Done** — self-contained, no st-fluid-core needed |
| ~~Linear viscosity / Stiff viscosity~~ | **Done** — `viscosityType: 'xsph' \| 'stiff'` on `SPHSimulator` |

---

### Phase 7 — Hair / strand render ✓

| Feature | Status |
|---|---|
| `StrandRenderer` line/tube modes, strandCurve callback | **Done** |
| Strand thickness / taper | **Done** |
| Kink amplitude / frequency | **Done** |
| Density threshold (vertex-weight culling) | **Done** |
| ~~Roughness / curl / tangent shading~~ | **Done** — `tangentFn` callback bakes `strandTangent` attribute into tube geometry; `displayAmount` parameter for viewport culling |

---

## `st-shader-core` — Node Library ✓

**75 nodes total.** All surface nodes complete.

### Volume nodes ✓
`VolumeAbsorption`, `VolumeScatter`, `PrincipledVolume` — output to `MaterialOutput.volume`.

### Animatable color uniforms ✓
Unconnected `color` inputs are exposed as `uniform vec3` — live-animatable via
`node.parameters.colorName = [r, g, b]` after `compile()`.

### New nodes added
| Node | Status |
|---|---|
| ~~`Attribute`~~ | **Done** — reads named per-vertex float/vec3 attribute; sanitized varying name; Fac + Vector outputs |
| ~~`AmbientOcclusion`~~ | **Done** — hemisphere SSAO in fragment shader; bounded 16-sample kernel; Color + AO outputs |
| ~~`LightPath`~~ | **Done** — rasterizer-mode constants (Is Camera Ray=1, all others=0); documented; path-tracer injection deferred until three-gpu-pathtracer exposes ray-state uniforms |
| ~~`RayPortal`~~ | **Done** — passthrough in rasterizer (emits input Color); path-tracer-only note in JSDoc |

---

## `st-modifier-core` — Modifier Stack ✓

All modifiers done. New additions:
- ~~`BevelModifier`~~ — **Done** — position-welded edge detection, chamfer bevel, segments 1–4
- ~~`WireframeModifier`~~ — **Done** — per-edge tube geometry, configurable sides and thickness
- ~~`ShrinkwrapModifier`~~ — **Done** — brute-force closest-triangle projection with offset + blend factor

---

## `st-animation-core` — Animation System ✓

Shape keys, armature (FK + IK), NLA, `ExpressionDriver` — all done. New additions:
- ~~`TrackToConstraint`~~ — **Done** — PoseBone points axis toward target world position; influence blend
- ~~`CopyRotationConstraint`~~ — **Done** — copies source bone world rotation; replace/add mix; invert
- ~~`CopyLocationConstraint`~~ — **Done** — copies source bone world position; axis masking; offset mode

---

## `st-physics-core` — Physics Simulations ✓

| Phase | Status |
|---|---|
| Cloth (structural + bend springs, self-collision, pressure, wind, pin groups, colliders) | **Done** |
| Soft body (Verlet + edge springs, volume pressure, shape match, colliders) | **Done** |
| Rigid body (sphere/box/capsule, FixedConstraint, HingeConstraint, SliderConstraint, SpringConstraint) | **Done** |
| ~~BallSocketConstraint~~ | **Done** — free rotation, position-only lock at pivot |
| ~~ConeTwistConstraint~~ | **Done** — swing (cone) + twist limits around axis; Verlet position + angular velocity correction |

---

## `st-compositor-core` — Post-processing ✓

28 passes — all done. Full list:
Bloom · Blur · GaussianBlur · DepthOfField · ChromaticAberration · Vignette · FilmGrain ·
ColorBalance · HueSaturation · BrightnessContrast · Gamma · Exposure · Sharpen · Pixelate ·
Mix · AlphaOver · ZCombine · SetAlpha · SeparateRGBA · CombineRGBA · SSAO · SSR ·
GlareStreaks · MotionBlur · RenderLayers · LensFlare · EdgeDetect · LUT

---

## `st-geometry-nodes` — Geometry Nodes ✓

All nodes done. New additions:
- ~~`Switch`~~ — **Done** — selects between two geometry inputs by boolean/number parameter
- ~~`Index`~~ — **Done** — FloatField outputting element index (raw or normalized 0–1)
- ~~`AlignRotationToVector`~~ — **Done** — writes per-point Euler rotation attribute aligning instance axis to vector field

Full list: Grid · UVSphere · IcoSphere · Cylinder · Cone · Cube · Circle ·
TransformGeometry · JoinGeometry · SetPosition · SubdivisionSurface · MergeByDistance ·
FlipFaces · BoundingBox · ConvexHull · ExtrudeMesh ·
DistributePointsOnFaces · InstanceOnPoints · RealizeInstances ·
CurveToMesh · ResampleCurve · SetCurveRadius ·
Switch · Index · AlignRotationToVector

---

## Security Audit — Core Packages (2026-07-04)

Audit of the 17 core packages for the rules in root `CLAUDE.md` "Security Rules".
Three real issues found and **fixed** (with regression tests); FINDINGS.md
(shader-core feature gaps from the Planetarium project) remains open separately.

| Issue | Package | Status |
|---|---|---|
| `ExpressionDriver` used `new Function()` on driver strings — arbitrary code execution (the docstring's "global scope not accessible" claim was false; variable *keys* were a second injection point). Became critical the moment scene-file/`.blend` import feeds untrusted driver expressions. | `st-animation-core` | **Fixed** — replaced with `SafeExpression` (self-contained recursive-descent math parser, whitelisted Math fns/consts + declared vars only; arbitrary JS is a compile error → driver goes inert). Public API and expression syntax unchanged; more Blender-faithful (Blender sandboxes scripted-expression drivers too). 4 security regression tests added. |
| GLSL injection via `Attribute` node name — sanitized the varying name but forwarded the raw `attributeName`, interpolated verbatim as `attribute <t> <name>;`. | `st-shader-core` | **Fixed** — added `assertGlslIdentifier` (exported), validated at the single `CompileContext` emit chokepoint (covers all current + future `vertexInjections()` implementors) plus construction-time in `Attribute`. Other injectors (`ColorAttribute`/`OceanAttribute`/`HairInfo`/`ParticleInfo`/`PrincipledHair`) use hardcoded literal names — already safe. |
| Uncapped GLSL loop bounds — `MotionBlur.samples`, `LensFlare.ghosts`, `GlareStreaks.length`/`streaks` baked into `for` bounds clamped from below only; `NaN` → un-compilable shader, `1e6` → GPU hang. | `st-compositor-core` | **Fixed** — added `glslLoopBound()`; capped to documented compile-time maxima (64/32/128/16). 4 security regression tests via a fragment-shader-capturing mock. |

**Documented exception:** `st-compositor-core`'s pmndrs-backend `Function()` guard
(from the 0.1.1 bundler fix) is a deliberate, sanctioned use — it wraps a
bundler-defeating dynamic import, not user input. Left as-is; noting it here so
future audits don't re-flag it.

**Not yet deep-audited:** fluid/physics/uv/curve/geometry-nodes internals only
got a surface pass (grep for `eval`/`Function`/uncapped loops — all clean). A
fuller review of those is still open.

### Follow-up (2026-07-06) — GLSL injection via texture `uniformName`

FINDINGS.md (Planetarium project) flagged that the `Attribute` fix above missed
a same-class sibling: `ImageTexture` and `EnvironmentTexture` interpolated their
required `uniformName` option verbatim into shader source (`uniform sampler2D
${uniformName};` / `uniform samplerCube ${uniformName};`) with no validation —
a hostile `uniformName` could inject arbitrary GLSL. **Fixed** — both now call
`assertGlslIdentifier` at construction, mirroring the `Attribute` fix. 4 new
security regression tests added to `st-shader-core/test/run-tests.js` (62/62
passing). Only exploitable if an app passes untrusted input as `uniformName`;
all current consumers use hardcoded literals.

### Follow-up (2026-07-07) — FINDINGS.md feature gaps #2, #3, #4 (shader-core 0.2.0)

FINDINGS.md (Planetarium project) also documented feature gaps beyond the
security items above; #1 (alpha through `MaterialOutput`) and #5 (ambient
lighting on `PrincipledBSDF`) turned out to already be implemented in the
monorepo, just undocumented. The remaining open items are now closed:

- **#2 vector/color socket incompatibility** — `CompileContext` now implicitly
  converts `color`/`shader` (vec3) ↔ `vector` (vec2) at connection points
  (`.xy` narrowing, `vec3(v, 0.0)` widening). `ImageTexture.compileCall` routed
  through `resolveInput` so the conversion actually applies (it previously
  called `ctx.outputVar` directly, bypassing type coercion). `Mapping`'s
  `location`/`rotation`/`scale` were converted from baked constructor literals
  to live `color`-typed uniform inputs, exposed on `node.parameters` per the
  root CLAUDE.md parameters rule — the canonical `TextureCoordinate → Mapping →
  ImageTexture` UV-panning graph now compiles and is animatable.
- **#3 generic script escape hatch** — found that `ShaderScript` already existed
  in the monorepo (predates this finding, wasn't cross-referenced), matching
  the proposed `GlslScript` design. Its input/output socket names were
  interpolated into GLSL as local-variable names with no validation; added
  `assertGlslIdentifier` there, same pattern as the `Attribute`/`ImageTexture`
  fixes above.
- **#4 tangent-space normal mapping** — `NormalMap` was a duplicate of `Bump`'s
  height-gradient technique under a Blender-mismatched name. Rewrote it as a
  true tangent-space texture decoder: RGB → vector, derivative-based cotangent
  frame (Schüler method, reusing the no-vertex-tangent-attribute fallback this
  finding suggested), `normalize(TBN * n)`. No other code in the monorepo
  referenced the old `fac`-based signature, so this was a clean break.

6 new regression tests added to `st-shader-core/test/run-tests.js` (68/68
passing). Version bumped to 0.2.0 (feature-level, not a patch) per the
FINDINGS.md release checklist.

### Follow-up (2026-07-07) — root CLAUDE.md Security Rule gap in the 0.2.0 work above

The 0.2.0 change above added new numeric inputs (`Mapping.location/rotation/scale`,
`NormalMap.strength`) without following the root CLAUDE.md Security Rule "ALWAYS
validate numeric parameters are finite numbers before use in GLSL uniforms" —
existing precedent for this guard already existed in `AmbientOcclusion.ts`/
`RayPortal.ts` (`Number.isFinite(...)`) but wasn't applied here. **Fixed** — added
`finiteOr()`/`sanitizeVec3()` at the actual uniform-seeding chokepoints:
`ShaderNode.createInputs` (initial `parameters` population), `ShaderNode.
_wireParameters` (live GSAP-style setter path), and `CompileContext.resolveInput`/
`toLiteral` (the point a socket's `defaultValue` first seeds a GPU uniform or a
baked GLSL literal — this was the actual gap; sanitizing `parameters` alone
wasn't enough since `resolveInput` reads `socket.defaultValue` directly). A
`NaN`/`Infinity` input now becomes `0` instead of leaking `"NaN"`/`"Infinity"`
into shader source or a GPU uniform. 3 new security regression tests (71/71
passing).

### Follow-up (2026-07-07) — correction: FINDINGS.md #1 (alpha) was NOT actually fixed — now properly fixed

The 0.2.0 follow-up above claimed finding #1 (per-fragment alpha through
`MaterialOutput`) "turned out to already be implemented" — **that was wrong.**
Re-verification against the published 0.2.1 package found the fix only ever
landed on `MaterialOutput.toPhysicalMaterial()` (the `MeshPhysicalMaterial`
conversion path, reading BSDF constructor literals directly), which node
graphs never touch. The actual `compile()` → `THREE.ShaderMaterial` path —
the one every real graph uses — still hardcoded `gl_FragColor = vec4(sv,
1.0)`, and `_st_principledBSDF`'s `alpha` parameter was accepted but never
referenced in the function body. The socket, the uniform, and the parameter
all existed; the value went nowhere. Repo-fixed ≠ shipped struck twice —
first with finding #6's npm-publish gap, now with a fix that was never
actually wired to the code path it claimed to fix.

**Properly fixed now:** `shader` sockets widened from vec3 to **vec4**
(`SOCKET_GLSL_TYPE.shader`, `st-shader-core/src/core/SocketType.ts`) so alpha
has an actual channel to travel through end-to-end:

- `CompileContext.resolveInput`/`typesCompatible`/`toLiteral` — added
  color(vec3)↔shader(vec4) conversions (`.rgb` narrow, `vec4(v, 1.0)` widen)
  alongside the existing vector(vec2) conversions.
- `PrincipledBSDF` — the lighting function keeps its vec3 signature (alpha
  dropped from the function params, it never used it); `compileCall` now
  assembles `vec4(rgb, alpha)` at the call site.
- Every other shader-producing node (`DiffuseBSDF`, `GlossyBSDF`, `GlassBSDF`,
  `RefractionBSDF`, `SheenBSDF`, `SpecularBSDF`, `SubsurfaceScattering`,
  `ToonBSDF`, `TranslucentBSDF`, `Emission`, `PrincipledHair`,
  `VolumeAbsorption`, `VolumeScatter`, `PrincipledVolume`, `RayPortal`) wraps
  its existing vec3 result as `vec4(..., 1.0)` at the call site — no GLSL
  function bodies touched.
- `AddShader`/`MixShader` now operate on vec4 directly — `AddShader` takes
  `max(a.a, b.a)`, `MixShader`'s `mix()` blends alpha along with color for
  free (matches Blender's Mix Shader alpha behaviour).
- `ShaderToRGB` now extracts the real `.a` instead of hardcoding `Alpha = 1.0`.
- `ShaderScript`'s `'shader'` socket type now maps to `vec4` in its
  type-mapping helpers.
- `MaterialOutput.compileCall` emits `gl_FragColor = ${sv};` directly (`sv` is
  already vec4) instead of re-wrapping with a hardcoded `1.0`.
- **`transparent` is now actually set on the compiled material.** Added
  `ShaderNode.wantsTransparency()` (default `false`), overridden on
  `PrincipledBSDF` to return `true` when `alpha` is connected (dynamic) or a
  literal `< 1.0`. `CompileContext.compile()` ORs this across every node in
  the graph into `CompiledMaterial.needsTransparency`; `OutputNode.compile()`
  passes it as `ShaderMaterial({ transparent: ... })`.

Acceptance test (the actual reproducer from FINDINGS.md, run against the
*compiled* `ShaderMaterial`, not the conversion path):
`new PrincipledBSDF({ alpha: 0.5 })` → `mat.material.transparent === true`
and the shader source no longer ends in a hardcoded `, 1.0)`. Default
(alpha omitted) stays `transparent: false` — existing scenes don't repaint.
7 new regression tests added to `st-shader-core/test/run-tests.js` (78/78
passing, up from 71). All existing tests (including the 0.2.0 vector/socket
and NormalMap tests) still pass unmodified — the vec3→vec4 widening is
backward-compatible at the public API/socket level.

`toPhysicalMaterial()` (the path-tracer bridge) is untouched — it was already
correct for what it does and remains a separate, valid code path.

### Follow-up (2026-07-07) — FINDINGS.md #7, #8, and the undocumented Bump/TextureBump split (shader-core 0.4.0)

Three more gaps reported from the Planetarium project, all general-purpose
library fixes (not consumer-specific):

- **#7 generalized alpha for emission-only graphs** — `Emission.compileCall`
  hardcoded `vec4(color, 1.0)`; only `PrincipledBSDF` had a real alpha input.
  Added **`TransparentBSDF`** (Blender's actual mechanism: no inputs, always
  `vec4(0.0, 0.0, 0.0, 0.0)` — fully transparent, colorless).
  `ShaderNode.wantsTransparency()` returns `true` unconditionally for it (it's
  a constant, not a dynamic value). Verified `MixShader(fac, TransparentBSDF,
  Emission)` alpha-blends correctly through the existing vec4 `mix()` from the
  earlier alpha-widening work — `fac=0` → fully transparent, `fac=1` → fully
  opaque emission, no bug found, already worked. This lets any fresnel-fade /
  rim-light / cutout-foliage graph express alpha without a hand-written
  terminal node.
- **#8 per-component parameter aliases** — `node.parameters.location = [x,y,z]`
  only supported whole-array assignment; `@triforge/keyframe`'s
  `KeyframeTrack(target, property, keyframes)` can only animate a single
  scalar property, so per-axis animation (e.g. texture panning on just the
  x-axis) had no library path. Generalized at the shared parameter-proxy
  layer (`ShaderNode._wireParameters`, not per-node): every vector-typed live
  uniform parameter now also exposes flattened `'name.x'`/`'name.y'`/`'name.z'`
  getters/setters reading/writing the same underlying uniform array as the
  whole-vector accessor, so both stay in sync. Applies to any current or
  future node with a vector uniform param (`Mapping.location/rotation/scale`,
  `PrincipledBSDF.baseColor`, etc.) — not special-cased to `Mapping`.
- **Undocumented Bump/TextureBump duplication** — the stock `Bump` node's
  `dFdx`/`dFdy` height gradient is screen-space/rasterization-dependent,
  causing speckle at minification and texel-seam flicker at magnification for
  texture-driven relief across a wide camera-distance range. A consumer wrote
  a whole separate `TextureBump` node sampling at explicit `uv ± texelSize`
  offsets at a fixed LOD instead. Rather than two node classes, added a
  `method: 'derivative' | 'uv-offset'` option to `Bump` (default
  `'derivative'`, unchanged). `'uv-offset'` mode samples via
  `texture2DLodEXT` (with the `GL_EXT_shader_texture_lod` extension enabled)
  at `uv ± vec2(texelSize, 0)` / `uv ± vec2(0, texelSize)`, builds the
  tangent/bitangent frame from `dFdx`/`dFdy` of `vPosition`/`vUv` (that's
  building the tangent basis, not sampling the height — no stability problem
  there, same cotangent approach `NormalMap` already uses), and keeps the same
  `strength * distance * 50.0` output scaling as derivative mode so swapping
  `method` doesn't require retuning constants. `Bump.instanceSpecificDef`
  flipped to `true` so multiple `'uv-offset'` instances each get their own
  `uniformName` declaration instead of being deduped by node type; the shared
  `'derivative'` function is now `#ifndef`-guarded so it stays safe to emit
  per-instance too.

12 new regression tests added to `st-shader-core/test/run-tests.js` (90/90
passing, up from 78). `assertGlslIdentifier` applied to `Bump`'s new
`uniformName`, matching the `Attribute`/`ImageTexture`/`EnvironmentTexture`
security precedent. No public API changes to existing nodes — `TransparentBSDF`
is additive, `Bump`'s new fields are optional and default to prior behavior.

Consumer follow-up (not done here, downstream repo's responsibility once
upgraded): the planetarium project can retire its hand-written `RgbaOutput`,
`UvPan`, and `TextureBump` custom nodes in favor of `TransparentBSDF`/
`MixShader`, the `'name.x'` parameter aliases, and `Bump({ method: 'uv-offset' })`
respectively.

### Follow-up (2026-07-07) — same-day bug: uv-offset Bump's #extension broke WebGL2 compiles (shader-core 0.4.1)

Caught immediately by the same consumer trying to use `Bump({ method:
'uv-offset' })` on WebGL2: the `#extension GL_EXT_shader_texture_lod :
enable` pragma added in 0.4.0 was written inline in `Bump.compileDefs()`,
which lands wherever `CompileContext` happens to assemble that node's defs
in the final fragment shader — after other nodes' uniform/function defs in
any graph where another node (e.g. `PrincipledBSDF`) also has `compileDefs()`
output. ESSL3 (WebGL2) requires `#extension` before any non-preprocessor
token; mid-file placement throws `VALIDATE_STATUS false` — confirmed via
actual shader compile failure.

**Fixed generally, not in `Bump`:** `CompileContext` now scans every node's
`compileDefs()` output for `#extension` lines, strips them, deduplicates,
and hoists them to the first line of the compiled fragment shader (before
`precision`) — `_extractExtensions()` at the `emitDefs` chokepoint,
prepended in `buildFragmentShader()`. Any current or future node that needs
a GLSL extension gets correct placement automatically; no per-node opt-in.
`Bump`'s local `#ifndef`-guard (0.4.0's dedup workaround) was removed —
central dedup makes it redundant.

**Investigated whether the pragma is needed on WebGL2 at all** (per the
report's suggestion to gate it behind a WebGL1-only check instead of
hoisting): three.js's `WebGLProgram` auto-`#define`s `texture2DLodEXT` →
`textureLod` when running GLSL ES 100-style source against a WebGL2 context,
so the extension pragma is inert there — GLSL treats an unrecognized
`: enable` extension as a warning, not a hard error. But `CompileContext.
compile()` has no renderer/context reference at graph-compile time to
reliably detect WebGL1 vs. WebGL2 and gate the pragma per-target — hoisting
is the renderer-agnostic fix and is correct under both (load-bearing on
WebGL1, harmless no-op on WebGL2), so that's what shipped instead of a
runtime gate.

2 new regression tests (91/91 passing, up from 90): one reproduces the
original ordering bug with a combined `Bump(uv-offset) + PrincipledBSDF`
graph and asserts `#extension` is the first non-empty line; one extends the
existing multi-instance test to assert the extension appears exactly once
(not once per `uv-offset` `Bump` instance). Published as 0.4.1.

### Follow-up (2026-07-08) — 0.4.1's hoist fix wasn't enough: real render still broke (shader-core 0.4.2)

0.4.1's hoist only reorders `#extension` lines *within* shader-core's own
compiled output. It can't reach far enough: `OutputNode.compile()` always
builds a plain `THREE.ShaderMaterial` (not `RawShaderMaterial`), and
three.js's `WebGLProgram.js` unconditionally injects its own
`luminance()`/colorspace prefix block ahead of wherever the compiled
`fragmentShader` string gets appended — assembled entirely outside
`CompileContext`'s control. So the hoisted `#extension` line still landed
after non-preprocessor content once three.js's own prefix was in play,
confirmed via an actual WebGL2 render (a static source-level check of
`result.fragmentShader` alone wouldn't have caught this — it only
manifests once three.js's prefix injection runs).

**Fixed by deleting the `#extension` line from `Bump.compileDefs()`
entirely** instead of trying to hoist it further: three.js's WebGL2/ESSL3
code path already `#define`s `texture2DLodEXT` → the core `textureLod()`
built-in, so `GL_EXT_shader_texture_lod` was dead code in the only target
three.js actually compiles against. `GL_EXT_shader_texture_lod` only ever
mattered on WebGL1, which three.js hasn't defaulted to in several major
versions. No change to `compileCall()` — the sampling math is untouched.

3 previously-passing tests updated to assert the extension is *never*
emitted (rather than hoisted-and-deduplicated); all 91 tests pass.
Published as 0.4.2.

---

## Ecosystem-Wide — Remaining

| Feature | Status |
|---|---|
| ~~`st-fluid-core`~~ | **Done** — FLIP solver with PCG pressure projection via `conjugate-gradient` (MIT) |
| ~~`st-pathtracer-core`~~ | **Done** — `RenderManager` toggle + `MaterialOutput.toPhysicalMaterial()` bridge |
| ~~`RayPortal` / `LightPath` nodes~~ | **Done** — `LightPath` outputs real `uniform float` values driven by `LightPathController` (multi-pass: camera/shadow/diffuse/glossy/reflection/transmission). `RayPortal` passthrough in raster mode. Both compile to valid GLSL in all modes. `LightPathController` integrated into `RenderManager.lightPath`. |
| Node graph editor UI | Out of scope — runtime library, not a visual editor |
| Grease Pencil | Out of scope — Three.js `Line2` covers flat drawing |
| ~~Metaballs~~ | **Done** — `st-metaball-core` with `MetaballWorld` + `MetaballObject`, negative balls, live `update()` |
| Sculpting tools | Out of scope — interactive tool system |
| ~~`BooleanModifier`~~ | **Done** — `three-bvh-csg` peer dep; union / difference / intersection |

---

## Addons (Local Only — `addons/`)

| Addon | Status |
|---|---|
| `addons/st-addon-cellfracture` | **Done** — 29/29 tests. Known limitation: interior cap faces approximate (plane-clipped, not true boolean) on highly concave source meshes. |
| `addons/st-addon-weather` | **Done** (2026-07-03) — 102/102 tests, all 26 build-order steps complete. See `addons/st-addon-weather/TUTORIAL.md`. |
| `addons/st-addon-terrain` | **Done, Stage 1 of 5** (2026-07-03) — 59/59 tests, chunked/streaming/LOD land shape complete, cross-LOD seams fixed via edge-clamping (not just skirts) after live browser testing surfaced visible cracks. See `addons/st-addon-terrain/TUTORIAL.md`. Stages 2-4 (`addon-trees`/`addon-rocks`/`addon-vegetation`) and Stage 5 (integration) not started. |
| `addons/st-addon-trees` | **Done, Stage 2 of 5** (2026-07-04) — 27/27 tests, `TreeGenerator` (recursive branching, presets, deterministic, no NaN at parameter extremes), `TreePlacement` (slope/altitude/moisture rules + multiplicative manual density mask), `TreeScatter` (InstancedMesh + distance LOD/impostor swap, zero-cost dispose proven in bench), `TreeWindMaterial` (built-in vertex sway + optional `IWindProvider`), opt-in `GeometryNodesBridge`/`ParticleCoreBridge` stubs. See `addons/st-addon-trees/TUTORIAL.md`. Stages 3-4 (`addon-rocks`/`addon-vegetation`) and Stage 5 (integration) not started. |
| `addons/st-addon-human` | **In progress, not ready** — placeholder only, needs MakeHuman base mesh + morph target pipeline. |

### `st-addon-weather` — gaps discovered during build
- `AstronomicalSunPosition`'s moon position is a stylized approximation (anti-sun direction phase-shifted by moon phase), not a precise lunar ephemeris — sufficient for sky lighting, not for astronomy-accurate moon rendering. A real lunar position formula could be a future enhancement.
- `WeatherSystem` does not auto-construct built-in effect fallbacks for weather types the developer didn't explicitly register in `effects` — this is intentional (no hidden defaults / silent behavior), but a future convenience helper (e.g. `createDefaultEffectSet()`) could reduce boilerplate for the common "just give me everything" case.

### `st-addon-terrain` — gaps discovered during build
- `TerrainSurfaceSampler.sampleMoisture` is a heuristic (blends inverse-slope and inverse-altitude), not a hydrology simulation — documented as a deliberate placeholder for scatter-package density rules, not physically simulated water flow.
- No sculpting UI ships with this addon (by design — see HANDOVER.md); only the direct `setHeight`/`markDirtyAt`/`regenerateAffectedChunks` API. A future Stage 2 GUI tool would build a paint interface on top of this.
- `TerrainMaterial`'s slope/altitude blend is vertex-color based (no custom GLSL) — good enough for most cases and zero shader-injection surface, but coarser than a true per-fragment triplanar blend. The optional `shaderCoreGraph` upgrade path exists for anyone who needs richer blending.
- Terrain↔asset deformation coupling (the opt-in `deformTerrain` callback described in the original spec) was not implemented as part of Stage 1 — it belongs with the scatter packages (Stages 2-4) that would actually call it, not with `addon-terrain` itself, so it's deferred there.
- `TerrainStreamer.update()`/`updateSync()` only builds a chunk the first time it enters the load radius — an already-loaded chunk never re-evaluates its LOD level as the reference point moves closer/farther afterward. Doesn't cause seams (any LOD combination still stitches correctly), but means a chunk that was first loaded far away and then approached stays at its original coarse resolution instead of upgrading to full detail. Fix: track each chunk's desired LOD every call and rebuild in place when it changes (with hysteresis/a small buffer to avoid rebuild-thrashing right at a LOD boundary).
- No visual regression testing for `ProceduralSkyRenderer`'s GLSL output (tests cover construction/uniform-forwarding only, per HANDOVER's "no GL context in Node" constraint) — only the example HTML provides visual verification.

### `st-addon-trees` — gaps discovered during build
- `deformTerrain` (the opt-in callback letting a placed tree flatten/dent the ground under it) described in the original terrain-suite spec was not implemented — same reasoning as `addon-terrain`'s deferral: it's a placement-time hook best owned alongside the chunk-awareness work, deferred to Stage 5 integration.
- Chunk-awareness (consuming `TerrainStreamer` load/unload events so scattered trees stream in/out with terrain chunks) was not implemented — `TreePlacement`/`TreeScatter` currently scatter across one fixed area in one call, standalone-only. A developer using a chunked `addon-terrain` scene today would call `TreePlacement.scatter()` once per loaded chunk by hand. Documented as a known gap rather than silently unsupported; revisit in Stage 5.
- `TreeScatter`'s impostor mesh is any developer-supplied `BufferGeometry` (the example uses a simple cross-quad billboard) — this package does not generate a camera-facing billboard automatically (no per-frame billboard rotation logic), so a true always-facing impostor requires either a custom shader or accepting the cross-quad's fixed-angle approximation.
- Wind sway is a single sine term scaled by local vertex height — a good cheap approximation (matches the "small built-in sway" spec wording) but not a multi-octave/gust-turbulence shader; the `windProvider` upgrade path (e.g. `weather.wind`) is the intended path to richer, spatially-varying motion.
