import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type SeparateColorMode = 'RGB' | 'HSV' | 'HSL'

export interface SeparateColorInputs {
  color?: OutputSocket | string
  mode?:  SeparateColorMode
}

/**
 * Separate Color — Blender 3.4+ "Separate Color" node equivalent.
 * Separates a color into three float channels using RGB, HSV, or HSL mode.
 * Replaces the older SeparateRGB node and adds HSV/HSL support.
 *
 * Inputs:  color
 * Outputs: Red (float), Green (float), Blue (float)
 *          — semantics depend on mode: R/G/B in RGB, H/S/V in HSV, H/S/L in HSL
 */
export class SeparateColor extends ProcessNode {
  get nodeType() { return 'SeparateColor' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Separate Color', category: 'Converter', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_rgbToHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y), e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 _st_rgbToHsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  float d = maxC - minC;
  float s = (d < 0.0001) ? 0.0 : d / (1.0 - abs(2.0 * l - 1.0));
  float h = 0.0;
  if (d > 0.0001) {
    if (maxC == c.r)      h = mod((c.g - c.b) / d, 6.0) / 6.0;
    else if (maxC == c.g) h = ((c.b - c.r) / d + 2.0) / 6.0;
    else                  h = ((c.r - c.g) / d + 4.0) / 6.0;
  }
  return vec3(h, s, l);
}`

  private readonly mode:    SeparateColorMode
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: SeparateColorInputs = {}) {
    super('SeparateColor')
    this.mode     = inputs.mode ?? 'RGB'
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color: ['color', '#ffffff'],
    })
    this._outputs = this.createOutputs({
      Red:   'float',
      Green: 'float',
      Blue:  'float',
    })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return SeparateColor.glslFunction }

  compileCall(ctx: CompileContext): string {
    const cv  = ctx.resolveInput(this._inputs.color)
    const tmp = `_sc_${this.id}`
    const rv  = ctx.outputVar(this, 'Red')
    const gv  = ctx.outputVar(this, 'Green')
    const bv  = ctx.outputVar(this, 'Blue')

    let convert: string
    switch (this.mode) {
      case 'HSV': convert = `vec3 ${tmp} = _st_rgbToHsv(${cv});`; break
      case 'HSL': convert = `vec3 ${tmp} = _st_rgbToHsl(${cv});`; break
      default:    convert = `vec3 ${tmp} = ${cv};`;               break
    }

    return [
      convert,
      `float ${rv} = ${tmp}.x;`,
      `float ${gv} = ${tmp}.y;`,
      `float ${bv} = ${tmp}.z;`,
    ].join('\n  ')
  }
}
