import { GeometryNode } from '../../core/GeometryNode.js'
import type { Inputs, SocketValue } from '../../core/GeometryNode.js'
import type { BufferGeometry } from 'three'

/**
 * GeometryLiteral — wraps a concrete BufferGeometry as a graph-compatible node.
 *
 * Use this inside a RepeatZone body to feed the current iteration's geometry
 * into other geometry nodes without breaking the lazy graph model.
 *
 * @example
 * const result = new RepeatZone({
 *   geometry: sphere.output('Geometry'),
 *   iterations: 5,
 *   body: (geo, i) => {
 *     const displaced = new SetPosition({
 *       geometry: new GeometryLiteral(geo).output('Geometry'),
 *       offset: [0, 0.01, 0],
 *     })
 *     return displaced.output('Geometry').evaluate() as BufferGeometry
 *   },
 * })
 */
export class GeometryLiteral extends GeometryNode {
  readonly nodeType = 'GeometryLiteral'
  parameters        = {}

  private readonly _geo: BufferGeometry

  constructor(geo: BufferGeometry) {
    super()
    this._geo = geo
  }

  _evaluate(_inputs: Inputs): Record<string, SocketValue> {
    return { Geometry: this._geo }
  }
}
