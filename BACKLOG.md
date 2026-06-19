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
