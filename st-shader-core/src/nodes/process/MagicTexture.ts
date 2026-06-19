import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface MagicTextureInputs {
  vector?:     OutputSocket
  scale?:      number | OutputSocket
  distortion?: number | OutputSocket
  depth?:      number
}

/**
 * Magic Texture — Blender "Magic Texture" node equivalent.
 * Swirling psychedelic colour pattern from sine wave interference.
 *
 * Outputs: Color (color), Fac (float)
 */
export class MagicTexture extends ProcessNode {
  get nodeType() { return 'MagicTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Magic Texture', category: 'Texture', color: '#3a6b3a', cost: 'low' }
  }

  static glslFunction = `
vec4 _st_magicTexture(vec3 p, float scale, float distortion) {
  p *= scale;
  float x = sin((p.x + p.y + p.z) * distortion);
  float y = cos((-p.x + p.y - p.z) * distortion);
  float z = -cos((-p.x - p.y + p.z) * distortion);
  vec3 col = (vec3(x, y, z) + 1.0) * 0.5;
  col = vec3(
    sin((col.x + col.y) * 6.28318),
    sin((col.y + col.z) * 6.28318),
    sin((col.z + col.x) * 6.28318)
  ) * 0.5 + 0.5;
  return vec4(col, (col.r + col.g + col.b) / 3.0);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: MagicTextureInputs = {}) {
    super('MagicTexture')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector:     ['color', null],
      scale:      ['float', inputs.scale      ?? 5.0],
      distortion: ['float', inputs.distortion ?? 1.0],
    })
    this._outputs = this.createOutputs({ Color: 'color', Fac: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return MagicTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const vec = this._inputs.vector.isConnected()
      ? `vec3(${ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)})`
      : 'vec3(vUv, 0.0)'
    const sc  = ctx.resolveInput(this._inputs.scale)
    const di  = ctx.resolveInput(this._inputs.distortion)
    const cv  = ctx.outputVar(this, 'Color')
    const fv  = ctx.outputVar(this, 'Fac')
    return [
      `vec4 _mg_${this.id} = _st_magicTexture(${vec}, ${sc}, ${di});`,
      `vec3  ${cv} = _mg_${this.id}.rgb;`,
      `float ${fv} = _mg_${this.id}.a;`,
    ].join('\n  ')
  }
}
