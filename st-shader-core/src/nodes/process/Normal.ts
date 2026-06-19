import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface NormalInputs {
  normal?: OutputSocket
  direction?: [number, number, number]
}

/**
 * Normal — Blender "Normal" vector node equivalent.
 * Outputs a static customisable direction vector.
 * Also computes a dot product of the surface normal against that direction.
 *
 * Inputs:  normal (override), direction ([x,y,z] — default: [0,0,1])
 * Outputs: Normal (color/vec3), Dot (float)
 */
export class Normal extends ProcessNode {
  get nodeType() { return 'Normal' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Normal', category: 'Vector', color: '#4a3a8a', cost: 'low' }
  }

  private readonly direction: [number, number, number]
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: NormalInputs = {}) {
    super('Normal')
    this.direction = inputs.direction ?? [0, 0, 1]
    this._inputs   = this.createInputs(inputs as Record<string, unknown>, { normal: ['color', null] })
    this._outputs  = this.createOutputs({ Normal: 'color', Dot: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const [x, y, z] = this.direction
    const N = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    const nv  = ctx.outputVar(this, 'Normal')
    const dv  = ctx.outputVar(this, 'Dot')
    const dir = `vec3(${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)})`
    return [
      `vec3  ${nv} = normalize(${dir});`,
      `float ${dv} = dot(${N}, ${nv});`,
    ].join('\n  ')
  }
}
