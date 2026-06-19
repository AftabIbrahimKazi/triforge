# st-shader-core Tutorial

Blender-style shader node system for Three.js.
Build complex procedural materials by wiring nodes together — no raw GLSL required.
Updated automatically whenever new nodes or features are added.

---

## Core Concept

Every material is a graph of nodes. Data flows from left to right:

```
[Texture/Input nodes]  →  [Process nodes]  →  MaterialOutput
```

`MaterialOutput.compile()` turns the graph into a `THREE.ShaderMaterial`.
Call it once. Reuse the material on any number of meshes.

---

## Minimal Example

```javascript
import { NoiseTexture, ColorRamp, PrincipledBSDF, MaterialOutput } from './dist/index.js'

const noise = new NoiseTexture({ scale: 3.0 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#000000', '#ffffff'] })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.5 })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

const mesh = new THREE.Mesh(geometry, mat.material)
scene.add(mesh)
```

---

## Socket Types

Every connection between nodes has a type. Use the wrong type and the node will throw an error in verbose mode.

| Type | GLSL | Use for |
|---|---|---|
| `'float'` | `float` | Single numbers — roughness, strength, scale |
| `'color'` | `vec3` | RGB colors, normals, positions, directions |
| `'vector'` | `vec2` | UV coordinates and 2D spatial inputs ONLY |
| `'shader'` | `vec3` | BSDF outputs — connects to MaterialOutput.surface |

**Critical:** normals are `'color'` (vec3), NOT `'vector'` (vec2).

---

## Error Levels

```javascript
import { ShaderConfig } from './dist/index.js'

ShaderConfig.errorLevel = 'verbose'   // development — full errors with fix suggestions
ShaderConfig.errorLevel = 'standard'  // production default
ShaderConfig.errorLevel = 'off'       // maximum performance — no checks
```

Always use `'verbose'` while building materials.

---

## Node Categories

### Input Nodes — source of data, no inputs

| Node | What It Does | Outputs |
|---|---|---|
| `new Value(0.5)` | Constant float | Value (float) |
| `new RGB('#ff0000')` | Constant color | Color (color) |
| `new TextureCoordinate()` | UV, Generated, Normal coordinates | UV (vector), Generated (vector), Normal (color) |
| `new Geometry()` | Surface data from the mesh | Position, Normal, TrueNormal, Incoming (color), Backfacing (float) |
| `new UVMap()` | Mesh UV channel | UV (vector) |
| `new LayerWeight(0.5)` | Edge blending factor | Fresnel (float), Facing (float) |
| `new CameraData()` | Camera-relative values | ViewDistance (float), ViewZDepth (float), ViewVector (color) |
| `new Tangent()` | Surface tangent/bitangent | Tangent (color), Bitangent (color) |
| `new ColorAttribute()` | Vertex colors | Color (color), Alpha (float) |
| `new Wireframe(0.01)` | Polygon edge mask | Fac (float) |
| `new ObjectInfo()` | Per-object random/index for procedural variation | Random (float), ObjectIndex (float), MaterialIndex (float) |
| `new Attribute('name', 'vec3')` | Named custom geometry attribute (vec3 or float) | Fac (float), Vector (color) |
| `new AmbientOcclusion()` | Approximate hemisphere SSAO | Color (color, AO-darkened), AO (float) |

---

### Attribute Node

Reads any named `BufferAttribute` from the geometry. Use this to drive shading from data baked into the mesh — vertex paint, heat maps, foam, wear masks, etc.

```javascript
import { Attribute, ColorRamp, PrincipledBSDF, MaterialOutput } from '@st-shader-core'

// --- vec3 attribute ("paint" = RGB vertex colour stored on the geometry) ---
const attr = new Attribute('paint', 'vec3')
// attr.output('Vector') → the raw vec3 value
// attr.output('Fac')    → length of the vec3

const bsdf = new PrincipledBSDF({ baseColor: attr.output('Vector'), roughness: 0.5 })
const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// Geometry must have a BufferAttribute named 'paint' with itemSize 3
const paintData = new Float32Array(geo.attributes.position.count * 3)
// ... fill paintData ...
geo.setAttribute('paint', new THREE.BufferAttribute(paintData, 3))
const mesh = new THREE.Mesh(geo, mat.material)

// --- float attribute ("heat" = scalar value per vertex) ---
const heatAttr = new Attribute('heat', 'float')
// heatAttr.output('Fac')    → the raw float value
// heatAttr.output('Vector') → vec3(value, value, value)

const ramp = new ColorRamp({ fac: heatAttr.output('Fac'), stops: ['#0000ff', '#ff0000'] })
const mat2 = new MaterialOutput({ surface: new PrincipledBSDF({ baseColor: ramp.output('Color') }).output('BSDF') })
// (must connect via proper node wiring — shown inline for brevity)
```

**Notes:**
- The attribute name is sanitized automatically for GLSL (non-alphanumeric chars → `_`).
- `parameters.attributeType` stores `0` (vec3) or `1` (float) for keyframe/GSAP compat.
- The attribute name itself is a readonly string field (`node.attributeName`), not in `parameters`.

---

### AmbientOcclusion Node

Approximates ambient occlusion in the fragment shader using a 16-sample hemisphere kernel. No depth buffer or additional render passes required — it works in standard forward rendering.

**Important:** This is a screen-space *approximation*, not true ray-traced AO. Results are best on convex shapes or as a subtle darkening pass. For physically accurate AO use a path tracer.

```javascript
import { AmbientOcclusion, PrincipledBSDF, MaterialOutput, RGB } from '@st-shader-core'

const ao  = new AmbientOcclusion({ color: '#c8d0e0' })   // input color to attenuate
ao.parameters.samples  = 12   // hemisphere samples [1–16], default 8
ao.parameters.distance = 0.4  // sampling radius in world units, default 0.5
ao.parameters.inside   = 0    // 0 = exterior AO (default), 1 = interior/cavity

// Color output is the input color darkened by the AO factor
// AO    output is the raw [0–1] occlusion value
const bsdf = new PrincipledBSDF({ baseColor: ao.output('Color'), roughness: 0.7 })
const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()
const mesh = new THREE.Mesh(geometry, mat.material)
```

**Tuning tips:**
- Increase `samples` (up to 16) for smoother AO at the cost of more fragment shader ALU.
- Increase `distance` to capture wider occlusion (crevices further apart).
- Set `inside = 1` to brighten interior-facing surfaces instead of darkening them.
- AO works best on geometry with tight crevices or complex topology (torus knots, rocks, etc.).

---

### Texture Nodes

```javascript
// Noise — organic, random surface patterns
const noise = new NoiseTexture({ scale: 4.0, detail: 6.0, roughness: 0.6, distortion: 0.2 })
noise.output('Fac')    // float — single noise value
noise.output('Color')  // color — noise as RGB

// Animated Noise — same as above but moves over time
const aNoise = new AnimatedNoiseTexture({ scale: 3.0, speed: 0.5 })
mat.compile()
mat.material.uniforms.time = { value: 0 }
// in loop: mat.material.uniforms.time.value = clock.getElapsedTime()

// Voronoi — cellular pattern, all four Blender feature modes supported
const vor = new VoronoiTexture({ scale: 8.0, smoothness: 0.5, feature: 'F1' })
// feature: 'F1' | 'F2' | 'SMOOTH_F1' | 'DISTANCE_TO_EDGE'
// F1: nearest cell (classic), F2: second nearest, SMOOTH_F1: soft edges, DISTANCE_TO_EDGE: cell boundaries
vor.output('Distance')  // float
vor.output('Color')     // color (cell hash color)

// Wave — striped or ringed pattern
const wave = new WaveTexture({ scale: 5.0, distortion: 1.0, waveType: 'RINGS' })
// waveType: 'BANDS' | 'RINGS'

// Gradient — linear ramp from 0 to 1
const grad = new GradientTexture({ type: 'LINEAR' })
// type: 'LINEAR' | 'QUADRATIC' | 'EASING' | 'DIAGONAL' | 'RADIAL' | 'QUADRATIC_SPHERE' | 'SPHERICAL'

// Brick
const brick = new BrickTexture({ scale: 5.0, color1: '#cc3300', color2: '#884400', mortar: '#222222' })

// Checker
const check = new CheckerTexture({ scale: 4.0, color1: '#ffffff', color2: '#000000' })

// Magic — psychedelic color pattern
const magic = new MagicTexture({ scale: 3.0, distortion: 1.0 })

// Musgrave — fractal noise, good for terrain
const musg = new MusgraveTexture({ scale: 3.0, detail: 6.0, type: 'FBM' })
// type: 'FBM' | 'MULTIFRACTAL' | 'HYBRID_MULTIFRACTAL' | 'RIDGED_MULTIFRACTAL' | 'HETERO_TERRAIN'

// White Noise — pure random per point
const wn = new WhiteNoise()

// Image Texture — load an external image
const img = new ImageTexture({ uniformName: 'uAlbedo' })
mat.compile()
mat.material.uniforms.uAlbedo = { value: new THREE.TextureLoader().load('path/to/image.jpg') }
```

---

### Color Nodes

```javascript
// ColorRamp — map a float to a color gradient
const ramp = new ColorRamp({ fac: noise.output('Fac'), stops: ['#000000', '#ff6600', '#ffffff'] })

// MixRGB — blend two colors
const mix = new MixRGB({ mode: 'MULTIPLY', fac: 0.5, colorA: ramp.output('Color'), colorB: other.output('Color') })
// modes: 'MIX' | 'DARKEN' | 'MULTIPLY' | 'BURN' | 'LIGHTEN' | 'SCREEN' | 'DODGE' |
//        'ADD' | 'OVERLAY' | 'SOFT_LIGHT' | 'LINEAR_LIGHT' | 'DIFFERENCE' |
//        'EXCLUSION' | 'SUBTRACT' | 'DIVIDE'

// HueSaturationValue
const hsv = new HueSaturationValue({ hue: 0.5, saturation: 1.2, value: 1.0, color: ramp.output('Color') })

// BrightContrast
const bc = new BrightContrast({ color: ramp.output('Color'), bright: 0.1, contrast: 0.5 })

// RGBtoBW — convert color to grayscale float
const bw = new RGBtoBW({ color: noise.output('Color') })
bw.output('Val')  // float

// Gamma
const gamma = new Gamma({ color: ramp.output('Color'), gamma: 2.2 })

// InvertColor
const inv = new InvertColor({ color: ramp.output('Color'), fac: 1.0 })

// Blackbody — temperature in Kelvin to color (fire, stars)
const bb = new Blackbody({ temperature: 3000 })  // 1000K=red, 6500K=white, 10000K=blue

// Wavelength — wavelength in nm to color
const wl = new Wavelength({ wavelength: 550 })  // 380–780nm visible range

// RGBCurves — per-channel gamma correction
const curves = new RGBCurves({ color: ramp.output('Color'), fac: 1.0 })
```

---

### Vector Nodes

```javascript
// NormalMap — convert a color map to surface normals
const nmap = new NormalMap({ fac: noise.output('Fac'), strength: 1.0 })

// Bump — generate normals from a height map
const bump = new Bump({ height: bw.output('Val'), strength: 1.5, distance: 0.1 })

// Mapping — transform UV coordinates (location, rotation, scale)
const map = new Mapping({ vector: texCoord.output('UV'), scale: [2, 2, 1] })

// VectorMath — math operations on vectors
const vm = new VectorMath({ mode: 'NORMALIZE', vector: geom.output('Normal') })

// SeparateRGB / CombineRGB
const sep = new SeparateRGB({ color: noise.output('Color') })
sep.output('R')  // float
const comb = new CombineRGB({ r: sep.output('R'), g: 0.5, b: sep.output('B') })

// SeparateXYZ / CombineXYZ — same but for position/direction vectors
const sxyz = new SeparateXYZ({ vector: geom.output('Position') })
const cxyz = new CombineXYZ({ x: sxyz.output('X'), y: 0.0, z: sxyz.output('Z') })

// VectorRotate
const vrot = new VectorRotate({ mode: 'AXIS_ANGLE', vector: geom.output('Normal'), angle: 0.5 })

// VectorTransform — transform between coordinate spaces
const vtrans = new VectorTransform({ vector: geom.output('Normal'), fromSpace: 'WORLD', toSpace: 'OBJECT' })
```

---

### BSDF / Shader Nodes

```javascript
// PrincipledBSDF — all-purpose physically based material
const bsdf = new PrincipledBSDF({
  baseColor: ramp.output('Color'),
  metallic:  0.0,
  roughness: 0.5,
  ior:       1.45,
  alpha:     1.0,
  normal:    bump.output('Normal')
})

// DiffuseBSDF — matte surface
const diff = new DiffuseBSDF({ color: ramp.output('Color'), roughness: 0.5 })

// GlossyBSDF — mirror/metallic surface
const gloss = new GlossyBSDF({ color: new RGB('#ffffff').output('Color'), roughness: 0.1 })

// GlassBSDF — transparent glass
const glass = new GlassBSDF({ color: new RGB('#aaddff').output('Color'), roughness: 0.0, ior: 1.5 })

// Emission — glowing surface
const emit = new Emission({ color: new RGB('#ff6600').output('Color'), strength: 5.0 })

// MixShader — blend two shaders
const mixed = new MixShader({ fac: fresnel.output('Fac'), shader1: diff.output('BSDF'), shader2: gloss.output('BSDF') })

// AddShader — add two shaders together
const added = new AddShader({ shader1: bsdf.output('BSDF'), shader2: emit.output('BSDF') })

// Fresnel — edge factor based on viewing angle
const fres = new Fresnel({ ior: 1.45 })
fres.output('Fac')  // float — 0 at face, 1 at edges
```

---

### Converter Nodes

```javascript
// ShaderMath — math on floats
const math = new ShaderMath({ mode: 'MULTIPLY', a: noise.output('Fac'), b: 0.5 })
// modes: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'POWER' | 'SQRT' |
//        'ABSOLUTE' | 'MINIMUM' | 'MAXIMUM' | 'SINE' | 'COSINE' | 'FLOOR' |
//        'CEIL' | 'ROUND' | 'MODULO' | 'CLAMP' | 'LESS_THAN' | 'GREATER_THAN' | ...

// Clamp — limit a value to a range
const clamp = new Clamp({ value: noise.output('Fac'), min: 0.2, max: 0.8 })

// MapRange — remap a value from one range to another
const remap = new MapRange({ value: noise.output('Fac'), fromMin: 0.0, fromMax: 1.0, toMin: 0.3, toMax: 0.9 })

// FloatCurve — custom curve mapping
const fcurve = new FloatCurve({ value: noise.output('Fac'), points: [[0,0], [0.5, 0.8], [1.0, 1.0]] })

// ShaderToRGB — convert a shader to a color (for stylized/toon effects)
const s2rgb = new ShaderToRGB({ shader: bsdf.output('BSDF') })

// CombineColor — combine three floats into a color (RGB, HSV, or HSL mode)
const combRgb = new CombineColor({ red: 0.8, green: 0.3, blue: 0.1, mode: 'RGB' })
const combHsv = new CombineColor({ red: noise.output('Fac'), green: 0.8, blue: 0.6, mode: 'HSV' })
const combHsl = new CombineColor({ red: 0.3, green: 0.9, blue: 0.5, mode: 'HSL' })
// modes: 'RGB' | 'HSV' | 'HSL'

// SeparateColor — split a color into three floats (RGB, HSV, or HSL mode)
const sepRgb = new SeparateColor({ color: ramp.output('Color'), mode: 'RGB' })
sepRgb.output('Red')    // float — R in RGB, H in HSV/HSL
sepRgb.output('Green')  // float
sepRgb.output('Blue')   // float
const sepHsv = new SeparateColor({ color: ramp.output('Color'), mode: 'HSV' })
// modes: 'RGB' | 'HSV' | 'HSL'

// HashValue — hash any float to a stable pseudo-random value in [0,1]
const hash = new HashValue({ value: objInfo.output('Random') })
hash.output('Value')  // float — deterministic random, same input → same output
```

---

## Complete Material Examples

### Rock

```javascript
const noise   = new NoiseTexture({ scale: 4.0, detail: 8.0, roughness: 0.7 })
const voronoi = new VoronoiTexture({ scale: 10.0 })
const color   = new ColorRamp({ fac: noise.output('Fac'), stops: ['#2a1f0e', '#5c4a2a', '#8a7355'] })
const detail  = new MixRGB({ mode: 'MULTIPLY', fac: 0.4, colorA: color.output('Color'), colorB: voronoi.output('Color') })
const bump    = new Bump({ height: new RGBtoBW({ color: noise.output('Color') }).output('Val'), strength: 2.0 })
const bsdf    = new PrincipledBSDF({ baseColor: detail.output('Color'), roughness: 0.9, normal: bump.output('Normal') })
const mat     = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()
```

### Lava (animated)

```javascript
const noise = new AnimatedNoiseTexture({ scale: 2.5, detail: 5.0, speed: 0.2 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#0a0000', '#cc1100', '#ff6600', '#ffee00'] })
const emit  = new Emission({ color: ramp.output('Color'), strength: 3.0 })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 1.0 })
const mixed = new AddShader({ shader1: bsdf.output('BSDF'), shader2: emit.output('BSDF') })
const mat   = new MaterialOutput({ surface: mixed.output('BSDF') })
mat.compile()
mat.material.uniforms.time = { value: 0 }
// in loop: mat.material.uniforms.time.value = clock.getElapsedTime()
```

### Glass

```javascript
const glass = new GlassBSDF({ color: new RGB('#cceeff').output('Color'), roughness: 0.05, ior: 1.52 })
const mat   = new MaterialOutput({ surface: glass.output('BSDF') })
mat.compile()
```

### Toon / Stylized

```javascript
const toon  = new ToonBSDF({ color: new RGB('#3399ff').output('Color'), size: 0.5, smooth: 0.05 })
const mat   = new MaterialOutput({ surface: toon.output('BSDF') })
mat.compile()
```

---

## Live Parameters — GSAP & Keyframe Compatible

Every node exposes a `parameters` object containing all its scalar float inputs **and color inputs**.
After `compile()`, writing to `parameters` updates the live GPU uniform instantly — no recompile needed.

### Float parameters

```javascript
const noise = new NoiseTexture({ scale: 3.0, detail: 4.0 })
const bsdf  = new PrincipledBSDF({ roughness: 0.5, metallic: 0.0 })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// Direct mutation — instant GPU update
noise.parameters.scale = 10.0
bsdf.parameters.roughness = 0.2

// GSAP animation — drives parameters directly
gsap.to(noise.parameters, { scale: 8.0, duration: 2, ease: 'power2.inOut' })
gsap.to(bsdf.parameters,  { metallic: 1.0, roughness: 0.05, duration: 1.5 })
```

### Color parameters

Unconnected color inputs become live `uniform vec3` values. Set them as `[r, g, b]` arrays (0–1 range):

```javascript
const bsdf = new PrincipledBSDF({ baseColor: '#ff8800' })
const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// Direct mutation — instant GPU color update, no recompile
bsdf.parameters.baseColor = [1.0, 0.0, 0.0]   // switch to red

// Works with GSAP too (tweens each channel)
gsap.to(bsdf.parameters.baseColor, { 0: 0.0, 1: 0.5, 2: 1.0, duration: 2 })
```

**What has parameters:** all float inputs AND all unconnected color inputs (hex strings or `[r,g,b]` arrays).
**What does NOT have parameters:** mode strings, color stop arrays in ColorRamp — these are baked at compile time.
**Color inputs that are connected** (e.g. `baseColor: ramp.output('Color')`) follow the upstream node — no uniform is created for them.

---

## ObjectInfo — Procedural Variation Across Instances

Use `ObjectInfo` to make multiple meshes sharing one material look different without extra textures:

```javascript
const obj   = new ObjectInfo()
const hash  = new HashValue({ value: obj.output('Random') })
const ramp  = new ColorRamp({ fac: hash.output('Value'), stops: ['#220000', '#882200', '#cc6600'] })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color') })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// All 100 meshes share one material but look different
for (let i = 0; i < 100; i++) {
  scene.add(new THREE.Mesh(geo, mat.material))
}
```

---

## GLSL Override

Override the built-in GLSL for any node — per class or per instance:

```javascript
// All NoiseTexture instances use this
NoiseTexture.glslFunction = `float _st_noiseTexture(...) { ... }`

// Only this instance uses this
const noise = new NoiseTexture({ scale: 2.0 })
noise.glslFunction = `float _st_noiseTexture(...) { ... }`
```

---

## Performance Tips

- `compile()` runs once — never call it inside an animation loop
- Reuse `mat.material` across many meshes — it's just a `THREE.ShaderMaterial`
- Limit `AnimatedNoiseTexture` to 2 per material on mobile
- `VoronoiTexture` and `MusgraveTexture` are expensive — use sparingly
- Check `node.metadata.cost` (`'low'` | `'medium'` | `'high'`) before stacking expensive nodes
