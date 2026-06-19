import { GeometryNode, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * Index — emit a FloatField that returns the index of each element.
 * Blender: Geometry Nodes > Utilities > Index
 *
 * Output socket "Index" is a FloatField callback (index, count) => number.
 * When parameters.normalized == 1, returns i / count instead of i.
 */
export class Index extends GeometryNode {
  readonly nodeType = 'Index'

  parameters: {
    /** 0 = raw integer index, 1 = normalised 0..1 range. */
    normalized: number
  }

  constructor(opts: { normalized?: number } = {}) {
    super()
    this.parameters = { normalized: opts.normalized ?? 0 }
  }

  _evaluate(_inputs: Inputs): Record<string, SocketValue> {
    const normalized = this.parameters.normalized >= 0.5

    const field: (index: number, count: number) => number = normalized
      ? (i, n) => (n > 1 ? i / (n - 1) : 0)
      : (i, _n) => i

    return { Index: field }
  }
}
