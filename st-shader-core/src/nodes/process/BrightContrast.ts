import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface BrightContrastInputs {
  color?:    OutputSocket | string
  bright?:   OutputSocket | number
  contrast?: OutputSocket | number
}

/**
 * Bright Contrast — Blender "Bright/Contrast" node equivalent.
 * Adjusts brightness and contrast of a colour.
 *
 * Inputs:  color, bright [-100 to 100], contrast [-100 to 100]
 * Outputs: Color (color)
 */
export class BrightContrast extends ProcessNode {
  get nodeType() { return 'BrightContrast' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Bright/Contrast', category: 'Color', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_brightContrast(vec3 col, float bright, float contrast) {
  float b = bright / 100.0;
  float c = contrast / 100.0;
  float a = 1.0 + c;
  float o = b - c * 0.5;
  return clamp(col * a + vec3(o), 0.0, 1.0);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: BrightContrastInputs = {}) {
    super('BrightContrast')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:    ['color', '#ffffff'],
      bright:   ['float', inputs.bright   ?? 0.0],
      contrast: ['float', inputs.contrast ?? 0.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return BrightContrast.glslFunction }

  compileCall(ctx: CompileContext): string {
    const col     = ctx.resolveInput(this._inputs.color)
    const bright  = ctx.resolveInput(this._inputs.bright)
    const contrast = ctx.resolveInput(this._inputs.contrast)
    return `vec3 ${ctx.outputVar(this, 'Color')} = _st_brightContrast(${col}, ${bright}, ${contrast});`
  }
}
