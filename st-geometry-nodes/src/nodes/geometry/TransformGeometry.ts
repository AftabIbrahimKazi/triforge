import { BufferGeometry, BufferAttribute, Matrix4, Euler, Quaternion, Vector3 } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * TransformGeometry — apply TRS transform to geometry.
 * Blender: Geometry Nodes > Geometry > Transform Geometry
 */
export class TransformGeometry extends GeometryNode {
  readonly nodeType = 'TransformGeometry'

  parameters: {
    translationX: number; translationY: number; translationZ: number
    rotationX:    number; rotationY:    number; rotationZ:    number  // radians
    scaleX:       number; scaleY:       number; scaleZ:       number
  }

  constructor(opts: {
    geometry?:    OutputRef | BufferGeometry | null
    translation?: [number, number, number]
    rotation?:    [number, number, number]
    scale?:       [number, number, number]
  } = {}) {
    super()
    const t = opts.translation ?? [0, 0, 0]
    const r = opts.rotation    ?? [0, 0, 0]
    const s = opts.scale       ?? [1, 1, 1]
    this.parameters = {
      translationX: t[0], translationY: t[1], translationZ: t[2],
      rotationX:    r[0], rotationY:    r[1], rotationZ:    r[2],
      scaleX:       s[0], scaleY:       s[1], scaleZ:       s[2],
    }
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { Geometry: null }

    const { translationX: tx, translationY: ty, translationZ: tz,
            rotationX:    rx, rotationY:    ry, rotationZ:    rz,
            scaleX:       sx, scaleY:       sy, scaleZ:       sz } = this.parameters

    const mat = new Matrix4().compose(
      new Vector3(tx, ty, tz),
      new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
      new Vector3(sx, sy, sz),
    )
    const normalMat = new Matrix4().copy(mat).invert().transpose()

    const geo     = src.clone()
    const posAttr = geo.getAttribute('position') as BufferAttribute
    const norAttr = geo.getAttribute('normal')   as BufferAttribute | undefined
    const v       = new Vector3()

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mat)
      posAttr.setXYZ(i, v.x, v.y, v.z)
    }
    if (norAttr) {
      for (let i = 0; i < norAttr.count; i++) {
        v.fromBufferAttribute(norAttr, i).applyMatrix4(normalMat).normalize()
        norAttr.setXYZ(i, v.x, v.y, v.z)
      }
    }

    return { Geometry: geo }
  }
}
