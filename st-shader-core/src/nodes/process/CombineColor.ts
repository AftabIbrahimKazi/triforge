import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type CombineColorMode = 'RGB' | 'HSV' | 'HSL'

export interface CombineColorInputs {
  red?:   OutputSocket | number   // R in RGB, H in HSV/HSL
  green?: OutputSocket | number   // G in RGB, S in HSV/HSL
  blue?:  OutputSocket | number   // B in RGB, V/L in HSV/HSL
  mode?:  CombineColorMode
}

/**
 * Combine Color — Blender 3.4+ "Combine Color" node equivalent.
 * Combines three float channels into a color using RGB, HSV, or HSL mode.
 * Replaces the older CombineRGB node and adds HSV/HSL support.
 *
 * Inputs:  red/green/blue (float) — semantics depend on mode
 * Outputs: Color (color)
 */
export class CombineColor extends ProcessNode {
  get nodeType() { return 'CombineColor' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Combine Color', category: 'Converter', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_hsvToRgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 _st_hslToRgb(vec3 c) {
  float h = c.x, s = c.y, l = c.z;
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  vec3 t = vec3(h + 1.0/3.0, h, h - 1.0/3.0);
  t = fract(t);
  vec3 rgb;
  for (int i = 0; i < 3; i++) {
    float ti = (i == 0) ? t.x : (i == 1) ? t.y : t.z;
    float v;
    if (ti < 1.0/6.0)      v = p + (q - p) * 6.0 * ti;
    else if (ti < 0.5)     v = q;
    else if (ti < 2.0/3.0) v = p + (q - p) * (2.0/3.0 - ti) * 6.0;
    else                   v = p;
    if (i == 0) rgb.r = v;
    else if (i == 1) rgb.g = v;
    else rgb.b = v;
  }
  return rgb;
}`

  private readonly mode:    CombineColorMode
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: CombineColorInputs = {}) {
    super('CombineColor')
    this.mode     = inputs.mode ?? 'RGB'
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      red:   ['float', 0.0],
      green: ['float', 0.0],
      blue:  ['float', 0.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return CombineColor.glslFunction }

  compileCall(ctx: CompileContext): string {
    const r  = ctx.resolveInput(this._inputs.red)
    const g  = ctx.resolveInput(this._inputs.green)
    const b  = ctx.resolveInput(this._inputs.blue)
    const cv = ctx.outputVar(this, 'Color')

    switch (this.mode) {
      case 'HSV':
        return `vec3 ${cv} = _st_hsvToRgb(vec3(${r}, ${g}, ${b}));`
      case 'HSL':
        return `vec3 ${cv} = _st_hslToRgb(vec3(${r}, ${g}, ${b}));`
      default:
        return `vec3 ${cv} = vec3(${r}, ${g}, ${b});`
    }
  }
}
