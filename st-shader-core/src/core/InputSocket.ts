import type { SocketType } from './SocketType.js'
import type { OutputSocket } from './OutputSocket.js'

/**
 * Represents an input connection point on a node.
 * Accepts either a literal value or a connected OutputSocket.
 */
export class InputSocket<T> {
  /** Connected upstream socket — overrides value when set. */
  connection: OutputSocket | null = null

  /** GLSL uniform name for this socket. Set by createInputs for float inputs. */
  uniformName: string | null = null

  constructor(
    public readonly name:         string,
    public readonly type:         SocketType,
    public readonly defaultValue: T,
    public readonly required:     boolean = false,
  ) {}

  /** The literal value — used when no connection is present. */
  get value(): T {
    return this.defaultValue
  }

  isConnected(): boolean {
    return this.connection !== null
  }
}
