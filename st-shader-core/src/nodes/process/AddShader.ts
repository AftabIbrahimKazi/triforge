import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface AddShaderInputs {
  shader1?: OutputSocket
  shader2?: OutputSocket
}

/**
 * Add Shader — Blender "Add Shader" node equivalent.
 * Adds two shader outputs together (unlike MixShader which blends).
 * Useful for combining emission on top of a surface shader.
 *
 * Inputs:  shader1 (shader), shader2 (shader)
 * Outputs: BSDF (shader)
 */
export class AddShader extends ProcessNode {
  get nodeType() { return 'AddShader' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Add Shader', category: 'Shader', color: '#336699', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_addShader(vec3 a, vec3 b) {
  return a + b;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: AddShaderInputs = {}) {
    super('AddShader')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      shader1: ['shader', null],
      shader2: ['shader', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return AddShader.glslFunction }

  compileCall(ctx: CompileContext): string {
    const s1 = ctx.resolveInput(this._inputs.shader1)
    const s2 = ctx.resolveInput(this._inputs.shader2)
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_addShader(${s1}, ${s2});`
  }
}
