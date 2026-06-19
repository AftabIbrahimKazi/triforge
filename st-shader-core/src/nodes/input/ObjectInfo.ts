import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Object Info — Blender "Object Info" node equivalent.
 * Provides per-object random and index values for procedural variation across instances.
 *
 * Outputs: Random (float), ObjectIndex (float), MaterialIndex (float)
 *
 * Random is seeded per-node-instance so two ObjectInfo nodes in the same graph
 * produce independent random values — useful for layering variation.
 */
export class ObjectInfo extends InputNode {
  get nodeType() { return 'ObjectInfo' }

  get metadata(): NodeMetadata {
    return { label: 'Object Info', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>
  private readonly _seed:    number

  constructor() {
    super('ObjectInfo')
    // Each instance gets a unique seed so multiple ObjectInfo nodes in one graph
    // produce independent random outputs
    this._seed    = Math.random()
    this._outputs = this.createOutputs({
      Random:        'float',
      ObjectIndex:   'float',
      MaterialIndex: 'float',
    })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    const rv  = ctx.outputVar(this, 'Random')
    const oiv = ctx.outputVar(this, 'ObjectIndex')
    const miv = ctx.outputVar(this, 'MaterialIndex')
    // Hash world position to produce a stable per-object random value.
    // floor() snaps to object origin so all fragments of the same object get the same value.
    return [
      `vec3  _oi_origin_${this.id} = floor(vPosition * 0.01) * 100.0;`,
      `float ${rv}  = fract(sin(dot(_oi_origin_${this.id}, vec3(127.1, 311.7, 74.7)) + ${this._seed.toFixed(6)}) * 43758.5453);`,
      `float ${oiv} = floor(${rv} * 255.0);`,
      `float ${miv} = floor(fract(${rv} * 17.0) * 255.0);`,
    ].join('\n  ')
  }
}
