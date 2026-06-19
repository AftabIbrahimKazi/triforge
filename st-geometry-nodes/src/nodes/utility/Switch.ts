import { BufferGeometry } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * Switch — select between two geometry inputs based on a boolean condition.
 * Blender: Geometry Nodes > Utilities > Switch
 *
 * parameters.switch == 0 → output geometryA
 * parameters.switch == 1 → output geometryB
 * Also accepts a boolean socket input that overrides the parameter.
 */
export class Switch extends GeometryNode {
  readonly nodeType = 'Switch'

  parameters: {
    /** 0 = false (output A), 1 = true (output B). Keyframeable. */
    switch: number
  }

  constructor(opts: {
    geometryA?: OutputRef | BufferGeometry | null
    geometryB?: OutputRef | BufferGeometry | null
    /** Boolean or number (>= 0.5 = true). Overrides parameters.switch when provided. */
    switch?: OutputRef | boolean | number | null
  } = {}) {
    super()
    this.parameters = { switch: 0 }

    if (opts.geometryA != null) this._inputs.geometryA = opts.geometryA as OutputRef | SocketValue
    if (opts.geometryB != null) this._inputs.geometryB = opts.geometryB as OutputRef | SocketValue
    if (opts.switch    != null) this._inputs.switch    = opts.switch    as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    // Resolve the switch condition
    let useB: boolean
    if ('switch' in inputs && inputs.switch != null) {
      const raw = inputs.switch
      if (typeof raw === 'boolean') {
        useB = raw
      } else if (typeof raw === 'number') {
        useB = raw >= 0.5
      } else {
        // Fall back to parameter
        useB = this.parameters.switch >= 0.5
      }
    } else {
      useB = this.parameters.switch >= 0.5
    }

    const chosen = useB
      ? (inputs.geometryB as BufferGeometry | null)
      : (inputs.geometryA as BufferGeometry | null)

    return { Geometry: chosen ?? null }
  }
}
