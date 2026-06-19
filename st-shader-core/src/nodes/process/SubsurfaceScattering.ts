import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface SubsurfaceScatteringInputs {
  color?:    OutputSocket | string
  scale?:    OutputSocket | number
  radius?:   [number, number, number]
  normal?:   OutputSocket
}

/**
 * Subsurface Scattering — Blender "Subsurface Scattering" node equivalent.
 * Simulates light bleeding beneath thin surfaces — skin, marble, wax, candles.
 * Real-time approximation using wrap lighting and translucency.
 *
 * Inputs:  color, scale [0-1], radius (RGB scatter distances), normal
 * Outputs: BSDF (shader)
 */
export class SubsurfaceScattering extends ProcessNode {
  get nodeType() { return 'SubsurfaceScattering' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Subsurface Scattering', category: 'Shader', color: '#336699', cost: 'medium', costNote: 'Real-time approximation — not physically exact.' }
  }

  static glslFunction = `
vec3 _st_sss(vec3 color, float scale, vec3 radius, vec3 N) {
  vec3  L       = normalize(vec3(1.0, 2.0, 1.0));
  float wrap    = max(dot(N, L) * 0.5 + 0.5, 0.0);
  vec3  scatter = color * radius * wrap * scale;
  float back    = max(-dot(N, L), 0.0) * scale * 0.3;
  return color * (0.04 + wrap * 0.5) + scatter + color * back;
}`

  private readonly radius: [number, number, number]
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: SubsurfaceScatteringInputs = {}) {
    super('SubsurfaceScattering')
    this.radius   = inputs.radius ?? [1.0, 0.2, 0.1]
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:  ['color', '#ffffff'],
      scale:  ['float', inputs.scale ?? 0.05],
      normal: ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return SubsurfaceScattering.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color  = ctx.resolveInput(this._inputs.color)
    const scale  = ctx.resolveInput(this._inputs.scale)
    const [r, g, b] = this.radius
    const normal = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_sss(${color}, ${scale}, vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)}), ${normal});`
  }
}
