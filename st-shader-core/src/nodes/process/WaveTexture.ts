import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type WaveType   = 'BANDS' | 'RINGS'
export type WaveProfile = 'SINE' | 'SAW' | 'TRIANGLE'

export interface WaveTextureInputs {
  vector?:      OutputSocket
  scale?:       number | OutputSocket
  distortion?:  number | OutputSocket
  detail?:      number | OutputSocket
  detailScale?: number | OutputSocket
  detailRoughness?: number | OutputSocket
  waveType?:    WaveType
  profile?:     WaveProfile
}

/**
 * Wave Texture — Blender "Wave Texture" node equivalent.
 * Generates stripe/ring patterns with optional noise distortion.
 *
 * Inputs:  vector, scale, distortion, detail, detailScale, detailRoughness
 * Outputs: Color (color), Fac (float)
 */
export class WaveTexture extends ProcessNode {
  get nodeType() { return 'WaveTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Wave Texture', category: 'Texture', color: '#3a6b3a', cost: 'medium' }
  }

  static glslFunction = `
float _st_waveHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float _st_waveNoise(vec3 p) {
  vec3 pi = floor(p), pf = p - pi, u = pf * pf * (3.0 - 2.0 * pf);
  return mix(mix(mix(_st_waveHash(pi),              _st_waveHash(pi+vec3(1,0,0)), u.x),
                 mix(_st_waveHash(pi+vec3(0,1,0)),  _st_waveHash(pi+vec3(1,1,0)), u.x), u.y),
             mix(mix(_st_waveHash(pi+vec3(0,0,1)),  _st_waveHash(pi+vec3(1,0,1)), u.x),
                 mix(_st_waveHash(pi+vec3(0,1,1)),  _st_waveHash(pi+vec3(1,1,1)), u.x), u.y), u.z);
}
float _st_waveTexture(vec3 p, float scale, float distortion, float detail, float dScale, float dRough, int waveType, int profile) {
  p *= scale;
  float dist = (waveType == 0) ? p.x + p.y + p.z : length(p);
  float n = 0.0, amp = 1.0, freq = 1.0, maxAmp = 0.0;
  int oct = int(clamp(detail, 0.0, 8.0));
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    n += amp * _st_waveNoise(p * freq * dScale);
    maxAmp += amp; amp *= dRough; freq *= 2.0;
  }
  dist += distortion * (maxAmp > 0.0 ? n / maxAmp : 0.0);
  float wave = 0.5 + 0.5 * sin(dist * 6.28318);
  if (profile == 1) wave = fract(dist / 6.28318);
  if (profile == 2) wave = abs(2.0 * fract(dist / 6.28318) - 1.0);
  return wave;
}`

  private readonly waveType: WaveType
  private readonly profile:  WaveProfile
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: WaveTextureInputs = {}) {
    super('WaveTexture')
    this.waveType = inputs.waveType ?? 'BANDS'
    this.profile  = inputs.profile  ?? 'SINE'
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector:           ['color', null],
      scale:            ['float', inputs.scale            ?? 5.0],
      distortion:       ['float', inputs.distortion       ?? 0.0],
      detail:           ['float', inputs.detail           ?? 2.0],
      detailScale:      ['float', inputs.detailScale      ?? 1.0],
      detailRoughness:  ['float', inputs.detailRoughness  ?? 0.5],
    })
    this._outputs = this.createOutputs({ Color: 'color', Fac: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return WaveTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const vec   = this._inputs.vector.isConnected()
      ? `vec3(${ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)})`
      : 'vec3(vUv, 0.0)'
    const s   = ctx.resolveInput(this._inputs.scale)
    const d   = ctx.resolveInput(this._inputs.distortion)
    const det = ctx.resolveInput(this._inputs.detail)
    const ds  = ctx.resolveInput(this._inputs.detailScale)
    const dr  = ctx.resolveInput(this._inputs.detailRoughness)
    const wt  = this.waveType === 'BANDS' ? 0 : 1
    const pf  = this.profile === 'SINE' ? 0 : this.profile === 'SAW' ? 1 : 2
    const fv  = ctx.outputVar(this, 'Fac')
    const cv  = ctx.outputVar(this, 'Color')
    return [
      `float ${fv} = _st_waveTexture(${vec}, ${s}, ${d}, ${det}, ${ds}, ${dr}, ${wt}, ${pf});`,
      `vec3  ${cv} = vec3(${fv});`,
    ].join('\n  ')
  }
}
