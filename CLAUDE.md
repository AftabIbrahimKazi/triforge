# Ecosystem Root — Claude Code Guide

This file applies to ALL packages in this ecosystem.
Each package also has its own CLAUDE.md with package-specific rules.
Root rules ALWAYS take precedence when there is a conflict.

---

## Ecosystem Overview

**Stage 1 complete as of 2026-05-29.** All packages built and tested.
A modular Three.js ecosystem inspired by Blender's architecture.
Each package does one job and communicates with others through Three.js primitives only.

### Paid Addons (under `addons/`)
High-level domain-specific generators built on top of core packages.
Addons MAY import from core packages. Core packages must NEVER import from addons.

```
addons/st-addon-human  ✓  — parametric human generator (HumanGenerator)
        Body proportions · Head/face shaping · Skin SSS shader · Eye material ·
        JSON export/import · Skeleton joint positions
```

#### Non-Negotiable Addon Rules

**1 — Three.js is the only hard dependency.**
Every addon must work with `npm install three @triforge/addon-*` alone.
No core ST package may be a required dependency of an addon.

**2 — Every feature that uses a core package must ship a built-in fallback.**
If a feature is enhanced by `@triforge/shader-core`, `@triforge/geometry-nodes`, etc.,
the addon must also contain a self-contained Three.js implementation of that feature.
The core package version is the upgrade path, never the only path.

**3 — Core packages are opt-in, passed by the developer at construction time.**
Never use dynamic `import()` to silently load core packages.
Instead accept them as constructor arguments (e.g. `{ shaderCore: ShaderCore }`).
This keeps the dependency graph explicit and bundler-friendly.

```ts
// CORRECT — developer opts in explicitly
const human = new HumanGenerator({ shaderCore: ShaderCore })

// WRONG — hidden runtime dependency
const sc = await import('@triforge/shader-core')  // never do this inside an addon
```

**4 — Core packages go in `optionalDependencies` in package.json, not `peerDependencies`.**
This signals to npm/bundlers that they are genuinely optional and won't produce
install warnings when absent.

**5 — The public API must be identical regardless of which path is active.**
Swapping in a core package must never change method signatures or the `parameters` shape.
A developer should be able to add `@triforge/shader-core` later without touching any other code.

```
st-geometry-nodes  ✓  — procedural geometry node graph (Blender Geometry Nodes)
        Grid · UVSphere · IcoSphere · Cylinder · Cone · Cube · Circle ·
        TransformGeometry · JoinGeometry · SetPosition · SubdivisionSurface ·
        MergeByDistance · FlipFaces · DistributePointsOnFaces · InstanceOnPoints ·
        RealizeInstances · CurveToMesh · ResampleCurve · SetCurveRadius ·
        Switch · Index · AlignRotationToVector
st-curve-core  ✓      — Bezier/NURBS/Catmull-Rom curves, bevel, path-follow
        BezierCurve (auto/aligned/vector/free handles) · NURBSCurve · CatmullRomCurve ·
        CurveTube (bevelFactor) · CurveBevel (bevelFactor) · PathFollow · RMF frames
radius-parametric-geometry  ✓  — parametric geometry generation
        ↓ BufferGeometry
st-modifier-core  ✓   — Blender-matched non-destructive modifier stack
        Generate: SubdivisionModifier · ArrayModifier · ExtrudeModifier · SolidifyModifier ·
                  MirrorModifier · OceanModifier · BooleanModifier · WireframeModifier · BevelModifier
        Deform:   DisplacementModifier · WarpModifier · TwistModifier · BendModifier · ShrinkwrapModifier
        Transform: UVProjectionModifier · NormalRecalculateModifier
        ↓ BufferGeometry
st-uv-core  ✓         — UV unwrapping (6 algorithms + true vertex-splitting seam cuts + packing)
        CubeProjection · CylinderProjection · SphereProjection · SmartUVProject ·
        ConformalLSCM · AngleBasedABF · PackIslands · AverageIslandScale · MarkSeams
st-shader-core  ✓     — 75 Blender-matched surface shader nodes
        Input: TextureCoordinate · UV · Position · Normal · Fresnel · Attribute ·
               ColorAttribute · LightPath (real uniforms, LightPathController) · Tangent
        Texture: NoiseTexture · VoronoiTexture · MusgraveTexture · BrickTexture + more
        BSDF: PrincipledBSDF · DiffuseBSDF · GlossyBSDF · GlassBSDF · Emission +10 more
        Shader: MixShader · AmbientOcclusion · RayPortal
        Volume: VolumeAbsorption · VolumeScatter · PrincipledVolume
st-volume-core  ✓     — ray-marched volumetric media (fog, smoke, fire) + PointDensity
        ↓ Material
     Three.js Mesh
        ↑
st-particle-core  ✓   — Blender-matched particle system (all 7 phases, 218 tests)
        Emitters: PointEmitter · MeshEmitter (geometryProvider callback) · EdgeEmitter
        Forces: GravityForce · WindForce · VortexForce · DragForce · MagneticForce ·
                TurbulenceForce · CurveGuideForce · FlowFieldForce · BoidField + more
        Renderers: BillboardRenderer · LineRenderer · ObjectRenderer · StrandRenderer + more
        Physics: Newtonian · KeyedPhysics · SPHPhysics
st-physics-core  ✓    — cloth, soft body, rigid body simulation
        ClothSimulator · SoftBodySimulator · RigidBodyWorld ·
        Constraints: Fixed · Hinge · Slider · Spring · BallSocket · ConeTwist
        Colliders: PlaneCollider · SphereCollider · CapsuleCollider
st-animation-core  ✓  — shape keys, skeletal FK/IK, CPU skinning, NLA
        ShapeKeyMesh · Armature · PoseBone · SkinBinding · NLATrack · NLAEditor ·
        ExpressionDriver · TrackToConstraint · CopyRotationConstraint · CopyLocationConstraint
st-keyframe  ✓        — drives any parameter across all packages
        KeyframeTrack · QuaternionTrack (SLERP) · AnimationClip · AnimationMixer ·
        buildClip · 30 easings
st-compositor-core  ✓ — 28 post-processing passes (Blender Compositor)
        Bloom · DepthOfField · GaussianBlur · GlareStreaks · MotionBlur · SSAO · SSR ·
        ChromaticAberration · Vignette · FilmGrain · LUT · LensFlare · EdgeDetect + more
st-pathtracer-core  ✓ — raster ↔ path-tracer toggle + LightPath multi-pass
        RenderManager · PathTracerRenderer · LightPathController
        (camera/shadow/diffuse/glossy/reflection/transmission passes)
st-hair-core  ✓       — hair, fur, grass strand rendering + dynamics
        HairSystem · StrandGenerator · KinkModifier · ClumpModifier ·
        HairDynamics (Verlet + distance constraints + collision sphere)
st-fluid-core  ✓      — FLIP fluid + SPH simulation
        FLIPSimulator (PCG pressure) · SPHSimulator · MarchingCubes · FluidEmitter
st-metaball-core  ✓   — organic iso-surfaces
        MetaballWorld · MetaballObject (positive + negative) · live update()
st-core-types  ✓      — shared TypeScript interfaces (no runtime code)
        IAnimatable · IModifier · IGeometryProvider · ICurve · IStrand · IForce ·
        IConstraint · IRigidBody · IPoseBone + more
```

Packages communicate ONLY through Three.js primitives (`BufferGeometry`, `Material`, `Texture`).
No package imports from another package except `st-core-types`.

---

## Non-Negotiable Rules (apply to every package)

### Parameters
EVERY node and modifier MUST expose a public `parameters` plain object containing all scalar inputs.
This is required for GSAP compatibility and the future keyframe system.

```typescript
// CORRECT — parameters are reachable from outside
class NoiseTexture extends ProcessNode {
  parameters = { scale: 5.0, detail: 2.0, roughness: 0.5, distortion: 0.0 }
}

// WRONG — parameters are locked away, unreachable
private readonly _inputs = { scale: new InputSocket(...) }
```

Parameter names must match Blender's parameter names exactly where applicable.

### Interoperability
Modifiers that need external data (noise, color, vector) MUST accept it as a callback, never as a concrete class import.

```typescript
// CORRECT — any noise source works
new DisplacementModifier({ strength: 0.5, noiseFunction: (x, y, z) => value })

// WRONG — creates a hard dependency
new DisplacementModifier({ strength: 0.5, noise: new NoiseTexture() })
```

### No Cross-Package Imports
No package may import from another package in this ecosystem (except `st-core-types` when it exists).
They connect only at the `THREE.Mesh` level via `BufferGeometry` and `Material`.

### TypeScript Strict Mode
All packages use strict TypeScript. No `any` types. No `@ts-ignore`.

### Non-Destructive
Modifiers never mutate input geometry. Always return a new `BufferGeometry`.
Node graphs never mutate input values. Always produce new outputs.

---

## Mandatory Steps When Building Any Feature

Follow these steps in order every time a feature is built. Do not skip any step.

### Step 1 — Build the Feature
- Match Blender's naming exactly (node names, parameter names, socket names)
- Expose all scalar values in a public `parameters` object
- Accept external data as callbacks/interfaces, not concrete imports
- No `any` types, no raw GLSL strings outside of node `glslFunction` properties

### Step 2 — Security Check
Before marking any feature complete, check for:
- Shader injection — never interpolate unsanitized user strings into GLSL
- Prototype pollution — never use user input as object keys without sanitization
- Unsafe `eval` or `Function()` constructor — never use these
- Unbounded loops in GLSL — always cap iteration counts
Fix any issues found before proceeding.

### Step 3 — Write a Working Example File
Create a visual `.html` example file in the project root demonstrating the new feature.
Name it descriptively: `example-[feature-name].html`
The file must:
- Run in a browser with no build step (use importmap or CDN Three.js)
- Show the feature working visually on screen
- Include orbit controls so the result can be inspected
- Be self-contained — no external dependencies beyond Three.js CDN

These files are temporary — the user will manually delete or keep them.

### Step 4 — Internal Tests
Run the package's existing test suite: `npm test` inside the package folder.
All existing tests must still pass after the new feature is added.
Write new tests for the new feature covering:
- Happy path — feature works as intended
- Edge cases — zero values, extreme values, missing optional inputs
- Integration — feature works correctly in a full node/modifier graph

### Step 5 — Benchmark
Run the benchmark: `npm run bench` inside the package folder (create this script if it doesn't exist).
Compare results against:
- The previous benchmark baseline stored in the package's `bench/` folder
- Industry standard: handwritten Three.js `ShaderMaterial` equivalent (for shader nodes)
- Industry standard: direct `BufferGeometry` manipulation (for modifiers)

New features must not regress performance by more than 5% on existing operations.
New features themselves must match or beat handwritten Three.js equivalent.
Save benchmark results to `bench/results-[date].md`.

### Step 6 — Update TUTORIAL.md (MANDATORY — never skip)
Update ALL relevant tutorial files — this is not optional.

Files to update when adding a feature to a package:
- The package's own `TUTORIAL.md` — add the new node/modifier/feature with a code example
- The root `TUTORIAL.md` — update the node quick reference list and any affected examples
- If the feature connects two packages, update both packages' tutorial files

The tutorial entry must:
- Show the simplest possible working code example for the feature
- Explain what the feature does in plain language (no jargon)
- Show how it connects with other packages where relevant
- Be written for someone new to the ecosystem
- Match the style and format of existing entries in that file

### Step 7 — Update BACKLOG.md (MANDATORY — never skip)
- If the feature was listed in `BACKLOG.md` as pending, mark it complete or remove it
- If the feature revealed new gaps or future work, add them to `BACKLOG.md`
- If a new package was created, add it to the ecosystem diagram at the top of this file

---

## File Naming Conventions

| Type | Location | Naming |
|---|---|---|
| Example files | project root | `example-[feature].html` |
| Benchmark results | `[package]/bench/` | `results-[YYYY-MM-DD].md` |
| Node source | `[package]/src/nodes/[category]/` | `PascalCase.ts` |
| Modifier source | `[package]/src/modifiers/[category]/` | `PascalCaseModifier.ts` |
| Tests | `[package]/test/` | `[feature].test.ts` |

---

## Performance Standards

### st-shader-core
- Compiled GLSL must match or beat handwritten `THREE.ShaderMaterial` equivalent
- `compile()` must complete in under 5ms for graphs up to 20 nodes
- No allocations inside animation loops

### st-modifier-core (when built)
- Modifier stack apply must complete in under 16ms for meshes up to 10k vertices
- SubdivisionModifier must not exceed 3x the vertex count per level
- DisplacementModifier must complete in under 8ms for 10k vertices

---

## Security Rules

- NEVER interpolate user-supplied strings directly into GLSL source
- NEVER use `eval()` or `new Function()` anywhere in the ecosystem
- ALWAYS validate numeric parameters are finite numbers before use in GLSL uniforms
- ALWAYS cap GLSL loop iterations to a compile-time constant
- NEVER expose internal socket wiring as a public mutable API

---

## What Belongs Where

| Concern | Package |
|---|---|
| Surface shading, BSDF, textures | `st-shader-core` |
| Volume shading, fog, smoke | `st-volume-core` |
| Geometry deformation, subdivision | `st-modifier-core` |
| Procedural geometry generation | `st-geometry-nodes` |
| Parametric shapes | `radius-parametric-geometry` |
| Particles, emitters, force fields, Boids | `st-particle-core` |
| SPH fluid simulation | `st-fluid-core` |
| Hair, fur, grass strands | `st-hair-core` |
| Animation, keyframing | `st-keyframe` |
| Shared TypeScript interfaces | `st-core-types` |

When unsure which package a feature belongs to, refer to this table and the ecosystem diagram at the top.

---

## Reference Files

- `BACKLOG.md` — deferred features, blocked work, future packages
- `TUTORIAL.md` — user-facing guide, updated with every working feature
- `THREE_JS_ECOSYSTEM.md` — ecosystem architecture overview
