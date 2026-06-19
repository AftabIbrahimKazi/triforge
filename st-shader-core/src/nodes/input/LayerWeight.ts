import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Layer Weight — Blender "Layer Weight" input node equivalent.
 * Generates blend factors based on viewing angle.
 * Useful for edge blending and layering materials.
 *
 * Outputs:
 *   Fresnel (float) — physically-based Fresnel factor
 *   Facing  (float) — 0.0 at grazing, 1.0 facing camera
 */
export class LayerWeight extends InputNode {
  get nodeType() { return 'LayerWeight' }

  get metadata(): NodeMetadata {
    return { label: 'Layer Weight', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  parameters: { blend: number }
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: { blend?: number } | number = {}) {
    super('LayerWeight')
    const blend = typeof inputs === 'number' ? inputs : (inputs.blend ?? 0.5)
    this.parameters = { blend: Math.max(0.0001, blend) }
    this._outputs = this.createOutputs({ Fresnel: 'float', Facing: 'float' })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    const b = this.parameters.blend.toFixed(4)
    return [
      `vec3  _lw_N_${this.id}  = normalize(vNormal);`,
      `vec3  _lw_V_${this.id}  = normalize(cameraPosition - vPosition);`,
      `float _lw_c_${this.id}  = max(dot(_lw_N_${this.id}, _lw_V_${this.id}), 0.0);`,
      `float _lw_ior_${this.id} = 1.0 / max(1.0 - ${b}, 0.0001);`,
      `float _lw_F0_${this.id} = pow((_lw_ior_${this.id} - 1.0) / (_lw_ior_${this.id} + 1.0), 2.0);`,
      `float ${ctx.outputVar(this, 'Fresnel')} = _lw_F0_${this.id} + (1.0 - _lw_F0_${this.id}) * pow(1.0 - _lw_c_${this.id}, 5.0);`,
      `float ${ctx.outputVar(this, 'Facing')}  = pow(1.0 - _lw_c_${this.id}, max(1.0 - ${b} + 0.0001, 0.0001));`,
    ].join('\n  ')
  }
}
