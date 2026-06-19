# Three.js Ecosystem — Architecture Overview

A modular, Blender-matched Three.js ecosystem. Each package does one job.
Packages communicate only through Three.js primitives (`BufferGeometry`, `Material`, `Texture`).
No package imports from another package (except `st-core-types` for interface types).

**Stage 1 complete as of 2026-05-29.**

---

## Package Map

```
st-geometry-nodes          — procedural geometry node graph (Blender Geometry Nodes)
  Grid · UVSphere · IcoSphere · Cylinder · Cone · Cube · Circle · BoundingBox ·
  ConvexHull · ExtrudeMesh · TransformGeometry · JoinGeometry · SetPosition ·
  SubdivisionSurface · MergeByDistance · FlipFaces · DistributePointsOnFaces ·
  InstanceOnPoints · RealizeInstances · CurveToMesh · ResampleCurve ·
  SetCurveRadius · Switch · Index · AlignRotationToVector

st-curve-core              — Bezier / NURBS / Catmull-Rom curves
  BezierCurve (auto/aligned/vector/free handles) · NURBSCurve · CatmullRomCurve ·
  CurveTube (bevelFactor) · CurveBevel (bevelFactor) · CurveLine · PathFollow · RMF frames

radius-parametric-geometry — parametric geometry from radius functions
        ↓ BufferGeometry

st-modifier-core           — Blender-matched non-destructive modifier stack
  Generate: SubdivisionModifier · ArrayModifier · ExtrudeModifier · SolidifyModifier ·
            MirrorModifier · OceanModifier · BooleanModifier · WireframeModifier · BevelModifier
  Deform:   DisplacementModifier · WarpModifier · TwistModifier · BendModifier · ShrinkwrapModifier
  Transform: UVProjectionModifier · NormalRecalculateModifier
        ↓ BufferGeometry

st-uv-core                 — UV unwrapping (6 algorithms + seam cutting + packing)
  CubeProjection · CylinderProjection · SphereProjection · SmartUVProject ·
  ConformalLSCM · AngleBasedABF (both with true vertex-splitting seam cuts) ·
  PackIslands · AverageIslandScale · MarkSeams

st-shader-core             — Blender-matched surface shader nodes (75 nodes)
  Input:   TextureCoordinate · UV · Position · Normal · CameraData · Fresnel ·
           Attribute · ColorAttribute · OceanAttribute · LightPath · Tangent · Geometry
  Texture: ImageTexture · NoiseTexture · VoronoiTexture · MusgraveTexture ·
           GradientTexture · WaveTexture · BrickTexture · CheckerTexture ·
           MagicTexture · EnvironmentTexture · AnimatedNoiseTexture
  BSDF:    PrincipledBSDF · DiffuseBSDF · GlossyBSDF · GlassBSDF · RefractionBSDF ·
           TransparentBSDF · TranslucentBSDF · SubsurfaceScattering · Emission ·
           Background · HoldoutBSDF · VelvetBSDF · ToonBSDF · AnisotropicBSDF ·
           HairBSDF · PrincipledHair
  Shader:  MixShader · AddShader · AmbientOcclusion · RayPortal
  Color:   MixRGB · ColorRamp · HueSaturation · BrightnessContrast · Invert · Gamma · Exposure
  Vector:  Mapping · NormalMap · BumpMap · VectorMath · VectorTransform · Displacement
  Converter: Math · Blackbody · ColorTemperature · SeparateRGB · CombineRGB ·
             SeparateXYZ · CombineXYZ · SeparateHSV · CombineHSV ·
             WavelengthToRGB · RGBToCIEXYZ
  Volume:  VolumeAbsorption · VolumeScatter · PrincipledVolume
  Output:  MaterialOutput (compile() → ShaderMaterial, toPhysicalMaterial() → path tracer)
        ↓ Material

st-volume-core             — ray-marched volumetric media
  VolumeBox (fog/smoke/fire GLSL ray march) · PointDensity

     THREE.Mesh
        ↑
st-particle-core           — Blender-matched particle system (all 7 phases)
  Emitters: PointEmitter · MeshEmitter (geometryProvider callback) · EdgeEmitter
  Forces:   GravityForce · WindForce · VortexForce · DragForce · MagneticForce ·
            HarmonicForce · ChargeForce · LennardJonesForce · TextureForce ·
            TurbulenceForce · CurveGuideForce · FlowFieldForce · BoidField · BoidForce
  Renderers: BillboardRenderer · LineRenderer · ObjectRenderer · CollectionRenderer ·
             StrandRenderer · NoneRenderer
  Physics:  Newtonian · KeyedPhysics · SPHPhysics
  Other:    ParticleCache (bake/replay) · DeflectorCollider

st-physics-core            — cloth, soft body, rigid body simulation
  ClothSimulator (structural + bend + self-collision + pressure) ·
  SoftBodySimulator (Verlet + volume pressure + shape match) ·
  RigidBodyWorld (sphere/box/capsule) ·
  Constraints: FixedConstraint · HingeConstraint · SliderConstraint ·
               SpringConstraint · BallSocketConstraint · ConeTwistConstraint ·
  Colliders: PlaneCollider · SphereCollider · CapsuleCollider ·
  Forces: WindForce

st-animation-core          — shape keys, skeletal FK/IK, CPU skinning, NLA
  ShapeKeyMesh · Armature · PoseBone · SkinBinding ·
  Constraints: TrackToConstraint · CopyRotationConstraint · CopyLocationConstraint ·
  NLATrack · NLAEditor · ExpressionDriver

st-keyframe                — drives any numeric parameter across all packages
  KeyframeTrack · QuaternionTrack (SLERP) · AnimationClip · AnimationMixer ·
  buildClip · 30 easings

st-compositor-core         — post-processing node graph (28 passes)
  Bloom · Blur · GaussianBlur · DepthOfField · ChromaticAberration · Vignette ·
  FilmGrain · ColorBalance · HueSaturation · BrightnessContrast · Gamma · Exposure ·
  Sharpen · Pixelate · Mix · AlphaOver · ZCombine · SetAlpha · SeparateRGBA ·
  CombineRGBA · SSAO · SSR · GlareStreaks · MotionBlur · RenderLayers ·
  LensFlare · EdgeDetect · LUT

st-pathtracer-core         — raster ↔ path-tracer toggle + LightPath multi-pass
  RenderManager (setMode raster/pathtracer) · PathTracerRenderer ·
  LightPathController (camera/shadow/diffuse/glossy/reflection/transmission passes)

st-hair-core               — hair, fur, grass strand rendering + dynamics
  HairSystem (tube/ribbon/line) · StrandGenerator · KinkModifier · ClumpModifier ·
  HairDynamics (Verlet + distance constraints + collision sphere)

st-fluid-core              — FLIP fluid + SPH simulation
  FLIPSimulator (PCG pressure solve) · SPHSimulator · MarchingCubes · FluidEmitter

st-metaball-core           — organic iso-surface
  MetaballWorld · MetaballObject (positive + negative) · live update()

st-core-types              — shared TypeScript interfaces (no runtime code)
  IAnimatable · IModifier · IGeometryProvider · ICurve · IStrand ·
  IEmitter · IForce · IParticleLike · IParticlePool · IRenderer ·
  IKeyframeTarget · IShaderNode · IOutputNode · ICollider ·
  IConstraint · IRigidBody · IPoseBone
```

---

## Design Rules

1. **No cross-package imports** — packages connect only at `THREE.Mesh` via `BufferGeometry` and `Material`
2. **`parameters` object** — every node/modifier/force exposes all scalar inputs as a plain object (GSAP + st-keyframe compatible)
3. **Callbacks for external data** — never import a concrete class; accept `(x,y,z) => value` or `() => BufferGeometry`
4. **Non-destructive** — modifiers/nodes never mutate input; always return new geometry/values
5. **TypeScript strict** — no `any`, no `@ts-ignore`

---

## Dependency Build Order

```
st-curve-core       → st-geometry-nodes (curve nodes)
st-keyframe         → st-animation-core (parameter driving)
st-hair-core        → st-shader-core HairInfo / PrincipledHair nodes
st-fluid-core       → st-particle-core Phase 6 SPH (optional — SPHPhysics is self-contained)
st-physics-core     → st-hair-core HairDynamics (optional — HairDynamics is self-contained)
```

---

## Stage 2 — GUI App (next)

A Blender-like browser scene editor built on top of this runtime library.
See `HANDOVER.md` for the full plan.
