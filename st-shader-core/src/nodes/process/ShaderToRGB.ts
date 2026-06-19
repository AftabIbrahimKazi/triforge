import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface ShaderToRGBInputs {
  shader?: OutputSocket
}

/**
 * Shader to RGB — Blender "Shader to RGB" converter node equivalent.
 * Converts a BSDF shader output back into a colour for further processing.
 * Useful for cel shading and NPR (non-photorealistic) rendering.
 *
 * Inputs:  shader (BSDF)
 * Outputs: Color (color), Alpha (float)
 */
export class ShaderToRGB extends ProcessNode {
  get nodeType() { return 'ShaderToRGB' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Shader to RGB', category: 'Converter', color: '#4a3a6a', cost: 'low' }
  }

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: ShaderToRGBInputs = {}) {
    super('ShaderToRGB')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, { shader: ['shader', null] })
    this._outputs = this.createOutputs({ Color: 'color', Alpha: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const shader = ctx.resolveInput(this._inputs.shader)
    const cv     = ctx.outputVar(this, 'Color')
    const av     = ctx.outputVar(this, 'Alpha')
    return [
      `vec3  ${cv} = ${shader};`,
      `float ${av} = 1.0;`,
    ].join('\n  ')
  }
}
