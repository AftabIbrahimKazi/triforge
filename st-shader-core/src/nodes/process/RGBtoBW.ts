import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface RGBtoBWInputs {
  color?: OutputSocket | string
}

/**
 * RGB to BW — Blender "RGB to BW" node equivalent.
 * Converts a colour to a greyscale float using luminance weights.
 *
 * Inputs:  color (color)
 * Outputs: Val (float) — luminance value [0-1]
 */
export class RGBtoBW extends ProcessNode {
  get nodeType() { return 'RGBtoBW' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'RGB to BW', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  static glslFunction = `
float _st_rgbToBw(vec3 col) {
  return dot(col, vec3(0.2126, 0.7152, 0.0722));
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: RGBtoBWInputs = {}) {
    super('RGBtoBW')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, { color: ['color', '#ffffff'] })
    this._outputs = this.createOutputs({ Val: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return RGBtoBW.glslFunction }

  compileCall(ctx: CompileContext): string {
    const col = ctx.resolveInput(this._inputs.color)
    return `float ${ctx.outputVar(this, 'Val')} = _st_rgbToBw(${col});`
  }
}
