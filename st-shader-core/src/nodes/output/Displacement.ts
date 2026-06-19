import { OutputNode } from '../../core/OutputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'
import { InputSocket } from '../../core/InputSocket.js'

export interface DisplacementInputs {
  height?:   OutputSocket
  midlevel?: OutputSocket | number
  scale?:    OutputSocket | number
  normal?:   OutputSocket
}

/**
 * Displacement — Blender "Displacement" vector output node.
 * Feeds into MaterialOutput.displacement to control vertex offset.
 * In real-time WebGL, displacement is baked into the vertex shader via normal perturbation.
 *
 * Inputs:  height (float), midlevel, scale, normal
 * Outputs: Displacement (color/vec3)
 */
export class Displacement extends OutputNode {
  get nodeType() { return 'Displacement' }

  get metadata(): NodeMetadata {
    return { label: 'Displacement', category: 'Vector', color: '#4a3a8a', cost: 'low' }
  }

  private readonly _inputs:  Record<string, InputSocket<unknown>>

  constructor(inputs: DisplacementInputs = {}) {
    super('Displacement')
    this._inputs = this.createInputs(inputs as Record<string, unknown>, {
      height:   ['float', 0.0],
      midlevel: ['float', inputs.midlevel ?? 0.5],
      scale:    ['float', inputs.scale    ?? 1.0],
      normal:   ['color', null],
    })
  }

  getInputSockets() { return this._inputs }

  compileCall(ctx: CompileContext): string {
    const height   = ctx.resolveInput(this._inputs.height)
    const midlevel = ctx.resolveInput(this._inputs.midlevel)
    const scale    = ctx.resolveInput(this._inputs.scale)
    const normal   = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 _disp_${this.id} = ${normal} * (${height} - ${midlevel}) * ${scale};`
  }
}
