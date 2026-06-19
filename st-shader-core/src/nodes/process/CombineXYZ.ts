import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface CombineXYZInputs {
  x?: OutputSocket | number
  y?: OutputSocket | number
  z?: OutputSocket | number
}

/**
 * Combine XYZ — Blender "Combine XYZ" node equivalent.
 * Combines three floats into a vector.
 *
 * Inputs:  X (float), Y (float), Z (float)
 * Outputs: Vector (color/vec3)
 */
export class CombineXYZ extends ProcessNode {
  get nodeType() { return 'CombineXYZ' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Combine XYZ', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: CombineXYZInputs = {}) {
    super('CombineXYZ')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      x: ['float', inputs.x ?? 0.0],
      y: ['float', inputs.y ?? 0.0],
      z: ['float', inputs.z ?? 0.0],
    })
    this._outputs = this.createOutputs({ Vector: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const x = ctx.resolveInput(this._inputs.x)
    const y = ctx.resolveInput(this._inputs.y)
    const z = ctx.resolveInput(this._inputs.z)
    return `vec3 ${ctx.outputVar(this, 'Vector')} = vec3(${x}, ${y}, ${z});`
  }
}
