import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * UV Map — Blender "UV Map" input node equivalent.
 * Outputs the mesh UV coordinates.
 * In Three.js all geometries use a single UV channel exposed as vUv.
 *
 * Outputs:
 *   UV (vector/vec2) — UV coordinates [0,1]
 */
export class UVMap extends InputNode {
  get nodeType() { return 'UVMap' }

  get metadata(): NodeMetadata {
    return { label: 'UV Map', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('UVMap')
    this._outputs = this.createOutputs({ UV: 'vector' })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    return `vec2 ${ctx.outputVar(this, 'UV')} = vUv;`
  }
}
