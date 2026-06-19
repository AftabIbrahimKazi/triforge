import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface ToonBSDFInputs {
  color?:   OutputSocket | string
  size?:    OutputSocket | number
  smooth?:  OutputSocket | number
  normal?:  OutputSocket
}

/**
 * Toon BSDF — Blender "Toon BSDF" node equivalent.
 * Hard cel-shading bands — cartoon and anime aesthetics.
 *
 * Inputs:  color, size [0-1], smooth [0-1], normal
 * Outputs: BSDF (shader)
 */
export class ToonBSDF extends ProcessNode {
  get nodeType() { return 'ToonBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Toon BSDF', category: 'Shader', color: '#336699', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_toonBSDF(vec3 color, float size, float smoothWidth, vec3 N) {
  vec3  L     = normalize(vec3(1.0, 2.0, 1.0));
  float NdotL = dot(N, L) * 0.5 + 0.5;
  float band  = smoothstep(size - smoothWidth, size + smoothWidth, NdotL);
  return color * band + color * 0.1;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: ToonBSDFInputs = {}) {
    super('ToonBSDF')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:  ['color', '#ffffff'],
      size:   ['float', inputs.size   ?? 0.5],
      smooth: ['float', inputs.smooth ?? 0.0],
      normal: ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return ToonBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color  = ctx.resolveInput(this._inputs.color)
    const size   = ctx.resolveInput(this._inputs.size)
    const smoothWidth = ctx.resolveInput(this._inputs.smooth)
    const normal = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_toonBSDF(${color}, ${size}, ${smoothWidth}, ${normal});`
  }
}
