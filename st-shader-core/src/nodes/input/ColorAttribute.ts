import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Color Attribute — Blender "Color Attribute" input node equivalent.
 * Reads vertex colour data painted onto the mesh.
 * Requires the geometry to have a 'color' BufferAttribute.
 * Falls back to white if the attribute is not present.
 *
 * Outputs:
 *   Color  (color) — vertex colour RGB
 *   Alpha  (float) — vertex colour alpha
 */
export class ColorAttribute extends InputNode {
  get nodeType() { return 'ColorAttribute' }

  get metadata(): NodeMetadata {
    return { label: 'Color Attribute', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('ColorAttribute')
    this._outputs = this.createOutputs({ Color: 'color', Alpha: 'float' })
  }

  getOutputSockets() { return this._outputs }

  vertexInjections() {
    return [{ attrName: 'color', attrType: 'vec3' as const, varyingName: 'vColor' }]
  }

  compileDefs(): string { return '' }

  compileCall(ctx: CompileContext): string {
    return [
      `vec3  ${ctx.outputVar(this, 'Color')} = vColor;`,
      `float ${ctx.outputVar(this, 'Alpha')} = 1.0;`,
    ].join('\n  ')
  }
}
