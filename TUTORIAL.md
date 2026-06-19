# Ecosystem Tutorial

A practical guide to using all packages in this Three.js ecosystem together.
Updated automatically whenever new features are added to any package.

---

## What Is This Ecosystem?

A set of modular packages inspired by Blender's workflow — parametric geometry, procedural modifiers, and a node-based shader system — all built on top of Three.js.

You can use each package independently or chain them together:

```
radius-parametric-geometry  →  st-modifier-core  →  st-shader-core
     (shape)                      (deform)             (material)
          ↘                           ↓                    ↙
                              THREE.Mesh in scene
```

---

## Packages

| Package | What It Does | Tests |
|---|---|---|
| `radius-parametric-geometry` | Define any 3D shape with two math functions | — |
| `st-shader-core` | 75 Blender-matched shader nodes → ShaderMaterial or MeshPhysicalMaterial | 55 |
| `st-modifier-core` | Non-destructive modifier stack — Subdivision, Bevel, Wireframe, Mirror, Displace, Shrinkwrap + more | 43+38 |
| `st-particle-core` | Full Blender particle system — emitters, forces, renderers, boids, SPH, cache, geometryProvider | 218 |
| `st-uv-core` | UV unwrapping — Cube/Cylinder/Sphere, Smart UV, LSCM, ABF, Pack Islands, seam cutting | 57 |
| `st-compositor-core` | 28 post-processing passes — Bloom, DoF, GlareStreaks, MotionBlur, SSAO, SSR, LUT + more | 82 |
| `st-volume-core` | Ray-marched volumetric media — fog, smoke, fire; PointDensity splat | — |
| `st-geometry-nodes` | Procedural geometry node graph — primitives, transform, instances, curve nodes, Switch, Index | 44 |
| `st-keyframe` | Animate any numeric parameter — KeyframeTrack, QuaternionTrack (SLERP), AnimationMixer, 30 easings | 49 |
| `st-curve-core` | Bezier/NURBS/Catmull-Rom — handle modes, bevelFactor, tube, bevel, path-follow, RMF frames | 66 |
| `st-animation-core` | Shape keys, armature FK/IK, CPU skinning, NLA, bone constraints (TrackTo, CopyRotation, CopyLocation) | 63 |
| `st-physics-core` | Cloth, soft body, rigid body — BallSocket, ConeTwist, Hinge, Spring, Slider constraints | 63 |
| `st-hair-core` | Hair/fur/grass — tube/ribbon/line render, kink, clump, HairDynamics (Verlet + collision) | 51 |
| `st-fluid-core` | FLIP fluid (PCG pressure), SPH, marching cubes surface reconstruction | — |
| `st-pathtracer-core` | Raster ↔ path-tracer toggle; LightPathController multi-pass rendering | — |
| `st-metaball-core` | Organic iso-surfaces — MetaballWorld, positive + negative blobs | — |
| `st-core-types` | Shared TypeScript interfaces — IModifier, ICurve, IStrand, IForce, IConstraint + 11 more | 8 |

---

## Quick Start — Shape + Material

The most common pattern: create a parametric shape and apply a procedural material.

```html
<!DOCTYPE html>
<html>
<head>
  <style> body { margin: 0; } </style>
</head>
<body>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.176.0/build/three.module.js",
    "three/examples/": "https://cdn.jsdelivr.net/npm/three@0.176.0/examples/"
  }
}
</script>
<script type="module">
  import * as THREE from 'three'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import { RadiusParametricGeometry } from './radius-parametric-geometry/dist/index.js'
  import {
    NoiseTexture, ColorRamp, PrincipledBSDF, MaterialOutput
  } from './st-shader-core/dist/index.js'

  // Scene setup
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 1, 3)
  const controls = new OrbitControls(camera, renderer.domElement)

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.position.set(5, 5, 5)
  scene.add(sun)

  // 1. Define shape — a wavy sphere
  const geo = new RadiusParametricGeometry(
    (u, v) => 1.0 + 0.2 * Math.sin(u * Math.PI * 4),
    (u, v) => Math.cos(v * Math.PI),
    { radiusSegments: 64, heightSegments: 32 }
  )

  // 2. Define material — procedural noise-driven color
  const noise = new NoiseTexture({ scale: 3.0, detail: 4.0 })
  const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#1a0a00', '#cc4400', '#ffaa00'] })
  const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.6 })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()

  // 3. Combine
  scene.add(new THREE.Mesh(geo, mat.material))

  // Render loop
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera) })
</script>
</body>
</html>
```

---

## Package 1 — `radius-parametric-geometry`

Define any rotationally-parametric 3D shape using two functions:
- `radiusFunction(u, v)` — how far from the center axis at this point
- `heightFunction(u, v)` — how high up at this point

Both `u` and `v` are always in the range `[0, 1]`.

### Common Shapes

```javascript
// Sphere
new RadiusParametricGeometry(
  (u, v) => Math.sin(v * Math.PI),
  (u, v) => Math.cos(v * Math.PI)
)

// Cylinder
new RadiusParametricGeometry(
  (u, v) => 1.0,
  (u, v) => v * 2.0 - 1.0
)

// Cone
new RadiusParametricGeometry(
  (u, v) => 1.0 - v,
  (u, v) => v
)

// Torus
new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.4 * Math.cos(v * Math.PI * 2),
  (u, v) => 0.4 * Math.sin(v * Math.PI * 2)
)

// Procedural wavy surface
new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.3 * Math.sin(u * Math.PI * 6 + v * Math.PI * 4),
  (u, v) => v * 2.0 - 1.0,
  { radiusSegments: 64, heightSegments: 32 }
)
```

### Options

```javascript
{
  radiusSegments: 32,        // segments around the axis  (default: 32)
  heightSegments: 16,        // segments along the height (default: 16)
  thetaStart:     0,         // start angle in radians    (default: 0)
  thetaLength:    Math.PI*2  // angle sweep in radians    (default: full circle)
}
```

### Getting Geometry Stats

```javascript
const stats = geo.getStats()
console.log(stats.vertexCount, stats.triangleCount, stats.totalMemory)
```

---

## Package 2 — `st-shader-core`

Build Blender-style materials by wiring nodes together. No raw GLSL required.
The system mirrors Blender's shader editor — same node names, same parameter names.

### The Pattern

Every material ends with `MaterialOutput`. Call `compile()` once, then reuse the material on any number of meshes.

```javascript
const noise = new NoiseTexture({ scale: 3.0 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#000022', '#0055ff'] })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.4 })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// Reuse across any meshes
const meshA = new THREE.Mesh(geoA, mat.material)
const meshB = new THREE.Mesh(geoB, mat.material)
```

### Animated Materials

Use `AnimatedNoiseTexture` and inject a `time` uniform after compile:

```javascript
const noise = new AnimatedNoiseTexture({ scale: 2.0, speed: 0.4 })
const bsdf  = new PrincipledBSDF({ baseColor: noise.output('Color') })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()
mat.material.uniforms.time = { value: 0 }

// In your animation loop:
mat.material.uniforms.time.value = clock.getElapsedTime()
```

### Wrapping Materials in a Class

For complex materials, wrap them in a class — same pattern as Blender's named materials:

```javascript
class LavaMaterial {
  constructor() {
    const noise = new AnimatedNoiseTexture({ scale: 3.0, speed: 0.3 })
    const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#1a0000', '#cc2200', '#ffaa00', '#ffffff'] })
    const bump  = new Bump({ height: new RGBtoBW({ color: noise.output('Color') }).output('Val'), strength: 2.0 })
    const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), normal: bump.output('Normal'), roughness: 0.8 })
    this._out   = new MaterialOutput({ surface: bsdf.output('BSDF') })
    this._out.compile()
    this._out.material.uniforms.time = { value: 0 }
  }
  get material() { return this._out.material }
  tick(t) { this.material.uniforms.time.value = t }
}

const lava = new LavaMaterial()
scene.add(new THREE.Mesh(geo, lava.material))
// In loop: lava.tick(clock.getElapsedTime())
```

### Node Quick Reference

**Textures:** `NoiseTexture`, `VoronoiTexture`, `WaveTexture`, `GradientTexture`, `BrickTexture`, `CheckerTexture`, `MagicTexture`, `MusgraveTexture`, `WhiteNoise`, `ImageTexture`, `AnimatedNoiseTexture`

**Color:** `ColorRamp`, `MixRGB`, `HueSaturationValue`, `BrightContrast`, `RGBtoBW`, `Blackbody`, `Gamma`, `InvertColor`, `RGBCurves`, `Wavelength`

**Vector:** `NormalMap`, `Bump`, `Mapping`, `VectorMath`, `SeparateRGB`, `CombineRGB`, `SeparateXYZ`, `CombineXYZ`, `Normal`, `VectorRotate`, `VectorTransform`, `VectorCurves`

**BSDF:** `PrincipledBSDF`, `DiffuseBSDF`, `GlossyBSDF`, `GlassBSDF`, `RefractionBSDF`, `SheenBSDF`, `SubsurfaceScattering`, `ToonBSDF`, `SpecularBSDF`, `TranslucentBSDF`, `Emission`, `MixShader`, `AddShader`, `Fresnel`

**Input:** `TextureCoordinate`, `Value`, `RGB`, `Geometry`, `LayerWeight`, `CameraData`, `UVMap`, `Tangent`, `ColorAttribute`, `Wireframe`, `ObjectInfo`

**Converter:** `ShaderMath`, `Clamp`, `MapRange`, `FloatCurve`, `ShaderToRGB`, `CombineColor`, `SeparateColor`, `HashValue`

---

## Full Pipeline Example

Shape → Material, with a rock-like procedural surface:

```javascript
import { RadiusParametricGeometry } from './radius-parametric-geometry/dist/index.js'
import {
  NoiseTexture, VoronoiTexture, ColorRamp, MixRGB,
  Bump, PrincipledBSDF, MaterialOutput, RGBtoBW
} from './st-shader-core/dist/index.js'

// Shape — irregular rock-like blob
const geo = new RadiusParametricGeometry(
  (u, v) => 1.0 + 0.15 * Math.sin(u * Math.PI * 5) * Math.cos(v * Math.PI * 3),
  (u, v) => Math.cos(v * Math.PI) * (1.0 + 0.1 * Math.sin(u * Math.PI * 7)),
  { radiusSegments: 64, heightSegments: 32 }
)

// Material — layered noise for rock color and surface detail
const baseNoise   = new NoiseTexture({ scale: 4.0, detail: 6.0, roughness: 0.7 })
const detailNoise = new VoronoiTexture({ scale: 12.0 })
const colorRamp   = new ColorRamp({ fac: baseNoise.output('Fac'), stops: ['#2a1f0e', '#5c4a2a', '#8a7355'] })
const mixColor    = new MixRGB({ mode: 'MULTIPLY', fac: 0.3, colorA: colorRamp.output('Color'), colorB: detailNoise.output('Color') })
const bump        = new Bump({ height: new RGBtoBW({ color: baseNoise.output('Color') }).output('Val'), strength: 1.5 })
const bsdf        = new PrincipledBSDF({ baseColor: mixColor.output('Color'), roughness: 0.85, normal: bump.output('Normal') })
const mat         = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

scene.add(new THREE.Mesh(geo, mat.material))
```

---

## Package 3 — `st-modifier-core`

Apply Blender-style modifiers to any geometry before it reaches the renderer.

```javascript
import { ModifierStack, SubdivisionModifier, DisplacementModifier, NormalRecalculateModifier } from './st-modifier-core/dist/index.js'

const stack = new ModifierStack(baseGeometry)
  .add(new SubdivisionModifier({ levels: 2 }))
  .add(new DisplacementModifier({
    strength: 0.4,
    noiseFunction: (x, y, z) => Math.sin(x * 3 + y * 2) * 0.5 + 0.5
  }))
  .add(new NormalRecalculateModifier())

mesh.geometry = stack.apply()
```

**Available modifiers:**

| Category | Modifiers |
|---|---|
| Generate | `SubdivisionModifier`, `ArrayModifier`, `ExtrudeModifier`, `SolidifyModifier`, `MirrorModifier` |
| Deform | `DisplacementModifier`, `WarpModifier`, `TwistModifier`, `BendModifier` |
| Transform | `UVProjectionModifier`, `NormalRecalculateModifier` |

See [st-modifier-core/TUTORIAL.md](st-modifier-core/TUTORIAL.md) for the full reference.

---

## `st-particle-core` — Particle System

A Blender-matched particle system. Particles are simulated on the CPU with Newtonian physics, force fields, and pluggable renderers.

### Minimal example — fountain

```js
import { ParticleSystem, PointEmitter, GravityForce, DragForce, HaloRenderer } from '@st-particle-core';

// 1. Create the system (Blender: Particle System properties panel)
const sys = new ParticleSystem({
  count:          800,    // Number
  lifetime:       2.2,    // Lifetime
  lifetimeRandom: 0.3,    // Lifetime Randomness
  size:           0.25,   // Size
  physics:        'newtonian',
  seed:           42,     // Seed
});

// 2. Add an emitter (Blender: Emit From)
const emitter = new PointEmitter({
  position:       { x: 0, y: 0, z: 0 },
  normalVelocity: 6,      // Normal
  randomVelocity: 2.5,    // Randomise
});

// 3. Add forces (Blender: Force Fields panel)
sys.addEmitter(emitter)
   .addForce(new GravityForce(9.81))
   .addForce(new DragForce({ linear: 0.4 }));

// 4. Add a renderer (Blender: Render → Halo)
const render = new HaloRenderer({ maxCount: 800, map: mySprite, additive: true });
sys.setRenderer(render);
scene.add(render.object3D);

// 5. Tick each frame
function animate() {
  sys.update(clock.getDelta());
  renderer.render(scene, camera);
}
```

### Emitters

| Class | Blender equivalent | Key parameters |
|---|---|---|
| `PointEmitter` | Particle system on an Empty | `position`, `normalVelocity`, `randomVelocity` |
| `MeshEmitter` | Emit From: Verts / Faces / Volume | `emitFrom`, `evenDistribution`, `normalVelocity` |
| `EdgeEmitter` | Emit From: Edges (waterline foam) | `yThreshold` — only emit near y≈0 |

### Forces

| Class | Blender Force Field | Effect |
|---|---|---|
| `GravityForce` | Gravity | Pull down at configurable strength |
| `WindForce` | Wind | Constant directional push |
| `VortexForce` | Vortex | Spiral around an axis |
| `TurbulenceForce` | Turbulence | Noise-based random motion |
| `DragForce` | Drag | Velocity-proportional air resistance |
| `MagneticForce` | Magnetic | Velocity × field cross product |
| `HarmonicForce` | Harmonic | Spring attraction toward a point |
| `ChargeForce` | Force / Charge | Radial attract or repel |
| `LennardJonesForce` | Lennard-Jones | Molecular attraction/repulsion |

### Render modes

Four render modes match Blender's Particle System → Render panel. Every renderer exposes a `parameters` object for GSAP.

| Class (+ Blender alias) | Blender Render mode | Three.js object | Key parameters |
|---|---|---|---|
| `BillboardRenderer` / `HaloRenderer` | Halo | `THREE.Points` — one draw call | `opacity`, `fadeOut`, `size` |
| `LineRenderer` | Line | `THREE.LineSegments` — velocity trails | `lengthScale`, `opacity` |
| `InstanceRenderer` / `ObjectRenderer` | Object | `THREE.InstancedMesh` — one draw call | `billboard`, `fadeOut` |
| `CollectionRenderer` | Collection | `THREE.Group` of `InstancedMesh`es | `billboard`, `fadeOut`, `seed` |

```js
import { HaloRenderer, LineRenderer, ObjectRenderer, CollectionRenderer } from '@st-particle-core'

// Halo — camera-facing point sprites
const halo = new HaloRenderer({ maxCount: 800, color: 0x88ccff, additive: true, fadeOut: true })
sys.setRenderer(halo)

// Line — velocity-aligned line segments
const line = new LineRenderer({ maxCount: 800, color: 0xffaa44, lengthScale: 0.15 })

// Object — single mesh instanced at every particle
const obj = new ObjectRenderer({
  geometry: new THREE.OctahedronGeometry(0.1),
  material: new THREE.MeshStandardMaterial({ color: 0xff6644 }),
  maxCount: 800,
})

// Collection — random mesh from a list per particle
const col = new CollectionRenderer({
  meshes: [
    { geometry: new THREE.IcosahedronGeometry(0.1), material: new THREE.MeshStandardMaterial({ color: 0x44ffaa }) },
    { geometry: new THREE.BoxGeometry(0.14, 0.14, 0.14), material: new THREE.MeshStandardMaterial({ color: 0xffdd44 }) },
  ],
  maxCount: 800,
  seed: 3,
})
```

See the live demo: `example-particle-renderers.html`

### Emission Controls

Blender Emission panel parity — all in `ParticleSystem` and `MeshEmitter`.

```js
const sys = new ParticleSystem({
  count:          500,
  start:          1.0,          // seconds before emission begins (Blender: Frame Start)
  end:            10.0,         // seconds when emission stops    (Blender: End)
  lifetime:       2.5,          // base lifetime in seconds
  lifetimeRandom: 0.4,          // ±40% scatter per particle  (Blender: Lifetime Randomness)
  seed:           42,           // same seed → identical simulation
  randomOrder:    true,         // shuffle spawn slot order   (Blender: Random Order)
})

// Surface emission with area-weighted distribution
const e = new MeshEmitter({
  emitFrom:         'faces',    // 'verts' | 'faces' | 'volume'
  evenDistribution: true,       // larger triangles spawn more particles
  normalVelocity:   2,
})
sys.addEmitter(e)
sys.setGeometry(sphereGeometry)
```

See the live demo: `example-particle-emission.html` — sphere surface vs volume side by side, live lifetimeRandom slider.

### Velocity & Rotation Controls

Blender Velocity and Rotation panel parity — velocity in emitter parameters, rotation in `ParticleSystem`.

```js
// Velocity panel — on any emitter
const emitter = new PointEmitter({
  normalVelocity:  3,    // speed along spawn-point normal (Blender: Normal)
  tangentVelocity: 1,    // speed along surface tangent   (Blender: Tangent)
  tangentPhase:    0.5,  // tangent rotation offset        (Blender: Tangent Phase)
  objectVelocityX: 0,    // speed along emitter local X   (Blender: Object Align X)
  objectInherit:   0.8,  // inherit 80% of emitter motion (Blender: Object Velocity)
  randomVelocity:  1,    // random kick magnitude          (Blender: Randomise)
})

// Set emitter world velocity each frame so new particles inherit it
emitter.worldVelocity.set(vx, vy, vz)

// Rotation panel — on ParticleSystem
const sys = new ParticleSystem({
  rotationAxis:          2,   // 0=none · 1=velocity · 2=angular · 3=global · 4=local
  rotationPhase:         0,   // base initial rotation in radians    (Blender: Phase)
  rotationPhaseRandom:   0.5, // per-particle phase scatter [0,1]    (Blender: Phase Random)
  rotationRandom:        0.3, // extra random scatter [0,1]          (Blender: Random)
  angularVelocityMode:   1,   // 0=none · 1=velocity · 2=horiz · 3=vert · 4=global · 5=random
  angularVelocityAmount: 3,   // spin speed in rad/s                 (Blender: Amount)
})
```

Use `ObjectRenderer` with `billboard: false` so `particle.rotation` drives the mesh orientation.

See the live demo: `example-particle-rotation.html` — arrow mesh instances spinning with live sliders for angularVelocityAmount, angularVelocityMode, rotationRandom, and objectInherit.

### Source Vertex Groups — emission density weights

Weight emission density by a per-vertex attribute, exactly like Blender's **Source → Vertex Group → Density** slot. Particles cluster in high-weight regions; zero-weight regions receive no spawns.

```js
// Add a Float32BufferAttribute with per-vertex weights [0, 1]
const weights = new Float32Array(geo.attributes.position.count)
// ... fill weights: 1 = full density, 0 = no emission ...
geo.setAttribute('density', new THREE.Float32BufferAttribute(weights, 1))

const emitter = new MeshEmitter({
  emitFrom:         'faces',
  evenDistribution: true,    // required — vertex weights work via the area CDF
  normalVelocity:   1,
})
emitter.weightAttribute = 'density'  // string, not in parameters (not GSAP-animatable)

// Blend from full weighting → uniform with GSAP (weightStrength IS in parameters)
gsap.to(emitter.parameters, { weightStrength: 0, duration: 2 })
```

See the live demo: `example-particle-vertex-weight.html` — plane split into a high-density left half and a zero-density right half, with a live weightStrength slider.

### Children — dense secondary particles at zero physics cost

Children are spawned per parent at render time — they are not tracked in the pool and cost no simulation budget.

```js
const sys = new ParticleSystem({
  count:       200,
  lifetime:    3,
  childCount:  8,     // 8 extra children per alive parent
  childSpread: 0.4,   // scatter within a 0.4-unit sphere
  childType:   1,     // 1 = simple (sphere scatter), 2 = interpolated
  seed:        42,
})

// All three are numbers → GSAP-animatable
gsap.to(sys.parameters, { childCount: 20, childSpread: 1.2, duration: 1 })
```

Total drawn = alive parents × (1 + `childCount`), capped at `maxCount`.

See the live demo: `example-particle-children.html` — torus emitter with live sliders for childCount, childSpread, and a type toggle.

### Cache / Bake — deterministic replay

```js
// Bake 5 seconds of simulation at 30 fps, then scrub freely
sys.bake(0, 5, 30)
sys.cache.seek(sys, 2.5)   // restore pool to t=2.5 s (zero allocations)
sys.unbake()               // return to live simulation

// Serialise to JSON for disk cache
const saved = JSON.stringify(sys.cache.toJSON())
```

See the live demo: `example-particle-bake.html` — torus emitter, live vs baked side by side, scrub slider.

### Boids Flocking AI

```js
import { BoidForce } from '@st-particle-core'

const boid = new BoidForce(sys.pool, {
  separationRadius: 0.5,  separationStrength: 2,
  alignmentRadius:  1.5,  alignmentStrength:  1,
  cohesionRadius:   2.0,  cohesionStrength:   0.8,
  maxSpeed: 5,  maxForce: 3,
})
sys.addForce(boid)

// Live sliders via GSAP
gsap.to(boid.parameters, { cohesionStrength: 3, duration: 1 })
```

See the live demo: `example-particle-boids.html` — 200-particle flock with live sliders.

### All `parameters` are GSAP-compatible

```js
// Drive any parameter with GSAP
gsap.to(sys.parameters, { lifetime: 4, duration: 2 });
gsap.to(gravityForce.parameters, { strength: 0, duration: 1 });
gsap.to(emitter.parameters, { normalVelocity: 12, duration: 0.5 });
```

See the live demo: `example-particle-core.html`

---

## @st-uv-core — UV Unwrapping

Blender-matched UV unwrapping algorithms. Takes any `BufferGeometry` and returns a new one with an updated `uv` attribute. Non-destructive — input geometry is never modified.

```javascript
import { SmartUVProject, PackIslands, AverageIslandScale } from '@st-uv-core'

// Unwrap
const unwrapped = new SmartUVProject({ angleLimit: 66 }).apply(geometry)

// Normalise texel density and pack
const scaled = new AverageIslandScale().apply(unwrapped)
const packed  = new PackIslands({ margin: 0.02 }).apply(scaled)

mesh.geometry = packed
```

### Unwrap methods

| Class | Blender equivalent | Best for |
|---|---|---|
| `CubeProjection` | Cube Projection | Hard-surface, boxy shapes |
| `CylinderProjection` | Cylinder Projection | Tubes, pillars |
| `SphereProjection` | Sphere Projection | Balls, planets |
| `SmartUVProject` | Smart UV Project | Mixed hard-surface |
| `ConformalLSCM` | Unwrap (Conformal) | Organic shapes |
| `AngleBasedABF` | Unwrap (Angle Based) | Organic with obtuse triangles |

### Fitting into the pipeline

```javascript
import { ModifierStack, SubdivisionModifier } from '@st-modifier-core'
import { SmartUVProject } from '@st-uv-core'

const subdivided  = new ModifierStack(baseGeo).add(new SubdivisionModifier({ levels: 2 })).apply()
const unwrapped   = new SmartUVProject().apply(subdivided)
mesh.geometry     = unwrapped   // texture now maps correctly
```

See the live demo: `examples/uv/example-uv-core.html`

---

## @st-compositor-core — Post-Processing

Blender-matched compositor node graph. Wraps Three.js `EffectComposer` by default; opt in to `pmndrs/postprocessing` for better performance.

### Quick start

```javascript
import { CompositorOutput, Bloom, Vignette, ChromaticAberration } from '@st-compositor-core'

const comp = new CompositorOutput({ renderer, scene, camera }) // backend: 'three' (default)

comp.add(new Bloom({ threshold: 0.6, strength: 1.8 }))
   .add(new Vignette({ darkness: 0.5 }))
   .add(new ChromaticAberration({ offset: 0.004 }))

await comp.compile()   // call once — or re-call after adding/removing passes

// In animation loop — replaces renderer.render(scene, camera)
comp.render()

// On resize
comp.setSize(innerWidth, innerHeight)
```

### Switching to pmndrs backend

```javascript
// Install first: npm install postprocessing
const comp = new CompositorOutput({ backend: 'pmndrs', renderer, scene, camera })
// Same nodes, same API — better performance and quality
```

### Available passes (all parameters GSAP-animatable)

| Pass | Key parameters | Blender equivalent |
|---|---|---|
| `Bloom` | threshold, strength, radius | Glare → Bloom |
| `DepthOfField` | focusDistance, bokehScale, maxBlur | Defocus |
| `Blur` | radius, x, y | Blur |
| `ChromaticAberration` | offset, radialModulation | Lens Distortion → Dispersion |
| `Vignette` | darkness, offset | Lens Distortion → Vignette |
| `FilmGrain` | intensity, scanlines, greyscale | Film |
| `ColorBalance` | liftR/G/B, gammaR/G/B, gainR/G/B, fac | Color Balance |
| `HueSaturation` | hue, saturation, value, fac | Hue Saturation Value |
| `BrightnessContrast` | brightness, contrast | Bright/Contrast |
| `Gamma` | gamma | Gamma |
| `Exposure` | exposure | Exposure |
| `Sharpen` | intensity | Filter → Sharpen |
| `Pixelate` | pixelSize | Pixelate |
| `Mix` | fac | Mix |

### Stacking passes

```javascript
comp.add(new Bloom({ strength: 1.5 }))
   .add(new ChromaticAberration({ offset: 0.003 }))
   .add(new Vignette({ darkness: 0.4 }))
   .add(new FilmGrain({ intensity: 0.2 }))
await comp.compile()
```

### Animating with GSAP

All scalar parameters live in `pass.parameters` — GSAP-animatable after compile:

```javascript
const bloom = new Bloom({ strength: 0 })
comp.add(bloom)
await comp.compile()

// Fade bloom in
gsap.to(bloom.parameters, { strength: 2.0, duration: 1.5 })
```

---

## @st-keyframe — Keyframe Animation

Drives any `parameters` plain object on any ecosystem class — modifiers, shader nodes, UV unwrappers, compositor passes.
Zero dependencies on Three.js or any other ecosystem package.

### Quick start

```javascript
import { KeyframeTrack, AnimationClip, AnimationMixer, easeInOutSine } from '@st-keyframe'

// Any object with numeric properties is a valid target
const bloom = { strength: 0 }

const mixer = new AnimationMixer()
mixer.play(new AnimationClip('pulse', [
  new KeyframeTrack(bloom, 'strength', [
    { time: 0, value: 0, easing: easeInOutSine },
    { time: 1, value: 1, easing: easeInOutSine },
    { time: 2, value: 0 },
  ]),
]), { wrapMode: 'loop' })

// In render loop:
mixer.update(clock.getDelta())
// bloom.strength is now animated
```

### Driving ecosystem parameters

```javascript
import { SubdivisionModifier } from '@st-modifier-core'
import { Bloom } from '@st-compositor-core'
import { KeyframeTrack, AnimationClip, AnimationMixer } from '@st-keyframe'

const subdiv = new SubdivisionModifier({ levels: 1 })
const bloom  = new Bloom({ strength: 0 })

const clip = new AnimationClip('intro', [
  new KeyframeTrack(subdiv.parameters, 'levels',   [{ time:0,value:1 },{ time:3,value:3 }]),
  new KeyframeTrack(bloom.parameters,  'strength', [{ time:0,value:0 },{ time:3,value:2 }]),
])
mixer.play(clip, { wrapMode: 'once' })
```

### buildClip — fluent multi-target helper

```javascript
import { buildClip, easeInOutSine } from '@st-keyframe'

const clip = buildClip('dissolve', [
  { time: 0, targets: [[bloom.parameters, { strength: 0, threshold: 0.8 }]] },
  { time: 2, targets: [[bloom.parameters, { strength: 1.5, threshold: 0.2 }]], easing: easeInOutSine },
  { time: 4, targets: [[bloom.parameters, { strength: 0, threshold: 0.8 }]] },
])
```

### WrapMode options

| wrapMode | Behaviour |
|---|---|
| `'once'` | Plays to end and stops. `action.playing` becomes false. |
| `'loop'` | Restarts from beginning when clip ends. |
| `'pingpong'` | Reverses direction at both ends. |

### Available easings

Linear, Constant (step), Quadratic, Cubic, Quartic, Sine, Expo, Circ, Elastic, Back, Bounce — all with In/Out/InOut variants (30 total). Blender aliases: `Easings.LINEAR`, `Easings.BEZIER`, `Easings.SINE`, etc.

→ See [`examples/example-keyframe-core.html`](examples/example-keyframe-core.html)

---

## @st-curve-core — Bezier / NURBS / Catmull-Rom Curves

Blender-matched curve types with tube / bevel geometry generation and path-follow.

### Quick start

```javascript
import { CatmullRomCurve, CurveTube } from '@st-curve-core'

const curve = new CatmullRomCurve([
  new THREE.Vector3(-3,0,0), new THREE.Vector3(-1,2,1),
  new THREE.Vector3(1,-1,-1), new THREE.Vector3(3,1,0),
])

const geo  = new CurveTube({ radius: 0.12, tubularSegments: 64 }).apply(curve)
scene.add(new THREE.Mesh(geo, mat))
```

### Curve types

| Class | Blender equivalent | Description |
|---|---|---|
| `CatmullRomCurve` | Path / NURBS Path | All points lie ON the curve. Best for camera paths. |
| `BezierCurve` | Bezier spline | Full handle control. `buildAutoHandles(anchors)` for smooth auto-handles. |
| `NURBSCurve` | NURBS spline | Exact circles via `buildNURBSCircle(r)`. Weights control pull-strength. |

### Geometry

```javascript
new CurveTube({ radius: 0.1, tubularSegments: 64, radialSegments: 12 }).apply(curve)
new CurveBevel(CurveBevel.star(0.12, 0.05, 5), { tubularSegments: 64 }).apply(curve)
new CurveLine({ points: 128 }).apply(curve)  // for THREE.Line
```

### Path-follow with st-keyframe

```javascript
import { PathFollow } from '@st-curve-core'
import { AnimationMixer, AnimationClip, KeyframeTrack, linear } from '@st-keyframe'

const follow = new PathFollow(curve)
const mixer  = new AnimationMixer()
mixer.play(new AnimationClip('fly', [
  new KeyframeTrack(follow.parameters, 'offset', [{ time:0,value:0,easing:linear },{ time:5,value:1 }]),
]), { wrapMode: 'loop' })

// Render loop:
mixer.update(delta)
follow.apply(myObject)  // positions + orients Object3D along curve
```

→ See [`examples/example-curve-core.html`](examples/example-curve-core.html)

---

## @st-animation-core — Shape Keys · Armature · NLA

Blender-matched morph targets, bone FK/IK, CPU skinning, and NLA layered animation.

### Shape Keys

```javascript
import { ShapeKeyMesh, shapeKeyFromGeometry } from '@st-animation-core'

const mesh = new ShapeKeyMesh(geo, mat)
mesh.addShapeKey(shapeKeyFromGeometry('smile', smilingGeo))
mesh.parameters.smile = 0.8
mesh.update()   // must call every frame
```

### Armature (FK + IK)

```javascript
import { Armature } from '@st-animation-core'
import { KeyframeTrack, AnimationClip, AnimationMixer } from '@st-keyframe'

const arm = new Armature([
  { name: 'hips',  head: new THREE.Vector3(0,0,0), tail: new THREE.Vector3(0,1,0) },
  { name: 'spine', head: new THREE.Vector3(0,1,0), tail: new THREE.Vector3(0,2,0), parent: 'hips' },
])

// Animate with st-keyframe
const mixer = new AnimationMixer()
mixer.play(new AnimationClip('walk', [
  new KeyframeTrack(arm.pose.hips.parameters, 'rotationX', [...])
]))

// Render loop:
mixer.update(delta)
arm.update()            // recompute world matrices
skin.apply()            // CPU deform geometry
```

### NLA

```javascript
import { NLATrack, NLAEditor } from '@st-animation-core'

const nla = new NLAEditor()
nla.addTrack(new NLATrack('body', [
  { name:'Walk', clip:walkClip, start:0, end:10, influence:1, repeat:true, extrapolation:'hold' },
]))
nla.addTrack(new NLATrack('arm', [
  { name:'Wave', clip:waveClip, start:3, end:6, influence:1, repeat:false, extrapolation:'nothing' },
]))

// Render loop:
nla.update(clock.getDelta())
```

→ See [`examples/example-animation-core.html`](examples/example-animation-core.html)

---

## @st-physics-core — Cloth Simulation

Blender-matched cloth using Verlet integration, structural/shear/bend springs, and pluggable colliders.

### Hanging Flag

```typescript
import { ClothSimulator, WindForce } from '@st-physics-core'

const cloth = new ClothSimulator(24, 16, {
  gravity:    9.8,   // Blender: Field Weights > Gravity
  stiffness:  0.8,   // Blender: Cloth > Stiffness > Tension
  bending:    0.2,   // Blender: Cloth > Stiffness > Bending
  damping:    0.01,
  iterations: 8,
  substeps:   4,
})

const geometry = new THREE.PlaneGeometry(3, 2, 24, 16)
cloth.setFromGeometry(geometry)
cloth.pinColumn(0)  // left edge pinned — flag on a pole

const wind = new WindForce({ direction: [1, 0.1, 0], strength: 5, turbulence: 0.4 })
cloth.setWind(wind)

// In animation loop:
cloth.step(Math.min(clock.getDelta(), 0.05))
cloth.apply(geometry)
```

### Colliders

```typescript
import { PlaneCollider, SphereCollider, CapsuleCollider } from '@st-physics-core'

const floor  = new PlaneCollider({ point: [0, 0, 0], normal: [0, 1, 0] })
const sphere = new SphereCollider({ center: [0, 1, 0], radius: 0.8 })
const arm    = new CapsuleCollider({ a: [0, 0, 0], b: [0, 1.5, 0], radius: 0.15 })

cloth.addCollider(floor)
cloth.addCollider(sphere)

// Animate sphere position:
sphere.parameters.centerX = Math.sin(t)
```

### Animate with st-keyframe

```typescript
const track = new KeyframeTrack(wind.parameters, 'strength', [
  { time: 0, value: 2 },
  { time: 3, value: 15, easing: 'easeInOutSine' },
  { time: 6, value: 2 },
])
```

→ See [`examples/example-physics-core.html`](examples/example-physics-core.html)

---

## @st-geometry-nodes — Procedural Geometry

Blender Geometry Nodes-style DAG — primitives, operations, and instancing that produce `BufferGeometry`.

### Primitives

```typescript
import { Grid, UVSphere, IcoSphere, Cube, Cylinder, Cone, Circle } from '@st-geometry-nodes'

const sphere = new UVSphere({ radius: 2, segments: 32, rings: 16 })
const geo    = sphere.output('Geometry').evaluate()  // → THREE.BufferGeometry
```

### Graph Operations

```typescript
import { IcoSphere, SubdivisionSurface, TransformGeometry, JoinGeometry } from '@st-geometry-nodes'

const ico = new IcoSphere({ subdivisions: 0 })
const sub = new SubdivisionSurface({ geometry: ico.output('Geometry'), level: 3 })
const geo = sub.output('Geometry').evaluate()
```

### Scatter + Instance

```typescript
import { UVSphere, DistributePointsOnFaces, InstanceOnPoints, Cone } from '@st-geometry-nodes'

const sphere = new UVSphere({ radius: 2 })
const pts    = new DistributePointsOnFaces({ mesh: sphere.output('Geometry'), count: 200, seed: 42 })
const spike  = new Cone({ vertices: 5, radius: 0.06, depth: 0.4 })
const iop    = new InstanceOnPoints({
  points:        pts.output('Points'),
  instance:      spike.output('Geometry'),
  alignToNormal: true,
  scale:         (i, n) => 0.5 + 0.5 * Math.sin(i / n * Math.PI * 8),
})
const geo = iop.output('Geometry').evaluate()
```

### SetPosition — terrain

```typescript
import { Grid, SetPosition } from '@st-geometry-nodes'

const grid    = new Grid({ sizeX: 10, sizeY: 10, vertsX: 60, vertsY: 60 })
const terrain = new SetPosition({
  geometry: grid.output('Geometry'),
  offset:   (i, n) => [0, 0, Math.sin(i * 0.3) * Math.cos(i * 0.2) * 0.8],
})
```

→ See [`examples/example-geometry-nodes.html`](examples/example-geometry-nodes.html)

---

---

## Keyed Physics — `st-particle-core`

Blends particle positions/velocities between target particle systems. Drive `parameters.blend` with GSAP or st-keyframe.

```typescript
import { ParticleSystem, KeyedPhysics } from '@st-particle-core'

const targetA = new ParticleSystem({ count: 200 })
const targetB = new ParticleSystem({ count: 200 })
// ... run each target system independently ...

const sys  = new ParticleSystem({ count: 200 })
const keyed = new KeyedPhysics([targetA, targetB])
sys.setKeyedPhysics(keyed)

// Animate blend 0→1 with GSAP:
gsap.to(keyed.parameters, { blend: 1, duration: 2 })

// In render loop:
sys.step(dt)
```

`blend` is a continuous 0..N-1 float — fractional values lerp between adjacent targets.

---

## Strand Renderer — `st-particle-core`

Renders each alive particle as a strand (hair, grass, fur). Define the strand shape with a callback — integrates with `st-hair-core` without a hard import.

```typescript
import { ParticleSystem, PointEmitter, StrandRenderer } from '@st-particle-core'

const renderer = new StrandRenderer({
  maxCount: 500,
  segments: 8,
  mode: 'line',   // or 'tube' for mesh strands that accept lighting
  strandCurve: (p, t) => ({
    x: p.position.x + Math.sin(t * Math.PI * 2) * 0.05,
    y: p.position.y + t * 0.4,
    z: p.position.z,
  }),
  material: new THREE.LineBasicMaterial({ color: 0x55cc55 }),
})

const sys = new ParticleSystem({ count: 500 })
sys.addEmitter(new PointEmitter({ spreadX: 2, spreadZ: 2, lifetime: 99999 }))
sys.setRenderer(renderer)
scene.add(renderer.object3D)
```

To use `st-hair-core` strand shapes (no cross-package import needed):
```typescript
import { StrandGenerator } from 'st-hair-core'
const gen = new StrandGenerator({ length: 0.4, gravity: 0.3 })
const renderer = new StrandRenderer({
  strandCurve: (p, t) => gen.samplePoint(p.position, p.velocity, t),
})
```

Live example: [`example-strand-renderer.html`](example-strand-renderer.html)

---

## Soft Body — `st-physics-core`

Verlet-integrated soft body mesh with edge springs, volume pressure, and shape matching.

```typescript
import { SoftBodySimulator, PlaneCollider } from '@st-physics-core'
import * as THREE from 'three'

const geo  = new THREE.SphereGeometry(0.8, 8, 8)
const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
scene.add(mesh)

const sim = new SoftBodySimulator({
  stiffness:           0.9,   // Blender: Soft Body > Edges > Pull
  pressure:            5,     // Blender: Soft Body > Self Collision
  damping:             0.05,
  shapeMatchStiffness: 0.1,   // Blender: Goal — attract to rest shape
})
sim.setFromGeometry(geo)
sim.addCollider(new PlaneCollider())   // floor

// Pin a vertex so the body hangs from it:
sim.pin(0)

// In render loop:
sim.step(dt)
sim.apply(geo)   // writes positions back, calls computeVertexNormals()
```

Live example: [`example-soft-body.html`](example-soft-body.html)

---

## Rigid Body — `st-physics-core`

Impulse-based rigid body world with sphere/box/capsule collision shapes.

```typescript
import { RigidBodyWorld } from '@st-physics-core'
import * as THREE from 'three'

const world = new RigidBodyWorld({ gravity: [0, -9.8, 0] })

// Static floor (mass 0 = immovable)
world.createBody({ shape: 'box', mass: 0, size: [10, 0.1, 10], position: [0, 0, 0] })

// Dynamic sphere
const ball = world.createBody({
  shape: 'sphere', mass: 1, size: 0.5,
  position: [0, 5, 0],
  restitution: 0.6,
})
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5), mat)
scene.add(ballMesh)

// Apply a force:
ball.applyForce(0, 0, -50)

// In render loop:
world.step(dt)
ballMesh.position.copy(ball.position)
ballMesh.quaternion.copy(ball.orientation)
```

All parameters on `world.parameters` (`gravityX/Y/Z`, `substeps`) and `body.parameters` (`mass`, `restitution`, `linearDamping`, etc.) are GSAP/st-keyframe driveable.

Live example: [`example-rigid-body.html`](example-rigid-body.html)

---

## Environment Texture — `st-shader-core`

Samples a cubemap with a reflection or custom direction vector. Pass the uniform name and bind a `CubeTexture` as a Three.js uniform.

```typescript
import { ShaderGraph, PrincipledBSDF, EnvironmentTexture } from '@st-shader-core'

const graph = new ShaderGraph()
const envTex = graph.add(new EnvironmentTexture({
  uniformName: 'u_envMap',
  roughness:   0.1,
}))
const bsdf = graph.add(new PrincipledBSDF())
graph.connect(envTex, 'Color', bsdf, 'Emission')

const mat = graph.compile()
// Bind the cubemap:
mat.uniforms['u_envMap'] = { value: cubeTexture }
scene.environment = cubeTexture
```

---

## Seam-Aware UV Unwrapping — `st-uv-core`

Mark seams on geometry before unwrapping — LSCM and ABF will treat seam edges as cuts, allowing closed meshes to unfold correctly.

```typescript
import { MarkSeams, ConformalLSCM } from '@st-uv-core'
import * as THREE from 'three'

const geo = new THREE.TorusGeometry(1, 0.3, 16, 32)

// Mark seams (edge vertex index pairs)
const marker = new MarkSeams()
marker.markEdge(geo, 0, 1)
// geo.userData.seams is now populated

// Unwrap — seams are automatically read
const lscm = new ConformalLSCM()
const result = lscm.unwrap(geo)
geo.setAttribute('uv', result.uvAttribute)
```

---

## Coming Soon

- **`st-fluid-core`** — SPH fluid particles (unlocks SPHPhysics stub)
- **`st-particle-core` Phase 6** — SPH physics type (blocked by st-fluid-core)
- **Rigid body constraints** — Fixed / Hinge / Slider joints

Check `BACKLOG.md` for the full roadmap.
