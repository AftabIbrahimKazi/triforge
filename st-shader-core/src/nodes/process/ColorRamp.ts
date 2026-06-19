import { ProcessNode } from '../../core/ProcessNode.js'
import { CompileContext } from '../../core/CompileContext.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface ColorRampInputs {
  fac?:   OutputSocket | number
  stops?: string[]
}

/**
 * Color Ramp — Blender "ColorRamp" node equivalent.
 *
 * Inputs:  fac (float)
 * Outputs: Color (color)
 */
export class ColorRamp extends ProcessNode {
  get nodeType() { return 'ColorRamp' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Color Ramp', category: 'Converter', color: '#633060', cost: 'low' }
  }

  private readonly stops:    string[]
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: ColorRampInputs = {}) {
    super('ColorRamp')
    this.stops    = inputs.stops ?? ['#000000', '#ffffff']
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      fac: ['float', 0.5],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    const fn = `_st_colorRamp_${this.id}`
    const cs = this.stops.map(CompileContext.hexToVec3)
    const n  = cs.length

    if (n === 1) {
      return `\nvec3 ${fn}(float t) { return ${cs[0]}; }`
    }

    // if-else chain with baked-in constants — GLSL ES 1.00 compatible.
    // Avoids vec3[] array initialisation and dynamic indexing which require ES 3.00.
    const segs = n - 1
    const lines: string[] = [`\nvec3 ${fn}(float t) {`, `  float s = clamp(t, 0.0, 1.0);`]
    for (let i = 0; i < segs; i++) {
      const posA = (i / segs).toFixed(6)
      const posB = ((i + 1) / segs).toFixed(6)
      const frac = `((s - ${posA}) * ${segs}.0)`
      const stmt = `return mix(${cs[i]}, ${cs[i + 1]}, clamp(${frac}, 0.0, 1.0));`
      lines.push(i < segs - 1 ? `  if (s < ${posB}) ${stmt}` : `  ${stmt}`)
    }
    lines.push('}')
    return lines.join('\n')
  }

  compileCall(ctx: CompileContext): string {
    return `vec3 ${ctx.outputVar(this, 'Color')} = _st_colorRamp_${this.id}(${ctx.resolveInput(this._inputs.fac)});`
  }
}
