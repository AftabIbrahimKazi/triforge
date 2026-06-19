import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface AnimatedNoiseTextureInputs {
  vector?:     OutputSocket
  scale?:      number | OutputSocket
  detail?:     number | OutputSocket
  roughness?:  number | OutputSocket
  distortion?: number | OutputSocket
  speed?:      number
}

/**
 * Animated Noise Texture — time-animated extension of NoiseTexture.
 * Uses four scrolling noise layers for realistic wave-like movement.
 * Injects a `time` uniform into the compiled ShaderMaterial automatically.
 *
 * Inputs:  vector, scale, detail, roughness, distortion, speed
 * Outputs: Fac (float), Color (color)
 *
 * Usage:
 *   const noise = new AnimatedNoiseTexture({ scale: 5.0, speed: 1.0 })
 *   // After mat.compile(), time updates via: mat.material.uniforms.time.value = t
 */
export class AnimatedNoiseTexture extends ProcessNode {
  get nodeType() { return 'AnimatedNoiseTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return {
      label:    'Animated Noise Texture',
      category: 'Texture',
      color:    '#3a6b3a',
      cost:     'high',
      costNote: 'Four noise layers per fragment. Limit to 2 instances per material.',
    }
  }

  static glslFunction = `
uniform float time;

float _st_an_hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
vec3 _st_an_grad(vec3 p) {
  float h = _st_an_hash(floor(p));
  return normalize(vec3(h, fract(h * 34.0), fract(h * 89.0)) * 2.0 - 1.0);
}
float _st_an_perlin(vec3 p) {
  vec3 pi = floor(p), pf = p - pi, u = pf * pf * (3.0 - 2.0 * pf);
  float v000 = dot(_st_an_grad(pi+vec3(0,0,0)), pf-vec3(0,0,0));
  float v100 = dot(_st_an_grad(pi+vec3(1,0,0)), pf-vec3(1,0,0));
  float v010 = dot(_st_an_grad(pi+vec3(0,1,0)), pf-vec3(0,1,0));
  float v110 = dot(_st_an_grad(pi+vec3(1,1,0)), pf-vec3(1,1,0));
  float v001 = dot(_st_an_grad(pi+vec3(0,0,1)), pf-vec3(0,0,1));
  float v101 = dot(_st_an_grad(pi+vec3(1,0,1)), pf-vec3(1,0,1));
  float v011 = dot(_st_an_grad(pi+vec3(0,1,1)), pf-vec3(0,1,1));
  float v111 = dot(_st_an_grad(pi+vec3(1,1,1)), pf-vec3(1,1,1));
  return mix(
    mix(mix(v000,v100,u.x), mix(v010,v110,u.x), u.y),
    mix(mix(v001,v101,u.x), mix(v011,v111,u.x), u.y), u.z
  ) * 0.5 + 0.5;
}

float _st_animatedNoise(vec3 pos, float scale, float speed) {
  vec2 worldXZ = pos.xz;
  vec2 wp = worldXZ * 0.008 * scale;
  float t = time * speed;
  vec2 uv0 = wp        + vec2( t / 17.0,  t / 29.0);
  vec2 uv1 = wp        + vec2(-t / 19.0,  t / 31.0);
  vec2 uv2 = wp * 2.1  + vec2( t / 41.0,  t / 53.0);
  vec2 uv3 = wp * 2.1  + vec2(-t / 37.0, -t / 61.0);
  float n = _st_an_perlin(vec3(uv0, 0.0))
          + _st_an_perlin(vec3(uv1, 0.0))
          + _st_an_perlin(vec3(uv2, 0.0))
          + _st_an_perlin(vec3(uv3, 0.0));
  return n * 0.25;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>
  private readonly speed:    number

  constructor(inputs: AnimatedNoiseTextureInputs = {}) {
    super('AnimatedNoiseTexture')
    this.speed   = inputs.speed ?? 1.0
    this._inputs = this.createInputs(inputs as Record<string, unknown>, {
      vector:     ['color', null],
      scale:      ['float',  inputs.scale      ?? 5.0],
      detail:     ['float',  inputs.detail     ?? 2.0],
      roughness:  ['float',  inputs.roughness  ?? 0.5],
      distortion: ['float',  inputs.distortion ?? 0.0],
    })
    this._outputs = this.createOutputs({ Fac: 'float', Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return AnimatedNoiseTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const p3    = this._inputs.vector.isConnected()
      ? ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)
      : 'vPosition'
    const scale = ctx.resolveInput(this._inputs.scale)
    const fv    = ctx.outputVar(this, 'Fac')
    const cv    = ctx.outputVar(this, 'Color')
    return [
      `float ${fv} = _st_animatedNoise(${p3}, ${scale}, ${this.speed.toFixed(4)});`,
      `vec3  ${cv} = vec3(${fv});`,
    ].join('\n  ')
  }
}
