import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Texture Coordinate — Blender "Texture Coordinate" node equivalent.
 *
 * Outputs: UV (vector/vec2), Generated (color/vec3 object-space position), Normal (color/vec3)
 */
export class TextureCoordinate extends InputNode {
  get nodeType() { return 'TextureCoordinate' }

  get metadata(): NodeMetadata {
    return { label: 'Texture Coordinate', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('TextureCoordinate')
    this._outputs = this.createOutputs({ UV: 'vector', Generated: 'color', Normal: 'color' })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    return [
      `vec2 ${ctx.outputVar(this, 'UV')}        = vUv;`,
      `vec3 ${ctx.outputVar(this, 'Generated')} = vPosition;`,
      `vec3 ${ctx.outputVar(this, 'Normal')}    = normalize(vNormal);`,
    ].join('\n  ')
  }
}
