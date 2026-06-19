import type { ShaderOutput, ShaderFunctionOptions } from '../types/shader.js'

/**
 * Perlin Noise — Blender Noise Texture node equivalent.
 * Output variable: noiseValue (float)
 */
export function perlinNoise(uv: string, options: ShaderFunctionOptions = {}): ShaderOutput {
  const scale = options.scale ?? 1.0
  const seed  = options.seed  ?? 0.0

  const defs = `
float _phash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

vec3 _pgrad(vec3 p) {
  float h = _phash(floor(p));
  return normalize(vec3(h, fract(h * 34.0), fract(h * 89.0)) * 2.0 - 1.0);
}

float perlinNoise(vec3 p) {
  vec3 pi = floor(p);
  vec3 pf = p - pi;
  vec3 u  = pf * pf * (3.0 - 2.0 * pf);
  float v000 = dot(_pgrad(pi + vec3(0,0,0)), pf - vec3(0,0,0));
  float v100 = dot(_pgrad(pi + vec3(1,0,0)), pf - vec3(1,0,0));
  float v010 = dot(_pgrad(pi + vec3(0,1,0)), pf - vec3(0,1,0));
  float v110 = dot(_pgrad(pi + vec3(1,1,0)), pf - vec3(1,1,0));
  float v001 = dot(_pgrad(pi + vec3(0,0,1)), pf - vec3(0,0,1));
  float v101 = dot(_pgrad(pi + vec3(1,0,1)), pf - vec3(1,0,1));
  float v011 = dot(_pgrad(pi + vec3(0,1,1)), pf - vec3(0,1,1));
  float v111 = dot(_pgrad(pi + vec3(1,1,1)), pf - vec3(1,1,1));
  return mix(
    mix(mix(v000, v100, u.x), mix(v010, v110, u.x), u.y),
    mix(mix(v001, v101, u.x), mix(v011, v111, u.x), u.y),
    u.z
  ) * 0.5 + 0.5;
}
`

  const call = `float noiseValue = perlinNoise(vec3(${uv}, 0.0) * ${scale.toFixed(4)} + vec3(${seed.toFixed(4)}));`

  return { defs, call, varName: 'noiseValue', type: 'float', uniforms: {} }
}

/**
 * Voronoi Noise — Blender Voronoi Texture node equivalent.
 * Output variable: voronoiValue (float)
 */
export function voronoiNoise(uv: string, options: ShaderFunctionOptions = {}): ShaderOutput {
  const scale = options.scale ?? 1.0

  const defs = `
float voronoiNoise(vec3 p) {
  vec3 pi = floor(p);
  vec3 pf = fract(p);
  float minDist = 1.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 neighbor  = vec3(float(x), float(y), float(z));
        vec3 cell      = pi + neighbor;
        vec3 cellPoint = fract(sin(vec3(
          dot(cell, vec3(127.1, 311.7, 74.7)),
          dot(cell, vec3(269.5, 183.3, 246.1)),
          dot(cell, vec3(113.5, 271.9, 124.6))
        )) * 43758.5453);
        minDist = min(minDist, length(neighbor + cellPoint - pf));
      }
    }
  }
  return minDist;
}
`

  const call = `float voronoiValue = voronoiNoise(vec3(${uv}, 0.0) * ${scale.toFixed(4)});`

  return { defs, call, varName: 'voronoiValue', type: 'float', uniforms: {} }
}
