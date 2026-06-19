import * as THREE from 'three'
import type { HumanParameters } from '../core/HumanParameters.js'

// Optional — only used if developer passes shaderCore in HumanGenerator options
type ShaderCoreModule = typeof import('@st-shader-core')

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}

// ── Path A: built-in GLSL (no core packages needed) ──────────────────────────

const SKIN_VERT = /* glsl */`
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
void main() {
  vNormal   = normalize(normalMatrix * normal);
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  vUv       = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SKIN_FRAG = /* glsl */`
uniform vec3  uSkinColor;
uniform float uRoughness;
uniform float uSpecular;
uniform float uSssRadius;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

// Simple value noise for pore micro-bump
float hash(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i),           hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)), f.x), f.y),
    f.z);
}

void main() {
  vec3 N   = normalize(vNormal);
  vec3 V   = normalize(-vPosition);

  // Micro pore bump offset on normal
  float pore = noise3(vPosition * 40.0) * 0.5 + noise3(vPosition * 80.0) * 0.25;
  N = normalize(N + vec3(pore - 0.5) * 0.12);

  // Tone variation
  float tone = noise3(vPosition * 5.0);
  vec3 skinDark  = uSkinColor * 0.72;
  vec3 skinLight = uSkinColor * 1.18;
  vec3 albedo    = mix(skinDark, skinLight, tone);

  // Lambertian diffuse (light comes from fragment shader — approximate key light)
  vec3 L       = normalize(vec3(0.6, 1.0, 0.8));
  float diff   = max(dot(N, L), 0.0);

  // Subsurface approximation: wrap lighting + saturated backscatter
  float wrap   = (dot(N, L) + uSssRadius) / (1.0 + uSssRadius);
  float sss    = pow(clamp(wrap, 0.0, 1.0), 2.0);
  vec3  sssCol = albedo * vec3(1.0, 0.4, 0.25) * sss * uSssRadius;

  // Blinn-Phong specular
  vec3  H      = normalize(L + V);
  float gloss  = max(1.0 - uRoughness, 0.01);
  float spec   = pow(max(dot(N, H), 0.0), gloss * 80.0) * uSpecular;

  // Fresnel rim (translucent ear / nose tips)
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.15;
  vec3  rimCol  = uSkinColor * fresnel;

  // Ambient
  vec3 ambient = albedo * 0.08;

  vec3 color = ambient + albedo * diff * 0.85 + sssCol + vec3(spec) + rimCol;

  // Gamma
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(color, 1.0);
}
`

const EYE_FRAG = /* glsl */`
uniform vec3 uIrisColor;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
void main() {
  vec3 N   = normalize(vNormal);
  vec3 V   = normalize(-vPosition);
  vec3 L   = normalize(vec3(0.6, 1.0, 0.8));
  vec3 H   = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 120.0);
  float diff = max(dot(N, L), 0.0) * 0.7;
  vec3 color = uIrisColor * diff + vec3(spec) + uIrisColor * 0.05;
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(color, 1.0);
}
`

function buildSkinBuiltin(p: HumanParameters): THREE.ShaderMaterial {
  const [sr, sg, sb] = hexToRgb(p.skinColor)
  return new THREE.ShaderMaterial({
    vertexShader:   SKIN_VERT,
    fragmentShader: SKIN_FRAG,
    uniforms: {
      uSkinColor:  { value: new THREE.Color(sr, sg, sb) },
      uRoughness:  { value: p.skinRoughness },
      uSpecular:   { value: p.skinSpecular },
      uSssRadius:  { value: p.sssRadius },
    },
  })
}

function buildEyeBuiltin(p: HumanParameters): THREE.ShaderMaterial {
  const [ir, ig, ib] = hexToRgb(p.irisColor)
  return new THREE.ShaderMaterial({
    vertexShader:   SKIN_VERT,
    fragmentShader: EYE_FRAG,
    uniforms: {
      uIrisColor: { value: new THREE.Color(ir, ig, ib) },
    },
  })
}

// ── Path B: @st-shader-core nodes (richer SSS, node-animatable) ───────────────

function buildSkinNodes(p: HumanParameters, sc: ShaderCoreModule): THREE.ShaderMaterial {
  const {
    SubsurfaceScattering, PrincipledBSDF, MixShader, AddShader,
    NoiseTexture, Bump, LayerWeight, Emission,
    MaterialOutput, TextureCoordinate,
  } = sc

  const tc        = new TextureCoordinate()
  const poreNoise = new NoiseTexture({ vector: tc.output('Generated'), scale: 40, detail: 6, roughness: 0.6 })
  const poreBump  = new Bump({ height: poreNoise.output('Fac'), strength: 0.8 })
  const toneNoise = new NoiseTexture({ vector: tc.output('Generated'), scale: 4, detail: 3, roughness: 0.5 })

  const sss = new SubsurfaceScattering({
    color:  p.skinColor,
    scale:  p.sssRadius * 0.08,
    radius: [p.sssRadius, p.sssRadius * 0.6, p.sssRadius * 0.4],
    normal: poreBump.output('Normal'),
  })
  const bsdf = new PrincipledBSDF({
    baseColor: toneNoise.output('Color'),
    roughness: p.skinRoughness,
    specular:  p.skinSpecular,
    normal:    poreBump.output('Normal'),
  })
  const rimGlow   = new Emission({ color: p.skinColor, strength: 0.15 })
  const skinBlend = new MixShader({ fac: 0.45, shader1: sss.output('BSDF'), shader2: bsdf.output('BSDF') })
  const withRim   = new AddShader({ shader1: skinBlend.output('BSDF'), shader2: rimGlow.output('BSDF') })

  const mat = new MaterialOutput({ surface: withRim.output('BSDF') })
  mat.compile()
  return mat.material
}

function buildEyeNodes(p: HumanParameters, sc: ShaderCoreModule): THREE.ShaderMaterial {
  const { PrincipledBSDF, MaterialOutput } = sc
  const bsdf = new PrincipledBSDF({ baseColor: p.irisColor, roughness: 0.05, specular: 1.0 })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  return mat.material
}

// ── Public API — picks path automatically ─────────────────────────────────────

export function buildSkinMaterial(p: HumanParameters, shaderCore?: ShaderCoreModule): THREE.ShaderMaterial {
  return shaderCore ? buildSkinNodes(p, shaderCore) : buildSkinBuiltin(p)
}

export function buildEyeMaterial(p: HumanParameters, shaderCore?: ShaderCoreModule): THREE.ShaderMaterial {
  return shaderCore ? buildEyeNodes(p, shaderCore) : buildEyeBuiltin(p)
}
