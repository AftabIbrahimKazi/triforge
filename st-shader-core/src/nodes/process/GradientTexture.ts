import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type GradientType = 'LINEAR' | 'QUADRATIC' | 'EASING' | 'DIAGONAL' | 'RADIAL' | 'QUADRATIC_SPHERE' | 'SPHERICAL'

export interface GradientTextureInputs {
  vector?: OutputSocket
  type?:   GradientType
}

/**
 * Gradient Texture — Blender "Gradient Texture" node equivalent.
 * Generates gradient patterns from a vector input.
 *
 * Inputs:  vector, type
 * Outputs: Color (color), Fac (float)
 */
export class GradientTexture extends ProcessNode {
  get nodeType() { return 'GradientTexture' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Gradient Texture', category: 'Texture', color: '#3a6b3a', cost: 'low' }
  }

  private readonly type: GradientType
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: GradientTextureInputs = {}) {
    super('GradientTexture')
    this.type     = inputs.type ?? 'LINEAR'
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, { vector: ['color', null] })
    this._outputs = this.createOutputs({ Color: 'color', Fac: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const v   = ctx.resolveInput(this._inputs.vector)
    const fv  = ctx.outputVar(this, 'Fac')
    const cv  = ctx.outputVar(this, 'Color')
    const expr = this.buildExpr(v)
    return [
      `float ${fv} = clamp(${expr}, 0.0, 1.0);`,
      `vec3  ${cv} = vec3(${fv});`,
    ].join('\n  ')
  }

  private buildExpr(v: string): string {
    switch (this.type) {
      case 'LINEAR':           return `(${v}).x`
      case 'QUADRATIC':        return `pow(max((${v}).x, 0.0), 2.0)`
      case 'EASING': {
        const t = `(${v}).x`
        return `(${t} * ${t} * (3.0 - 2.0 * ${t}))`
      }
      case 'DIAGONAL':         return `((${v}).x + (${v}).y) * 0.5`
      case 'RADIAL':           return `(atan((${v}).y, (${v}).x) / 6.28318 + 0.5)`
      case 'SPHERICAL':        return `max(1.0 - length(${v}), 0.0)`
      case 'QUADRATIC_SPHERE': return `max(1.0 - pow(length(${v}), 2.0), 0.0)`
      default:                 return `(${v}).x`
    }
  }
}
