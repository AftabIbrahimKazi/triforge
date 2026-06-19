import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface TranslucentBSDFInputs {
  color?:  OutputSocket | string
  normal?: OutputSocket
}

/**
 * Translucent BSDF — Blender "Translucent BSDF" node equivalent.
 * Allows light silhouettes through the back of thin objects — leaves, paper, fabric.
 *
 * Inputs:  color, normal
 * Outputs: BSDF (shader)
 */
export class TranslucentBSDF extends ProcessNode {
  get nodeType() { return 'TranslucentBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Translucent BSDF', category: 'Shader', color: '#336699', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_translucentBSDF(vec3 color, vec3 N) {
  vec3  L       = normalize(vec3(1.0, 2.0, 1.0));
  float backDot = max(dot(-N, L), 0.0);
  return color * backDot / 3.14159265 + color * 0.02;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: TranslucentBSDFInputs = {}) {
    super('TranslucentBSDF')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:  ['color', '#ffffff'],
      normal: ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return TranslucentBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color  = ctx.resolveInput(this._inputs.color)
    const normal = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_translucentBSDF(${color}, ${normal});`
  }
}
