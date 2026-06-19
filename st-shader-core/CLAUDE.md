# @st-shader-core — Claude Code Guide

## Purpose
Blender-style shader node system for Three.js.
Builds complex GLSL materials through composable node classes — no raw GLSL required.
Mirrors Blender's shader editor: same node names, same socket names, same wiring logic.

## Critical Rules
NEVER write raw GLSL strings when this package is available.
NEVER use THREE.ShaderMaterial directly — always go through MaterialOutput.compile().
ALWAYS use node classes to build materials.
ALWAYS end every material graph with MaterialOutput.
Math is exported as ShaderMath to avoid clashing with JavaScript's built-in Math object.
Color inputs (hex or [r,g,b] array, unconnected) are live uniform vec3 — animatable via node.parameters.colorName = [r,g,b].

---

## Socket Type Rules — CRITICAL
```
'vector' = vec2  — UV coordinates and 2D spatial inputs ONLY
'color'  = vec3  — RGB colours, normals, positions, directions
'float'  = float — single scalar value
'shader' = vec3  — BSDF output (connects to MaterialOutput.surface)
```
Normal map outputs MUST use 'color' type (vec3), NOT 'vector' (vec2).
Any node input that accepts a normal map MUST be typed 'color', not 'vector'.

---

## Core Pattern

```typescript
// Define material once — like naming it in Blender
const noise = new NoiseTexture({ scale: 3.0 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#001133', '#00ffcc'] })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.3 })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

// Assign to any mesh — like the material slot in Blender
const torus  = new THREE.Mesh(torusGeo,  mat.material)
const sphere = new THREE.Mesh(sphereGeo, mat.material)
```

compile() runs once. mat.material is a THREE.ShaderMaterial. Reuse across any number of meshes.

---

## Error Configuration

```typescript
ShaderConfig.errorLevel = 'verbose'   // development — full errors with fix suggestions
ShaderConfig.errorLevel = 'standard'  // production default (catches API/dependency breaks)
ShaderConfig.errorLevel = 'off'       // maximum performance
```

Always use 'verbose' during development.

---

## Complete Node Reference (67 nodes)

### Input Nodes — outputs only, source of data

| Node | Outputs | Notes |
|---|---|---|
| `TextureCoordinate` | UV (vector), Generated (vector), Normal (color) | |
| `Value(number)` | Value (float) | constant float |
| `RGB(hexString)` | Color (color) | constant colour |
| `Geometry` | Position, Normal, TrueNormal, Incoming (color), Backfacing (float) | |
| `LayerWeight(blend)` | Fresnel (float), Facing (float) | edge blending |
| `CameraData` | ViewDistance (float), ViewZDepth (float), ViewVector (color) | |
| `UVMap` | UV (vector) | mesh UV channel |
| `Tangent` | Tangent (color), Bitangent (color) | for anisotropy |
| `ColorAttribute` | Color (color), Alpha (float) | vertex colours |
| `Wireframe(thickness)` | Fac (float) | polygon edge mask |
| `HairInfo` | — | reads `strandTangent`/`strandRandom` attributes from st-hair-core geometry |

### Output Nodes — terminal, owns compile()

| Node | Inputs | Notes |
|---|---|---|
| `MaterialOutput` | surface* (shader), volume, displacement, thickness | *required |
| `Displacement` | height (float), midlevel, scale, normal | feeds MaterialOutput.displacement |

### Texture Nodes

| Node | Key Inputs | Outputs |
|---|---|---|
| `NoiseTexture` | scale, detail, roughness, distortion, vector | Fac (float), Color (color) |
| `AnimatedNoiseTexture` | scale, detail, roughness, speed, vector | Fac (float), Color (color) — needs `time` uniform |
| `VoronoiTexture` | scale, smoothness, feature, vector | Distance (float), Color (color) |
| `WaveTexture` | scale, distortion, detail, waveType, profile | Fac (float), Color (color) |
| `GradientTexture` | vector, type | Fac (float), Color (color) |
| `BrickTexture` | scale, color1, color2, mortar, mortarSize, brickWidth, rowHeight | Color (color), Fac (float) |
| `CheckerTexture` | scale, color1, color2, vector | Color (color), Fac (float) |
| `MagicTexture` | scale, distortion, vector | Color (color), Fac (float) |
| `MusgraveTexture` | scale, detail, dimension, lacunarity, type | Fac (float), Color (color) |
| `WhiteNoise` | vector | Value (float), Color (color) |
| `ImageTexture({ uniformName })` | vector | Color (color), Alpha (float) |
| `EnvironmentTexture({ uniformName })` | vector (color), roughness | Color (color) — samples a samplerCube; default vector is reflected view dir |

AnimatedNoiseTexture requires post-compile time injection:
```typescript
mat.compile()
mat.material.uniforms.time = { value: 0 }
// in animate(): mat.material.uniforms.time.value = clock.getElapsedTime()
```

ImageTexture requires post-compile texture injection:
```typescript
const node = new ImageTexture({ uniformName: 'uAlbedo' })
mat.compile()
mat.material.uniforms.uAlbedo = { value: new THREE.TextureLoader().load('path.jpg') }
```

### Color Nodes

| Node | Key Inputs | Outputs |
|---|---|---|
| `ColorRamp` | fac (float), stops (string[]) | Color (color) |
| `MixRGB` | mode, fac, colorA, colorB, clamp | Color (color) |
| `HueSaturationValue` | hue, saturation, value, fac, color | Color (color) |
| `BrightContrast` | color, bright, contrast | Color (color) |
| `RGBtoBW` | color | Val (float) |
| `Blackbody` | temperature (Kelvin) | Color (color) |
| `Gamma` | color, gamma | Color (color) |
| `InvertColor` | color, fac | Color (color) |
| `RGBCurves` | color, fac, rGamma, gGamma, bGamma, rBlack... | Color (color) |
| `Wavelength` | wavelength (nm, 380–780) | Color (color) |

MixRGB modes: 'MIX' | 'DARKEN' | 'MULTIPLY' | 'BURN' | 'LIGHTEN' | 'SCREEN' |
'DODGE' | 'ADD' | 'OVERLAY' | 'SOFT_LIGHT' | 'LINEAR_LIGHT' |
'DIFFERENCE' | 'EXCLUSION' | 'SUBTRACT' | 'DIVIDE'

### Vector Nodes

| Node | Key Inputs | Outputs |
|---|---|---|
| `NormalMap` | fac (float), strength | Normal (color) |
| `Bump` | height (float), strength, distance, normal | Normal (color) |
| `Mapping` | vector, location, rotation (deg), scale | Vector (color) |
| `VectorMath` | mode, vector, vectorB, scale | Vector (color), Value (float) |
| `SeparateRGB` | color | R, G, B (float) |
| `CombineRGB` | r, g, b (float) | Color (color) |
| `SeparateXYZ` | vector | X, Y, Z (float) |
| `CombineXYZ` | x, y, z (float) | Vector (color) |
| `Normal` | normal, direction ([x,y,z]) | Normal (color), Dot (float) |
| `VectorRotate` | mode, vector, axis, angle | Vector (color) |
| `VectorTransform` | vector, fromSpace, toSpace, type | Vector (color) |
| `VectorCurves` | vector, fac, xGamma, yGamma, zGamma | Vector (color) |

VectorMath modes: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'SCALE' |
'LENGTH' | 'NORMALIZE' | 'DOT_PRODUCT' | 'CROSS_PRODUCT' | 'REFLECT' |
'REFRACT' | 'ABSOLUTE' | 'MINIMUM' | 'MAXIMUM' | 'FLOOR' | 'CEIL' |
'FRACTION' | 'MODULO' | 'SNAP' | 'SINE' | 'COSINE' | 'TANGENT' | 'DISTANCE'

### Shader Nodes

| Node | Key Inputs | Outputs |
|---|---|---|
| `PrincipledBSDF` | baseColor, metallic, roughness, ior, alpha, normal | BSDF (shader) |
| `DiffuseBSDF` | color, roughness, normal | BSDF (shader) |
| `GlossyBSDF` | color, roughness, normal | BSDF (shader) |
| `GlassBSDF` | color, roughness, ior, normal | BSDF (shader) |
| `RefractionBSDF` | color, roughness, ior, normal | BSDF (shader) |
| `SheenBSDF` | color, roughness, normal | BSDF (shader) |
| `SubsurfaceScattering` | color, scale, radius ([r,g,b]), normal | BSDF (shader) |
| `ToonBSDF` | color, size, smooth, normal | BSDF (shader) |
| `SpecularBSDF` | baseColor, specular (color), roughness, normal | BSDF (shader) |
| `TranslucentBSDF` | color, normal | BSDF (shader) |
| `PrincipledHair` | color, roughness, radialRoughness, coat, ior, offset, randomColor, randomRoughness, random, tangent | BSDF (shader) — Kajiya-Kay dual-lobe hair |
| `Emission` | color, strength | BSDF (shader) |
| `MixShader` | fac, shader1, shader2 | BSDF (shader) |
| `AddShader` | shader1, shader2 | BSDF (shader) |
| `Fresnel` | ior, normal (color) | Fac (float) |

### Converter Nodes

| Node | Key Inputs | Outputs |
|---|---|---|
| `ShaderMath` | mode, a, b, c, clamp | Value (float) |
| `Clamp` | value, min, max | Result (float) |
| `MapRange` | value, fromMin, fromMax, toMin, toMax, mode, clamp | Result (float) |
| `FloatCurve` | value, fac, points ([[x,y]...]) | Value (float) |
| `ShaderToRGB` | shader | Color (color), Alpha (float) |

ShaderMath modes: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'POWER' |
'LOGARITHM' | 'SQRT' | 'INV_SQRT' | 'ABSOLUTE' | 'ROUND' | 'FLOOR' |
'CEIL' | 'TRUNCATE' | 'FRACTION' | 'MINIMUM' | 'MAXIMUM' | 'LESS_THAN' |
'GREATER_THAN' | 'CLAMP' | 'SNAP' | 'SINE' | 'COSINE' | 'TANGENT' |
'ARCSINE' | 'ARCCOSINE' | 'ARCTANGENT' | 'ARCTAN2' | 'MODULO' |
'WRAP' | 'PINGPONG' | 'SMOOTH_MIN' | 'SMOOTH_MAX'

MapRange modes: 'LINEAR' | 'STEPPED' | 'SMOOTHSTEP' | 'SMOOTHERSTEP'

---

## Material Class Pattern
Wrap each material in a class — like a named material in Blender.

```typescript
class OceanMaterial {
  constructor() {
    const wave  = new AnimatedNoiseTexture({ scale: 3.0, speed: 0.5 })
    const ramp  = new ColorRamp({ fac: wave.output('Fac'), stops: ['#001428', '#00aacc'] })
    const bump  = new Bump({ height: new RGBtoBW({ color: wave.output('Color') }).output('Val'), strength: 3.0 })
    const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), normal: bump.output('Normal') })
    this._output = new MaterialOutput({ surface: bsdf.output('BSDF') })
    this._output.compile()
    this._output.material.uniforms.time = { value: 0 }
  }
  get material() { return this._output.material }
  tick(t) { this.material.uniforms.time.value = t }
}

const mat   = new OceanMaterial()
const mesh  = new THREE.Mesh(geo, mat.material)
// in animate(): mat.tick(clock.getElapsedTime())
```

---

## GLSL Override System
Override prebaked GLSL per-class or per-instance.

```typescript
// Per-class — affects ALL instances
NoiseTexture.glslFunction = `float _st_noiseTexture(...) { ... }`

// Per-instance — affects only this node
const noise = new NoiseTexture({ scale: 2.0 })
noise.glslFunction = `float _st_noiseTexture(...) { ... }`
```

Override priority: per-instance → per-class → built-in prebaked

---

## Usage with @three-radius-parametric

```typescript
import { RadiusParametricGeometry } from '@three-radius-parametric'
import { NoiseTexture, ColorRamp, PrincipledBSDF, MaterialOutput } from '@st-shader-core'

const geo  = new RadiusParametricGeometry((u, v) => 1 + 0.3 * Math.sin(u * Math.PI * 2), (u, v) => v - 0.5)
const noise = new NoiseTexture({ scale: 3.0 })
const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#000', '#fff'] })
const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color') })
const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()

scene.add(new THREE.Mesh(geo, mat.material))
```

---

## Performance Notes
- compile() runs once — never call it inside an animation loop
- mat.material is a THREE.ShaderMaterial — reuse across as many meshes as needed
- AnimatedNoiseTexture: limit to 2 instances per material on mobile (4 noise layers each)
- VoronoiTexture and MusgraveTexture: heavy — use sparingly
- Node metadata.cost: 'low' | 'medium' | 'high' — check before stacking expensive nodes
- Generated GLSL matches or beats handwritten equivalent

---

## What NOT to Do

```typescript
// WRONG — never raw GLSL
new THREE.ShaderMaterial({ fragmentShader: `void main() { ... }` })

// WRONG — never skip MaterialOutput
bsdf.compile()  // does not exist on ProcessNode

// WRONG — never use Math directly (conflicts with JS Math)
import { Math } from '@st-shader-core'  // wrong
import { ShaderMath } from '@st-shader-core'  // correct

// WRONG — vector type for normals
new InputSocket('normal', 'vector', null)  // wrong — vector is vec2
new InputSocket('normal', 'color',  null)  // correct — color is vec3

// CORRECT
const bsdf = new PrincipledBSDF({ roughness: 0.5 })
const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
mat.compile()
scene.add(new THREE.Mesh(geo, mat.material))
```
