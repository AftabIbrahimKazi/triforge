import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface MixShaderInputs {
  fac?:     OutputSocket | number
  shader1?: OutputSocket
  shader2?: OutputSocket
}

/**
 * Mix Shader — Blender "Mix Shader" node equivalent.
 * Blends two BSDF shader outputs by a factor.
 *
 * Inputs:
 *   fac     (float)  — blend factor [0-1]   0 = full shader1, 1 = full shader2
 *   shader1 (shader) — first BSDF
 *   shader2 (shader) — second BSDF
 *
 * Outputs:
 *   BSDF (shader) — blended result
 */
export class MixShader extends ProcessNode {
  get nodeType() { return 'MixShader' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return {
      label:    'Mix Shader',
      category: 'Shader',
      color:    '#336699',
      cost:     'low',
    }
  }

  static glslFunction = `
vec3 _st_mixShader(float fac, vec3 a, vec3 b) {
  return mix(a, b, clamp(fac, 0.0, 1.0));
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: MixShaderInputs = {}) {
    super('MixShader')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      fac:     ['float',  0.5],
      shader1: ['shader', null],
      shader2: ['shader', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return MixShader.glslFunction }

  compileCall(ctx: CompileContext): string {
    const fac     = ctx.resolveInput(this._inputs.fac)
    const shader1 = ctx.resolveInput(this._inputs.shader1)
    const shader2 = ctx.resolveInput(this._inputs.shader2)
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_mixShader(${fac}, ${shader1}, ${shader2});`
  }
}
