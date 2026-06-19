import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type ClampMode = 'MINMAX' | 'RANGE'

export interface ClampInputs {
  value?: OutputSocket | number
  min?:   OutputSocket | number
  max?:   OutputSocket | number
  mode?:  ClampMode
}

/**
 * Clamp — Blender "Clamp" converter node equivalent.
 * Pins a float value between min and max.
 *
 * Inputs:  value, min, max
 * Outputs: Result (float)
 */
export class Clamp extends ProcessNode {
  get nodeType() { return 'Clamp' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Clamp', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  static glslFunction = `
float _st_clamp(float v, float lo, float hi) {
  return clamp(v, min(lo, hi), max(lo, hi));
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: ClampInputs = {}) {
    super('Clamp')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      value: ['float', inputs.value ?? 0.5],
      min:   ['float', inputs.min   ?? 0.0],
      max:   ['float', inputs.max   ?? 1.0],
    })
    this._outputs = this.createOutputs({ Result: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Clamp.glslFunction }

  compileCall(ctx: CompileContext): string {
    const v  = ctx.resolveInput(this._inputs.value)
    const lo = ctx.resolveInput(this._inputs.min)
    const hi = ctx.resolveInput(this._inputs.max)
    return `float ${ctx.outputVar(this, 'Result')} = _st_clamp(${v}, ${lo}, ${hi});`
  }
}
