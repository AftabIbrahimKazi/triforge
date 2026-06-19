import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Tangent — Blender "Tangent" input node equivalent.
 * Provides tangent and bitangent vectors for anisotropic shading.
 * Derived from screen-space position derivatives in the absence of a tangent attribute.
 *
 * Outputs:
 *   Tangent   (color/vec3) — surface tangent direction
 *   Bitangent (color/vec3) — surface bitangent direction
 */
export class Tangent extends InputNode {
  get nodeType() { return 'Tangent' }

  get metadata(): NodeMetadata {
    return { label: 'Tangent', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('Tangent')
    this._outputs = this.createOutputs({ Tangent: 'color', Bitangent: 'color' })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    return [
      `vec3  _tg_N_${this.id}  = normalize(vNormal);`,
      `vec3  _tg_dp1_${this.id} = dFdx(vPosition);`,
      `vec3  _tg_dp2_${this.id} = dFdy(vPosition);`,
      `vec3  ${ctx.outputVar(this, 'Tangent')}   = normalize(_tg_dp1_${this.id} - _tg_N_${this.id} * dot(_tg_dp1_${this.id}, _tg_N_${this.id}));`,
      `vec3  ${ctx.outputVar(this, 'Bitangent')} = cross(_tg_N_${this.id}, ${ctx.outputVar(this, 'Tangent')});`,
    ].join('\n  ')
  }
}
