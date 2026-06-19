import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * FlipFaces — reverse face winding and negate normals.
 * Blender: Geometry Nodes > Mesh > Flip Faces
 */
export class FlipFaces extends GeometryNode {
  readonly nodeType = 'FlipFaces'
  parameters = {}

  constructor(opts: { geometry?: OutputRef | BufferGeometry | null } = {}) {
    super()
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { Geometry: null }

    const geo   = src.clone()
    const index = geo.getIndex()

    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1), c = index.getX(i + 2)
        index.setX(i + 1, c)
        index.setX(i + 2, b)
      }
      index.needsUpdate = true
    } else {
      const posAttr = geo.getAttribute('position') as BufferAttribute
      for (let i = 0; i < posAttr.count; i += 3) {
        for (let c = 0; c < 3; c++) {
          const va = posAttr.getComponent(i + 1, c)
          const vb = posAttr.getComponent(i + 2, c)
          posAttr.setComponent(i + 1, c, vb)
          posAttr.setComponent(i + 2, c, va)
        }
      }
      posAttr.needsUpdate = true
    }

    const norAttr = geo.getAttribute('normal') as BufferAttribute | undefined
    if (norAttr) {
      for (let i = 0; i < norAttr.count; i++) {
        norAttr.setXYZ(i, -norAttr.getX(i), -norAttr.getY(i), -norAttr.getZ(i))
      }
      norAttr.needsUpdate = true
    }

    return { Geometry: geo }
  }
}
