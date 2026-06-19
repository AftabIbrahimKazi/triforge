import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type MusgraveType = 'FBM' | 'MULTIFRACTAL' | 'HYBRID_MULTIFRACTAL' | 'RIDGED_MULTIFRACTAL' | 'HETERO_TERRAIN'

export interface MusgraveTextureInputs {
  vector?:     OutputSocket
  scale?:      number | OutputSocket
  detail?:     number | OutputSocket
  dimension?:  number | OutputSocket
  lacunarity?: number | OutputSocket
  offset?:     number | OutputSocket
  gain?:       number | OutputSocket
  type?:       MusgraveType
}

/**
 * Musgrave Texture — Blender "Musgrave Texture" node equivalent.
 * Complex fractal noise — terrain, clouds, organic surfaces.
 *
 * Outputs: Fac (float), Color (color)
 */
export class MusgraveTexture extends ProcessNode {
  get nodeType() { return 'MusgraveTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Musgrave Texture', category: 'Texture', color: '#3a6b3a', cost: 'high', costNote: 'Fractal octave loop — limit detail to <=8.' }
  }

  static glslFunction = `
float _st_mhash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3  _st_mgrad(vec3 p)  { float h = _st_mhash(floor(p)); return normalize(vec3(h, fract(h*34.), fract(h*89.))*2.-1.); }
float _st_mperlin(vec3 p) {
  vec3 pi=floor(p), pf=p-pi, u=pf*pf*(3.-2.*pf);
  return mix(mix(mix(dot(_st_mgrad(pi+vec3(0,0,0)),pf-vec3(0,0,0)),dot(_st_mgrad(pi+vec3(1,0,0)),pf-vec3(1,0,0)),u.x),
                 mix(dot(_st_mgrad(pi+vec3(0,1,0)),pf-vec3(0,1,0)),dot(_st_mgrad(pi+vec3(1,1,0)),pf-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(_st_mgrad(pi+vec3(0,0,1)),pf-vec3(0,0,1)),dot(_st_mgrad(pi+vec3(1,0,1)),pf-vec3(1,0,1)),u.x),
                 mix(dot(_st_mgrad(pi+vec3(0,1,1)),pf-vec3(0,1,1)),dot(_st_mgrad(pi+vec3(1,1,1)),pf-vec3(1,1,1)),u.x),u.y),u.z);
}
float _st_musgrave(vec3 p, float scale, float detail, float dimension, float lacunarity, float offset, float gain, int mtype) {
  p *= scale;
  float value = 0.0, amp = 1.0, freq = 1.0, weight = 1.0;
  int   oct   = int(clamp(detail, 1.0, 16.0));
  float H     = max(dimension, 0.0001);
  for (int i = 0; i < 16; i++) {
    if (i >= oct) break;
    float n = _st_mperlin(p * freq);
    if (mtype == 0) { value += amp * n; }
    else if (mtype == 1) { value += amp * abs(n); }
    else if (mtype == 2) { float signal = abs(n) + offset; weight = clamp(signal * gain, 0.0, 1.0); value += weight * signal * amp; }
    else if (mtype == 3) { float signal = offset - abs(n); signal *= signal; value += weight * signal * amp; weight = clamp(signal * gain, 0.0, 1.0); }
    amp  *= pow(freq, -H);
    freq *= lacunarity;
  }
  return value * 0.5 + 0.5;
}`

  private readonly musType: MusgraveType
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: MusgraveTextureInputs = {}) {
    super('MusgraveTexture')
    this.musType  = inputs.type ?? 'FBM'
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector:     ['color', null],
      scale:      ['float', inputs.scale      ?? 5.0],
      detail:     ['float', inputs.detail     ?? 8.0],
      dimension:  ['float', inputs.dimension  ?? 2.0],
      lacunarity: ['float', inputs.lacunarity ?? 2.0],
      offset:     ['float', inputs.offset     ?? 0.0],
      gain:       ['float', inputs.gain       ?? 1.0],
    })
    this._outputs = this.createOutputs({ Fac: 'float', Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return MusgraveTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const typeMap: Record<MusgraveType, number> = { FBM: 0, MULTIFRACTAL: 1, HYBRID_MULTIFRACTAL: 2, RIDGED_MULTIFRACTAL: 3, HETERO_TERRAIN: 3 }
    const vec = this._inputs.vector.isConnected()
      ? `vec3(${ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)})`
      : 'vec3(vUv, 0.0)'
    const fv  = ctx.outputVar(this, 'Fac')
    const cv  = ctx.outputVar(this, 'Color')
    return [
      `float ${fv} = _st_musgrave(${vec}, ${ctx.resolveInput(this._inputs.scale)}, ${ctx.resolveInput(this._inputs.detail)}, ${ctx.resolveInput(this._inputs.dimension)}, ${ctx.resolveInput(this._inputs.lacunarity)}, ${ctx.resolveInput(this._inputs.offset)}, ${ctx.resolveInput(this._inputs.gain)}, ${typeMap[this.musType]});`,
      `vec3  ${cv} = vec3(${fv});`,
    ].join('\n  ')
  }
}
