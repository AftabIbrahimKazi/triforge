import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Ocean Attribute — Blender "Attribute" node reading the "Ocean" foam data layer.
 *
 * Reads the `foam` Float32BufferAttribute written by OceanModifier and passes it
 * from the vertex shader to the fragment shader via a varying.
 *
 * Outputs:
 *   Fac   (float) — raw foam value [0, 1]. 0 = calm water, 1 = breaking wave.
 *   Color (color) — vec3(fac, fac, fac) for use in color/emission nodes.
 *
 * Usage matches Blender's Attribute node with Data Layer set to "Ocean":
 *   const ocean = new OceanAttribute()
 *   const ramp  = new ColorRamp({ fac: ocean.output('Fac'), stops: ['#000000', '#ffffff'] })
 *   // white where foam, dark where calm
 */
export class OceanAttribute extends InputNode {
  get nodeType() { return 'OceanAttribute' }

  get metadata(): NodeMetadata {
    return { label: 'Ocean Attribute', category: 'Input', color: '#1a4a6b', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('OceanAttribute')
    this._outputs = this.createOutputs({ Fac: 'float', Color: 'color' })
  }

  getOutputSockets() { return this._outputs }

  vertexInjections() {
    return [{ attrName: 'foam', attrType: 'float' as const, varyingName: 'vFoam' }]
  }

  compileCall(ctx: CompileContext): string {
    const fv = ctx.outputVar(this, 'Fac')
    const cv = ctx.outputVar(this, 'Color')
    return [
      `float ${fv} = clamp(vFoam, 0.0, 1.0);`,
      `vec3  ${cv} = vec3(${fv});`,
    ].join('\n  ')
  }
}
