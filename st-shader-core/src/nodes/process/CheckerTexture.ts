import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface CheckerTextureInputs {
  vector?: OutputSocket
  color1?: OutputSocket | string
  color2?: OutputSocket | string
  scale?:  number | OutputSocket
}

/**
 * Checker Texture — Blender "Checker Texture" node equivalent.
 * Alternating square grid pattern.
 *
 * Outputs: Color (color), Fac (float — 0.0 or 1.0)
 */
export class CheckerTexture extends ProcessNode {
  get nodeType() { return 'CheckerTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Checker Texture', category: 'Texture', color: '#3a6b3a', cost: 'low' }
  }

  static glslFunction = `
vec4 _st_checkerTexture(vec3 p, vec3 c1, vec3 c2, float scale) {
  vec3  s   = floor(p * scale);
  float fac = mod(s.x + s.y + s.z, 2.0);
  return vec4(mix(c1, c2, fac), fac);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: CheckerTextureInputs = {}) {
    super('CheckerTexture')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector: ['color',  null],
      color1: ['color',  inputs.color1 ?? '#ffffff'],
      color2: ['color',  inputs.color2 ?? '#000000'],
      scale:  ['float',  inputs.scale  ?? 5.0],
    })
    this._outputs = this.createOutputs({ Color: 'color', Fac: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return CheckerTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const vec = this._inputs.vector.isConnected()
      ? `vec3(${ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)})`
      : 'vec3(vUv, 0.0)'
    const c1  = ctx.resolveInput(this._inputs.color1)
    const c2  = ctx.resolveInput(this._inputs.color2)
    const sc  = ctx.resolveInput(this._inputs.scale)
    const cv  = ctx.outputVar(this, 'Color')
    const fv  = ctx.outputVar(this, 'Fac')
    return [
      `vec4 _ck_${this.id} = _st_checkerTexture(${vec}, ${c1}, ${c2}, ${sc});`,
      `vec3  ${cv} = _ck_${this.id}.rgb;`,
      `float ${fv} = _ck_${this.id}.a;`,
    ].join('\n  ')
  }
}
