import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type MixRGBMode =
  | 'MIX' | 'DARKEN' | 'MULTIPLY' | 'BURN'
  | 'LIGHTEN' | 'SCREEN' | 'DODGE' | 'ADD'
  | 'OVERLAY' | 'SOFT_LIGHT' | 'LINEAR_LIGHT'
  | 'DIFFERENCE' | 'EXCLUSION' | 'SUBTRACT'
  | 'DIVIDE' | 'HUE' | 'SATURATION' | 'COLOR' | 'LUMINOSITY'

export interface MixRGBInputs {
  mode?:   MixRGBMode
  fac?:    OutputSocket | number
  colorA?: OutputSocket | string
  colorB?: OutputSocket | string
  clamp?:  boolean
}

/**
 * Mix RGB — Blender "Mix" color node equivalent.
 * Blends two colours using a mode selector.
 *
 * Inputs:  fac [0-1], colorA, colorB
 * Outputs: Color (color)
 */
export class MixRGB extends ProcessNode {
  get nodeType() { return 'MixRGB' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Mix RGB', category: 'Color', color: '#633060', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_mixRGB(int mode, float fac, vec3 a, vec3 b) {
  fac = clamp(fac, 0.0, 1.0);
  vec3 col = a;
  if      (mode == 0)  col = mix(a, b, fac);
  else if (mode == 1)  col = mix(a, min(a, b), fac);
  else if (mode == 2)  col = mix(a, a * b, fac);
  else if (mode == 3)  col = mix(a, vec3(1.0) - (vec3(1.0) - a) * (vec3(1.0) - b) / max(vec3(1.0) - a, vec3(0.001)), fac);
  else if (mode == 4)  col = mix(a, max(a, b), fac);
  else if (mode == 5)  col = mix(a, vec3(1.0) - (vec3(1.0) - a) * (vec3(1.0) - b), fac);
  else if (mode == 6)  col = mix(a, a / max(vec3(1.0) - b, vec3(0.001)), fac);
  else if (mode == 7)  col = mix(a, clamp(a + b, 0.0, 1.0), fac);
  else if (mode == 8)  col = mix(a, mix(2.0*a*b, vec3(1.0)-2.0*(vec3(1.0)-a)*(vec3(1.0)-b), step(vec3(0.5), a)), fac);
  else if (mode == 9)  col = mix(a, mix(2.0*a*b + a*a*(1.0-2.0*b), sqrt(max(a,vec3(0.0)))*(2.0*b-1.0)+2.0*a*(1.0-b), step(vec3(0.5), b)), fac);
  else if (mode == 10) col = mix(a, clamp(2.0*a*b - 1.0 + 2.0*(vec3(1.0)-a)*(b-0.5), 0.0, 1.0), fac);
  else if (mode == 11) col = mix(a, abs(a - b), fac);
  else if (mode == 12) col = mix(a, a + b - 2.0*a*b, fac);
  else if (mode == 13) col = mix(a, clamp(a - b, 0.0, 1.0), fac);
  else if (mode == 14) col = mix(a, a / max(b, vec3(0.0001)), fac);
  return col;
}`

  private readonly mode:  MixRGBMode
  private readonly clamp: boolean
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: MixRGBInputs = {}) {
    super('MixRGB')
    this.mode  = inputs.mode  ?? 'MIX'
    this.clamp = inputs.clamp ?? false
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      fac:    ['float', inputs.fac    ?? 0.5],
      colorA: ['color', '#000000'],
      colorB: ['color', '#ffffff'],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return MixRGB.glslFunction }

  compileCall(ctx: CompileContext): string {
    const modeIndex = [
      'MIX','DARKEN','MULTIPLY','BURN','LIGHTEN','SCREEN','DODGE','ADD',
      'OVERLAY','SOFT_LIGHT','LINEAR_LIGHT','DIFFERENCE','EXCLUSION','SUBTRACT','DIVIDE',
    ].indexOf(this.mode)
    const idx    = modeIndex === -1 ? 0 : modeIndex
    const fac    = ctx.resolveInput(this._inputs.fac)
    const colorA = ctx.resolveInput(this._inputs.colorA)
    const colorB = ctx.resolveInput(this._inputs.colorB)
    const out    = ctx.outputVar(this, 'Color')
    const expr   = `_st_mixRGB(${idx}, ${fac}, ${colorA}, ${colorB})`
    return `vec3 ${out} = ${this.clamp ? `clamp(${expr}, 0.0, 1.0)` : expr};`
  }
}
