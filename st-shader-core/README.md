# @st-shader-core

GLSL shader library for Three.js with a Blender-inspired workflow.

## Installation

```bash
npm install @st-shader-core three
```

## Quick Start

```typescript
import { perlinNoise, colorRamp } from '@st-shader-core'
import * as THREE from 'three'

const noiseShader = perlinNoise('vUv', { scale: 2.0 })
const colorShader = colorRamp('noiseValue', ['#000000', '#00aaff', '#ffffff'])

const material = new THREE.ShaderMaterial({
  uniforms: { ...noiseShader.uniforms, ...colorShader.uniforms },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    ${noiseShader.glsl}
    ${colorShader.glsl}
    void main() {
      gl_FragColor = vec4(rampColor, 1.0);
    }
  `
})
```

## API

### Noise Functions

#### `perlinNoise(uv, options?): ShaderOutput`
Smooth gradient noise — equivalent to Blender's Noise Texture node.

```typescript
perlinNoise('vUv', { scale: 2.0, seed: 42 })
// Outputs: float noiseValue
```

#### `voronoiNoise(uv, options?): ShaderOutput`
Cellular / Worley noise — equivalent to Blender's Voronoi Texture node.

```typescript
voronoiNoise('vUv', { scale: 3.0 })
// Outputs: float voronoiValue
```

### Color Functions

#### `colorRamp(value, colors?): ShaderOutput`
Maps a float value to a color gradient — equivalent to Blender's ColorRamp node.

```typescript
colorRamp('noiseValue', ['#000000', '#ff6600', '#ffffff'])
// Outputs: vec3 rampColor
```

#### `principalBSDF(baseColor, roughness?, metallic?): ShaderOutput`
Simplified PBR shading — equivalent to Blender's Principled BSDF node.

```typescript
principalBSDF('rampColor', '0.3', '0.8')
// Outputs: vec3 bsdf
```

### ShaderOutput type

```typescript
type ShaderOutput = {
  glsl: string                      // GLSL code to inject
  type: 'float' | 'vec2' | 'vec3' | 'vec4'
  uniforms?: Record<string, unknown> // Spread into ShaderMaterial uniforms
}
```

## License

MIT
