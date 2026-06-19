import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface NoiseTextureInputs {
  vector?:     OutputSocket
  scale?:      number | OutputSocket
  detail?:     number | OutputSocket
  roughness?:  number | OutputSocket
  distortion?: number | OutputSocket
}

/**
 * Noise Texture — Blender "Noise Texture" node equivalent.
 *
 * Inputs:  vector, scale, detail, roughness, distortion
 * Outputs: Fac (float), Color (color)
 */
export class NoiseTexture extends ProcessNode {
  get nodeType() { return 'NoiseTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Noise Texture', category: 'Texture', color: '#3a6b3a', cost: 'medium', costNote: 'Keep detail <= 4 on mobile.' }
  }

  static glslFunction = `
float _st_phash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
vec3 _st_pgrad(vec3 p) {
  float h = _st_phash(floor(p));
  return normalize(vec3(h, fract(h * 34.0), fract(h * 89.0)) * 2.0 - 1.0);
}
float _st_perlin(vec3 p) {
  vec3 pi = floor(p), pf = p - pi, u = pf * pf * (3.0 - 2.0 * pf);
  float v000 = dot(_st_pgrad(pi+vec3(0,0,0)), pf-vec3(0,0,0));
  float v100 = dot(_st_pgrad(pi+vec3(1,0,0)), pf-vec3(1,0,0));
  float v010 = dot(_st_pgrad(pi+vec3(0,1,0)), pf-vec3(0,1,0));
  float v110 = dot(_st_pgrad(pi+vec3(1,1,0)), pf-vec3(1,1,0));
  float v001 = dot(_st_pgrad(pi+vec3(0,0,1)), pf-vec3(0,0,1));
  float v101 = dot(_st_pgrad(pi+vec3(1,0,1)), pf-vec3(1,0,1));
  float v011 = dot(_st_pgrad(pi+vec3(0,1,1)), pf-vec3(0,1,1));
  float v111 = dot(_st_pgrad(pi+vec3(1,1,1)), pf-vec3(1,1,1));
  return mix(
    mix(mix(v000,v100,u.x), mix(v010,v110,u.x), u.y),
    mix(mix(v001,v101,u.x), mix(v011,v111,u.x), u.y), u.z
  ) * 0.5 + 0.5;
}
float _st_noiseTexture(vec3 p3, float scale, float detail, float roughness, float distortion) {
  vec3 p = p3 * scale;
  if (distortion > 0.0) {
    p.x += distortion * _st_perlin(p + vec3(1.7, 9.2, 3.4));
    p.y += distortion * _st_perlin(p + vec3(8.3, 2.8, 5.1));
    p.z += distortion * _st_perlin(p + vec3(4.1, 6.5, 1.9));
  }
  float value = 0.0, amplitude = 1.0, frequency = 1.0, maxAmp = 0.0;
  int octaves = int(clamp(detail, 1.0, 8.0));
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * _st_perlin(p * frequency);
    maxAmp += amplitude; amplitude *= roughness; frequency *= 2.0;
  }
  return value / maxAmp;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: NoiseTextureInputs = {}) {
    super('NoiseTexture')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector:     ['color', null],
      scale:      ['float',  5.0],
      detail:     ['float',  2.0],
      roughness:  ['float',  0.5],
      distortion: ['float',  0.0],
    })
    this._outputs = this.createOutputs({ Fac: 'float', Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return this.glslFunction ?? NoiseTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const p3   = this._inputs.vector.isConnected()
      ? ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)
      : 'vPosition'
    const fv   = ctx.outputVar(this, 'Fac')
    const cv   = ctx.outputVar(this, 'Color')
    return [
      `float ${fv} = _st_noiseTexture(${p3}, ${ctx.resolveInput(this._inputs.scale)}, ${ctx.resolveInput(this._inputs.detail)}, ${ctx.resolveInput(this._inputs.roughness)}, ${ctx.resolveInput(this._inputs.distortion)});`,
      `vec3  ${cv} = vec3(${fv});`,
    ].join('\n  ')
  }
}
