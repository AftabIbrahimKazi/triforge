import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

/** A control point: [x, y] both in [0,1] */
type CurvePoint = [number, number]

export interface FloatCurveInputs {
  value?:  OutputSocket | number
  fac?:    OutputSocket | number
  /** Array of [x, y] control points — at least 2, sorted by x. */
  points?: CurvePoint[]
}

/**
 * Float Curve — Blender "Float Curve" converter node equivalent.
 * Remaps a float value using a custom piecewise-linear curve.
 *
 * Inputs:  value [0-1], fac [0-1], points (control points)
 * Outputs: Value (float)
 */
export class FloatCurve extends ProcessNode {
  get nodeType() { return 'FloatCurve' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Float Curve', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  private readonly points: CurvePoint[]
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: FloatCurveInputs = {}) {
    super('FloatCurve')
    this.points   = inputs.points ?? [[0, 0], [1, 1]]
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      value: ['float', inputs.value ?? 0.5],
      fac:   ['float', inputs.fac   ?? 1.0],
    })
    this._outputs = this.createOutputs({ Value: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const val = ctx.resolveInput(this._inputs.value)
    const fac = ctx.resolveInput(this._inputs.fac)
    const n   = this.points.length
    const out = ctx.outputVar(this, 'Value')

    // Build piecewise linear lookup from control points
    const lines = [
      `float _fc_v_${this.id} = clamp(${val}, 0.0, 1.0);`,
      `float _fc_r_${this.id} = ${this.points[n - 1][1].toFixed(4)};`,
    ]

    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = this.points[i]
      const [x1, y1] = this.points[i + 1]
      const t = `clamp((_fc_v_${this.id} - ${x0.toFixed(4)}) / max(${(x1 - x0).toFixed(4)}, 0.0001), 0.0, 1.0)`
      lines.push(`if (_fc_v_${this.id} <= ${x1.toFixed(4)}) _fc_r_${this.id} = mix(${y0.toFixed(4)}, ${y1.toFixed(4)}, ${t});`)
    }

    lines.push(`float ${out} = mix(_fc_v_${this.id}, _fc_r_${this.id}, clamp(${fac}, 0.0, 1.0));`)
    return lines.join('\n  ')
  }
}
