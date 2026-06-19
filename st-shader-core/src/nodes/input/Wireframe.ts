import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Wireframe — Blender "Wireframe" input node equivalent.
 * Produces a greyscale mask highlighting polygon edges.
 * Uses screen-space derivatives for edge detection.
 *
 * Outputs:
 *   Fac (float) — 1.0 on edges, 0.0 on face interior
 */
export class Wireframe extends InputNode {
  get nodeType() { return 'Wireframe' }

  get metadata(): NodeMetadata {
    return { label: 'Wireframe', category: 'Input', color: '#3d6b96', cost: 'medium' }
  }

  parameters: { thickness: number }
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: { thickness?: number } | number = {}) {
    super('Wireframe')
    const thickness = typeof inputs === 'number' ? inputs : (inputs.thickness ?? 0.01)
    this.parameters = { thickness }
    this._outputs  = this.createOutputs({ Fac: 'float' })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    const t = this.parameters.thickness.toFixed(4)
    return [
      `vec3  _wf_bc_${this.id}  = vec3(vUv, 1.0 - vUv.x - vUv.y);`,
      `float _wf_min_${this.id} = min(_wf_bc_${this.id}.x, min(_wf_bc_${this.id}.y, _wf_bc_${this.id}.z));`,
      `float ${ctx.outputVar(this, 'Fac')} = 1.0 - smoothstep(${t} - 0.002, ${t} + 0.002, _wf_min_${this.id});`,
    ].join('\n  ')
  }
}
