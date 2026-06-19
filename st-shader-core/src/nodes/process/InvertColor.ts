import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface InvertColorInputs {
  color?: OutputSocket | string
  fac?:   OutputSocket | number
}

/**
 * Invert Color — Blender "Invert Color" node equivalent.
 * Produces the negative of a colour, blended by fac.
 *
 * Inputs:  color, fac [0-1] (0 = original, 1 = fully inverted)
 * Outputs: Color (color)
 */
export class InvertColor extends ProcessNode {
  get nodeType() { return 'InvertColor' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Invert Color', category: 'Color', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_invertColor(vec3 col, float fac) {
  return mix(col, 1.0 - col, clamp(fac, 0.0, 1.0));
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: InvertColorInputs = {}) {
    super('InvertColor')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color: ['color', '#ffffff'],
      fac:   ['float', inputs.fac ?? 1.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return InvertColor.glslFunction }

  compileCall(ctx: CompileContext): string {
    const col = ctx.resolveInput(this._inputs.color)
    const fac = ctx.resolveInput(this._inputs.fac)
    return `vec3 ${ctx.outputVar(this, 'Color')} = _st_invertColor(${col}, ${fac});`
  }
}
