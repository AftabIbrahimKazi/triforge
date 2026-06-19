import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface EmissionInputs {
  color?:    OutputSocket | string
  strength?: OutputSocket | number
}

/**
 * Emission — Blender "Emission" shader node equivalent.
 * Produces a self-illuminating surface — unaffected by scene lighting.
 * Use with MixShader to add glow on top of a surface material.
 *
 * Inputs:  color (color), strength (float)
 * Outputs: BSDF (shader)
 */
export class Emission extends ProcessNode {
  get nodeType() { return 'Emission' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Emission', category: 'Shader', color: '#336699', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_emission(vec3 color, float strength) {
  return color * strength;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: EmissionInputs = {}) {
    super('Emission')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:    ['color', '#ffffff'],
      strength: ['float', inputs.strength ?? 1.0],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Emission.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color    = ctx.resolveInput(this._inputs.color)
    const strength = ctx.resolveInput(this._inputs.strength)
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_emission(${color}, ${strength});`
  }
}
