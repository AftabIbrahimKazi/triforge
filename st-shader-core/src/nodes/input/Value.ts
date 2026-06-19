import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Value — Blender "Value" input node equivalent.
 * Outputs a single constant float.
 *
 * Outputs: Value (float)
 */
export class Value extends InputNode {
  get nodeType() { return 'Value' }

  get metadata(): NodeMetadata {
    return { label: 'Value', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly val: number
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(value: number = 0.5) {
    super('Value')
    this.val      = value
    this._outputs = this.createOutputs({ Value: 'float' })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    return `float ${ctx.outputVar(this, 'Value')} = ${this.val.toFixed(4)};`
  }
}
