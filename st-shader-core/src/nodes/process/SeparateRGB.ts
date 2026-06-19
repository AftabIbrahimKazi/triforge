import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface SeparateRGBInputs {
  color?: OutputSocket | string
}

/**
 * Separate RGB — Blender "Separate Color" node equivalent.
 * Splits a colour into its R, G, B float channels.
 *
 * Inputs:  color (color)
 * Outputs: R (float), G (float), B (float)
 */
export class SeparateRGB extends ProcessNode {
  get nodeType() { return 'SeparateRGB' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Separate RGB', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: SeparateRGBInputs = {}) {
    super('SeparateRGB')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, { color: ['color', '#ffffff'] })
    this._outputs = this.createOutputs({ R: 'float', G: 'float', B: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const col = ctx.resolveInput(this._inputs.color)
    return [
      `float ${ctx.outputVar(this, 'R')} = (${col}).r;`,
      `float ${ctx.outputVar(this, 'G')} = (${col}).g;`,
      `float ${ctx.outputVar(this, 'B')} = (${col}).b;`,
    ].join('\n  ')
  }
}
