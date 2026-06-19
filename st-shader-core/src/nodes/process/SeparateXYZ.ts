import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface SeparateXYZInputs {
  vector?: OutputSocket
}

/**
 * Separate XYZ — Blender "Separate XYZ" node equivalent.
 * Splits a vector into X, Y, Z float components.
 *
 * Inputs:  vector (vector/color)
 * Outputs: X (float), Y (float), Z (float)
 */
export class SeparateXYZ extends ProcessNode {
  get nodeType() { return 'SeparateXYZ' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Separate XYZ', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: SeparateXYZInputs = {}) {
    super('SeparateXYZ')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, { vector: ['color', null] })
    this._outputs = this.createOutputs({ X: 'float', Y: 'float', Z: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const v = ctx.resolveInput(this._inputs.vector)
    return [
      `float ${ctx.outputVar(this, 'X')} = (${v}).x;`,
      `float ${ctx.outputVar(this, 'Y')} = (${v}).y;`,
      `float ${ctx.outputVar(this, 'Z')} = (${v}).z;`,
    ].join('\n  ')
  }
}
