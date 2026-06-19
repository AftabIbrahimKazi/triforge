import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface WavelengthInputs {
  wavelength?: OutputSocket | number
}

/**
 * Wavelength — Blender "Wavelength" node equivalent.
 * Converts a visible light wavelength (380–780 nm) into an RGB colour.
 *
 * Inputs:  wavelength (float, nanometres — 380 to 780)
 * Outputs: Color (color)
 */
export class Wavelength extends ProcessNode {
  get nodeType() { return 'Wavelength' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Wavelength', category: 'Color', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_wavelength(float w) {
  w = clamp(w, 380.0, 780.0);
  float r = 0.0, g = 0.0, b = 0.0;
  if      (w < 440.0) { r = (440.0 - w) / 60.0; b = 1.0; }
  else if (w < 490.0) { g = (w - 440.0) / 50.0; b = 1.0; }
  else if (w < 510.0) { g = 1.0; b = (510.0 - w) / 20.0; }
  else if (w < 580.0) { r = (w - 510.0) / 70.0; g = 1.0; }
  else if (w < 645.0) { r = 1.0; g = (645.0 - w) / 65.0; }
  else                { r = 1.0; }
  float factor = (w < 420.0) ? 0.3 + 0.7 * (w - 380.0) / 40.0
               : (w > 700.0) ? 0.3 + 0.7 * (780.0 - w) / 80.0 : 1.0;
  return pow(vec3(r, g, b) * factor, vec3(0.8));
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: WavelengthInputs = {}) {
    super('Wavelength')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      wavelength: ['float', inputs.wavelength ?? 550.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Wavelength.glslFunction }

  compileCall(ctx: CompileContext): string {
    const w = ctx.resolveInput(this._inputs.wavelength)
    return `vec3 ${ctx.outputVar(this, 'Color')} = _st_wavelength(${w});`
  }
}
