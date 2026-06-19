import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface HueSaturationValueInputs {
  hue?:        OutputSocket | number
  saturation?: OutputSocket | number
  value?:      OutputSocket | number
  fac?:        OutputSocket | number
  color?:      OutputSocket | string
}

/**
 * Hue Saturation Value — Blender "Hue/Saturation/Value" node equivalent.
 * Adjusts the HSV components of a colour.
 *
 * Inputs:  hue [0-1], saturation [0-2], value [0-2], fac [0-1], color
 * Outputs: Color (color)
 */
export class HueSaturationValue extends ProcessNode {
  get nodeType() { return 'HueSaturationValue' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Hue Saturation Value', category: 'Color', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_rgbToHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 _st_hsvToRgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 _st_hueSatVal(vec3 col, float hue, float sat, float val, float fac) {
  vec3 hsv = _st_rgbToHsv(col);
  hsv.x = fract(hsv.x + hue - 0.5);
  hsv.y = clamp(hsv.y * sat, 0.0, 1.0);
  hsv.z = clamp(hsv.z * val, 0.0, 1.0);
  return mix(col, _st_hsvToRgb(hsv), fac);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: HueSaturationValueInputs = {}) {
    super('HueSaturationValue')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      hue:        ['float', inputs.hue        ?? 0.5],
      saturation: ['float', inputs.saturation ?? 1.0],
      value:      ['float', inputs.value      ?? 1.0],
      fac:        ['float', inputs.fac        ?? 1.0],
      color:      ['color', '#ffffff'],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return HueSaturationValue.glslFunction }

  compileCall(ctx: CompileContext): string {
    const col = ctx.resolveInput(this._inputs.color)
    const hue = ctx.resolveInput(this._inputs.hue)
    const sat = ctx.resolveInput(this._inputs.saturation)
    const val = ctx.resolveInput(this._inputs.value)
    const fac = ctx.resolveInput(this._inputs.fac)
    return `vec3 ${ctx.outputVar(this, 'Color')} = _st_hueSatVal(${col}, ${hue}, ${sat}, ${val}, ${fac});`
  }
}
