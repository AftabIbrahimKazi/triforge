import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

type VectorField = (index: number, count: number) => [number, number, number]

/**
 * SetPosition — displace vertex positions by a field or offset.
 * Blender: Geometry Nodes > Geometry > Set Position
 *
 * The `offset` can be:
 *   - a constant [x, y, z] applied to every vertex
 *   - a VectorField callback: (vertexIndex, vertexCount) => [x, y, z]
 */
export class SetPosition extends GeometryNode {
  readonly nodeType = 'SetPosition'
  parameters = {}

  private _offset: VectorField | [number,number,number] | OutputRef

  constructor(opts: {
    geometry?: OutputRef | BufferGeometry | null
    offset?:  VectorField | [number,number,number] | OutputRef
  } = {}) {
    super()
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
    this._offset = opts.offset ?? [0, 0, 0]
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { Geometry: null }

    const geo     = src.clone()
    const posAttr = geo.getAttribute('position') as BufferAttribute
    const norAttr = geo.getAttribute('normal')   as BufferAttribute | undefined
    const n       = posAttr.count
    const v       = new Vector3()

    const offset = this._offset as VectorField | [number,number,number]
    const isField = typeof offset === 'function'

    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(posAttr, i)
      const [dx, dy, dz] = isField ? (offset as VectorField)(i, n) : offset as [number,number,number]
      posAttr.setXYZ(i, v.x + dx, v.y + dy, v.z + dz)
    }

    if (norAttr) geo.computeVertexNormals()
    return { Geometry: geo }
  }
}
