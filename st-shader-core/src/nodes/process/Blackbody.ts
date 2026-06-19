import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface BlackbodyInputs {
  temperature?: OutputSocket | number
}

/**
 * Blackbody — Blender "Blackbody" node equivalent.
 * Converts temperature in Kelvin to an emission colour.
 * 1000K = deep red, 6500K = white, 10000K = blue-white.
 *
 * Inputs:  temperature (float, Kelvin)
 * Outputs: Color (color)
 */
export class Blackbody extends ProcessNode {
  get nodeType() { return 'Blackbody' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Blackbody', category: 'Color', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_blackbody(float t) {
  t = clamp(t, 800.0, 40000.0) / 100.0;
  float r, g, b;
  if (t <= 66.0) {
    r = 1.0;
    g = clamp((99.4708025861 * log(t) - 161.1195681661) / 255.0, 0.0, 1.0);
  } else {
    r = clamp((329.698727446 * pow(t - 60.0, -0.1332047592)) / 255.0, 0.0, 1.0);
    g = clamp((288.1221695283 * pow(t - 60.0, -0.0755148492)) / 255.0, 0.0, 1.0);
  }
  if (t >= 66.0) {
    b = 1.0;
  } else if (t <= 19.0) {
    b = 0.0;
  } else {
    b = clamp((138.5177312231 * log(t - 10.0) - 305.0447927307) / 255.0, 0.0, 1.0);
  }
  return vec3(r, g, b);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: BlackbodyInputs = {}) {
    super('Blackbody')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      temperature: ['float', inputs.temperature ?? 3200.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Blackbody.glslFunction }

  compileCall(ctx: CompileContext): string {
    const temp = ctx.resolveInput(this._inputs.temperature)
    return `vec3 ${ctx.outputVar(this, 'Color')} = _st_blackbody(${temp});`
  }
}
