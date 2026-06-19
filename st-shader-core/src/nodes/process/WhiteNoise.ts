import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface WhiteNoiseInputs {
  vector?: OutputSocket
}

/**
 * White Noise — Blender "White Noise" texture node equivalent.
 * Pure pixel-perfect random values — no spatial correlation.
 *
 * Outputs: Value (float), Color (color)
 */
export class WhiteNoise extends ProcessNode {
  get nodeType() { return 'WhiteNoise' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'White Noise', category: 'Texture', color: '#3a6b3a', cost: 'low' }
  }

  static glslFunction = `
float _st_whiteNoise1(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
vec3 _st_whiteNoise3(vec3 p) {
  return vec3(
    fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453),
    fract(sin(dot(p, vec3(269.5, 183.3, 246.1))) * 43758.5453),
    fract(sin(dot(p, vec3(113.5, 271.9, 124.6))) * 43758.5453)
  );
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: WhiteNoiseInputs = {}) {
    super('WhiteNoise')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, { vector: ['color', null] })
    this._outputs = this.createOutputs({ Value: 'float', Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return WhiteNoise.glslFunction }

  compileCall(ctx: CompileContext): string {
    const vec = this._inputs.vector.isConnected()
      ? `vec3(${ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)})`
      : 'vec3(vUv, 0.0)'
    const fv  = ctx.outputVar(this, 'Value')
    const cv  = ctx.outputVar(this, 'Color')
    return [
      `float ${fv} = _st_whiteNoise1(${vec});`,
      `vec3  ${cv} = _st_whiteNoise3(${vec});`,
    ].join('\n  ')
  }
}
