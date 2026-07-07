import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Transparent BSDF — Blender "Transparent BSDF" node equivalent.
 * Passes light through unfiltered — full transparency, colorless, no inputs.
 * Combine with MixShader/AddShader to build cutout, fresnel-fade, or
 * rim-light materials without a hand-written GLSL output node.
 *
 * Outputs: BSDF (shader) — always vec4(0.0, 0.0, 0.0, 0.0)
 */
export class TransparentBSDF extends ProcessNode {
  get nodeType() { return 'TransparentBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Transparent BSDF', category: 'Shader', color: '#336699', cost: 'low' }
  }

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('TransparentBSDF')
    this._inputs  = this.createInputs({}, {})
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  /** Always fully transparent — a constant, not a dynamic value, so this always requests transparent:true. */
  wantsTransparency(): boolean { return true }

  compileCall(ctx: CompileContext): string {
    return `vec4 ${ctx.outputVar(this, 'BSDF')} = vec4(0.0, 0.0, 0.0, 0.0);`
  }
}
