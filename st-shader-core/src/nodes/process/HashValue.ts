import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface HashValueInputs {
  value?: OutputSocket | number
}

/**
 * Hash Value — Blender "Hash Value" node equivalent.
 * Hashes any input float to a pseudo-random float in [0, 1].
 * Deterministic: same input always produces the same output.
 * Useful for per-element procedural randomness without textures.
 *
 * Inputs:  value (float)
 * Outputs: Value (float)
 */
export class HashValue extends ProcessNode {
  get nodeType() { return 'HashValue' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Hash Value', category: 'Converter', color: '#4a7a4a', cost: 'low' }
  }

  static glslFunction = `
float _st_hashValue(float v) {
  return fract(sin(v * 127.1 + 311.7) * 43758.5453);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: HashValueInputs = {}) {
    super('HashValue')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      value: ['float', 0.0],
    })
    this._outputs = this.createOutputs({ Value: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return HashValue.glslFunction }

  compileCall(ctx: CompileContext): string {
    return `float ${ctx.outputVar(this, 'Value')} = _st_hashValue(${ctx.resolveInput(this._inputs.value)});`
  }
}
