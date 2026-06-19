import { ShaderNode } from './ShaderNode.js'
import type { InputSocket } from './InputSocket.js'

/**
 * Source node — outputs only, no upstream connections.
 * Examples: TextureCoordinate, Value, RGB constant.
 */
export abstract class InputNode extends ShaderNode {
  getInputSockets(): Record<string, InputSocket<unknown>> {
    return {}
  }

  compileDefs(): string {
    return ''
  }
}
