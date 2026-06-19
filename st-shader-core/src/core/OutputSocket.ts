import type { SocketType } from './SocketType.js'
import type { ShaderNode } from './ShaderNode.js'

/**
 * Represents an output connection point on a node.
 * Pass to a downstream node's input to wire the graph.
 *
 * Example:
 *   const noise = new NoiseTexture({ scale: 3.0 })
 *   noise.output('Fac')    // returns an OutputSocket
 *   noise.output('Color')  // returns an OutputSocket
 */
export class OutputSocket {
  constructor(
    public readonly node: ShaderNode,
    public readonly name: string,
    public readonly type: SocketType,
  ) {}
}
