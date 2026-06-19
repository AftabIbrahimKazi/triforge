import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type MapRangeMode = 'LINEAR' | 'STEPPED' | 'SMOOTHSTEP' | 'SMOOTHERSTEP'

export interface MapRangeInputs {
  value?:    OutputSocket | number
  fromMin?:  OutputSocket | number
  fromMax?:  OutputSocket | number
  toMin?:    OutputSocket | number
  toMax?:    OutputSocket | number
  steps?:    OutputSocket | number
  mode?:     MapRangeMode
  clamp?:    boolean
}

/**
 * Map Range — Blender "Map Range" converter node equivalent.
 * Remaps a value from one range to another.
 *
 * Inputs:  value, fromMin, fromMax, toMin, toMax, steps, mode, clamp
 * Outputs: Result (float)
 */
export class MapRange extends ProcessNode {
  get nodeType() { return 'MapRange' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Map Range', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  static glslFunction = `
float _st_mapRange(float v, float fMin, float fMax, float tMin, float tMax, float steps, int mode, bool doClamp) {
  float range  = fMax - fMin;
  float t      = range == 0.0 ? 0.0 : (v - fMin) / range;
  if      (mode == 1) t = (steps > 0.0) ? floor(t * steps + 0.5) / steps : t;
  else if (mode == 2) t = t * t * (3.0 - 2.0 * t);
  else if (mode == 3) t = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  if (doClamp) t = clamp(t, 0.0, 1.0);
  return tMin + t * (tMax - tMin);
}`

  private readonly mode:  MapRangeMode
  private readonly doClamp: boolean
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: MapRangeInputs = {}) {
    super('MapRange')
    this.mode    = inputs.mode  ?? 'LINEAR'
    this.doClamp = inputs.clamp ?? false
    this._inputs = this.createInputs(inputs as Record<string, unknown>, {
      value:   ['float', inputs.value   ?? 0.5],
      fromMin: ['float', inputs.fromMin ?? 0.0],
      fromMax: ['float', inputs.fromMax ?? 1.0],
      toMin:   ['float', inputs.toMin   ?? 0.0],
      toMax:   ['float', inputs.toMax   ?? 1.0],
      steps:   ['float', inputs.steps   ?? 4.0],
    })
    this._outputs = this.createOutputs({ Result: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return MapRange.glslFunction }

  compileCall(ctx: CompileContext): string {
    const modeIdx = { LINEAR: 0, STEPPED: 1, SMOOTHSTEP: 2, SMOOTHERSTEP: 3 }[this.mode]
    const v  = ctx.resolveInput(this._inputs.value)
    const f0 = ctx.resolveInput(this._inputs.fromMin)
    const f1 = ctx.resolveInput(this._inputs.fromMax)
    const t0 = ctx.resolveInput(this._inputs.toMin)
    const t1 = ctx.resolveInput(this._inputs.toMax)
    const st = ctx.resolveInput(this._inputs.steps)
    return `float ${ctx.outputVar(this, 'Result')} = _st_mapRange(${v}, ${f0}, ${f1}, ${t0}, ${t1}, ${st}, ${modeIdx}, ${this.doClamp});`
  }
}
