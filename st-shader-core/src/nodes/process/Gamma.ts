import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface GammaInputs {
  color?: OutputSocket | string
  gamma?: OutputSocket | number
}

/**
 * Gamma — Blender "Gamma" node equivalent.
 * Applies exponential gamma correction to a colour.
 *
 * Inputs:  color, gamma (float — 1.0 = no change, <1 = lighten, >1 = darken)
 * Outputs: Color (color)
 */
export class Gamma extends ProcessNode {
  get nodeType() { return 'Gamma' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Gamma', category: 'Color', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_gamma(vec3 col, float gamma) {
  return pow(max(col, vec3(0.0)), vec3(gamma));
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: GammaInputs = {}) {
    super('Gamma')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color: ['color', '#ffffff'],
      gamma: ['float', inputs.gamma ?? 1.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Gamma.glslFunction }

  compileCall(ctx: CompileContext): string {
    const col   = ctx.resolveInput(this._inputs.color)
    const gamma = ctx.resolveInput(this._inputs.gamma)
    return `vec3 ${ctx.outputVar(this, 'Color')} = _st_gamma(${col}, ${gamma});`
  }
}
