import { BufferGeometry, BufferAttribute, Matrix4, Quaternion, Vector3, Euler } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'
import { mergeGeometries } from '../geometry/JoinGeometry.js'

type VectorField = (index: number, count: number) => [number, number, number]
type FloatField  = (index: number, count: number) => number

/**
 * InstanceOnPoints — place instances of a geometry at each point.
 * Blender: Geometry Nodes > Instances > Instance on Points
 *
 * Scale and rotation can be fields (callbacks) for per-instance variation.
 */
export class InstanceOnPoints extends GeometryNode {
  readonly nodeType = 'InstanceOnPoints'

  parameters: {
    scaleX: number; scaleY: number; scaleZ: number
    rotationX: number; rotationY: number; rotationZ: number
  }

  private _scaleField?:    ((i: number, n: number) => number | [number,number,number])
  private _rotationField?: VectorField

  constructor(opts: {
    points?:   OutputRef | BufferGeometry | null
    instance?: OutputRef | BufferGeometry | null
    scale?:    [number,number,number] | VectorField | FloatField
    rotation?: [number,number,number] | VectorField
    /** Align instance Z to point normal. Blender: Align Euler to Vector. */
    alignToNormal?: boolean
  } = {}) {
    super()
    this.parameters = {
      scaleX: 1, scaleY: 1, scaleZ: 1,
      rotationX: 0, rotationY: 0, rotationZ: 0,
    }

    if (opts.points   != null) this._inputs.points   = opts.points   as OutputRef | SocketValue
    if (opts.instance != null) this._inputs.instance = opts.instance as OutputRef | SocketValue
    this._inputs.alignToNormal = opts.alignToNormal ?? false

    if (typeof opts.scale === 'function') {
      this._scaleField = opts.scale as (i: number, n: number) => number | [number,number,number]
    } else if (Array.isArray(opts.scale)) {
      const [x, y, z] = opts.scale
      this.parameters.scaleX = x; this.parameters.scaleY = y; this.parameters.scaleZ = z
    }

    if (typeof opts.rotation === 'function') {
      this._rotationField = opts.rotation as VectorField
    } else if (Array.isArray(opts.rotation)) {
      const [x, y, z] = opts.rotation
      this.parameters.rotationX = x; this.parameters.rotationY = y; this.parameters.rotationZ = z
    }
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const pts  = inputs.points   as BufferGeometry | null
    const inst = inputs.instance as BufferGeometry | null
    const alignToNormal = inputs.alignToNormal as boolean ?? false
    if (!pts || !inst) return { Geometry: null }

    const pPos  = pts.getAttribute('position') as BufferAttribute
    const pNor  = pts.getAttribute('normal')   as BufferAttribute | undefined
    const n     = pPos.count
    const geos: BufferGeometry[] = []

    const { scaleX, scaleY, scaleZ, rotationX, rotationY, rotationZ } = this.parameters
    const baseQ  = new Quaternion().setFromEuler(new Euler(rotationX, rotationY, rotationZ))

    const up = new Vector3(0, 0, 1)

    for (let i = 0; i < n; i++) {
      const px = pPos.getX(i), py = pPos.getY(i), pz = pPos.getZ(i)

      // Scale
      let sx = scaleX, sy = scaleY, sz = scaleZ
      if (this._scaleField) {
        const result = this._scaleField(i, n)
        if (typeof result === 'number') {
          sx = sy = sz = result
        } else {
          const [vx,vy,vz] = result as [number,number,number]
          sx = vx; sy = vy; sz = vz
        }
      }

      // Rotation
      let q = baseQ.clone()
      if (this._rotationField) {
        const [rx,ry,rz] = this._rotationField(i, n)
        q = new Quaternion().setFromEuler(new Euler(rx, ry, rz))
      }

      if (alignToNormal && pNor) {
        const nx = pNor.getX(i), ny = pNor.getY(i), nz = pNor.getZ(i)
        const normal = new Vector3(nx, ny, nz).normalize()
        q.multiplyQuaternions(new Quaternion().setFromUnitVectors(up, normal), q)
      }

      const mat = new Matrix4().compose(new Vector3(px, py, pz), q, new Vector3(sx, sy, sz))
      const geo = inst.clone()

      const posAttr = geo.getAttribute('position') as BufferAttribute
      const norAttr = geo.getAttribute('normal')   as BufferAttribute | undefined
      const v       = new Vector3()
      const normalMat = new Matrix4().copy(mat).invert().transpose()

      for (let j = 0; j < posAttr.count; j++) {
        v.fromBufferAttribute(posAttr, j).applyMatrix4(mat)
        posAttr.setXYZ(j, v.x, v.y, v.z)
      }
      if (norAttr) {
        for (let j = 0; j < norAttr.count; j++) {
          v.fromBufferAttribute(norAttr, j).applyMatrix4(normalMat).normalize()
          norAttr.setXYZ(j, v.x, v.y, v.z)
        }
      }
      geos.push(geo)
    }

    if (geos.length === 0) return { Geometry: null }
    return { Geometry: mergeGeometries(geos) }
  }
}
