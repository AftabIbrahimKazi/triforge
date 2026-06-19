import { InputNode } from '../../core/InputNode.js'
import { CompileContext } from '../../core/CompileContext.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'

/**
 * RGB — Blender "RGB" input node equivalent.
 * Outputs a single constant colour.
 *
 * Outputs: Color (color)
 */
export class RGB extends InputNode {
  get nodeType() { return 'RGB' }

  get metadata(): NodeMetadata {
    return { label: 'RGB', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly hex: string
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(color: string = '#ffffff') {
    super('RGB')
    this.hex      = color
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    return `vec3 ${ctx.outputVar(this, 'Color')} = ${CompileContext.hexToVec3(this.hex)};`
  }
}
