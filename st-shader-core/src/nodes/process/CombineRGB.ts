import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface CombineRGBInputs {
  r?: OutputSocket | number
  g?: OutputSocket | number
  b?: OutputSocket | number
}

/**
 * Combine RGB — Blender "Combine Color" node equivalent.
 * Combines three float channels into a colour.
 *
 * Inputs:  R (float), G (float), B (float)
 * Outputs: Color (color)
 */
export class CombineRGB extends ProcessNode {
  get nodeType() { return 'CombineRGB' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Combine RGB', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: CombineRGBInputs = {}) {
    super('CombineRGB')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      r: ['float', inputs.r ?? 0.0],
      g: ['float', inputs.g ?? 0.0],
      b: ['float', inputs.b ?? 0.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const r = ctx.resolveInput(this._inputs.r)
    const g = ctx.resolveInput(this._inputs.g)
    const b = ctx.resolveInput(this._inputs.b)
    return `vec3 ${ctx.outputVar(this, 'Color')} = vec3(${r}, ${g}, ${b});`
  }
}
