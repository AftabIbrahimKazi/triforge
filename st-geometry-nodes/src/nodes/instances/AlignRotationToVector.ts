import { BufferGeometry, BufferAttribute, Vector3, Quaternion, Euler } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

type VectorField = (index: number, count: number) => [number, number, number]

/**
 * AlignRotationToVector — write a per-point `rotation` attribute that aligns an
 * instance axis to a target vector field.
 * Blender: Geometry Nodes > Instances > Align Euler to Vector
 *
 * Writes userData.rotations (Float32Array, 3 floats per point, Euler XYZ radians)
 * and a THREE BufferAttribute "rotation" to the cloned geometry.
 */
export class AlignRotationToVector extends GeometryNode {
  readonly nodeType = 'AlignRotationToVector'

  parameters: {
    /** Constant target vector X component (used when no vectorField supplied). */
    vectorX: number
    /** Constant target vector Y component. */
    vectorY: number
    /** Constant target vector Z component. */
    vectorZ: number
    /** Blend factor 0..1 between identity and full alignment. Blender: Factor. */
    factor: number
    /**
     * Source axis of the instance that will be aligned to the vector.
     * 0 = X, 1 = Y, 2 = Z (default).
     * Blender: Axis (X / Y / Z).
     */
    axis: number
  }

  private _vectorField?: VectorField

  constructor(opts: {
    geometry?:    OutputRef | BufferGeometry | null
    vectorField?: VectorField
    vectorX?:     number
    vectorY?:     number
    vectorZ?:     number
    factor?:      number
    /** 0 = X, 1 = Y, 2 = Z */
    axis?:        number
  } = {}) {
    super()
    this.parameters = {
      vectorX: opts.vectorX ?? 0,
      vectorY: opts.vectorY ?? 1,
      vectorZ: opts.vectorZ ?? 0,
      factor:  opts.factor  ?? 1.0,
      axis:    opts.axis    ?? 2,
    }

    if (opts.geometry    != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
    if (opts.vectorField != null) this._vectorField = opts.vectorField
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { Geometry: null }

    const { vectorX, vectorY, vectorZ, factor, axis } = this.parameters
    const clampedFactor = Math.min(1, Math.max(0, factor))

    const geo    = src.clone()
    const posAttr = geo.getAttribute('position') as BufferAttribute
    const n       = posAttr.count

    const rotData = new Float32Array(n * 3)

    // Axis vectors that will be aligned to the target
    const axisVectors: [Vector3, Vector3, Vector3] = [
      new Vector3(1, 0, 0), // X
      new Vector3(0, 1, 0), // Y
      new Vector3(0, 0, 1), // Z
    ]
    const srcAxis = axisVectors[Math.min(2, Math.max(0, Math.round(axis)))]

    const identity = new Quaternion()

    for (let i = 0; i < n; i++) {
      let tx = vectorX, ty = vectorY, tz = vectorZ
      if (this._vectorField) {
        ;[tx, ty, tz] = this._vectorField(i, n)
      }

      const target = new Vector3(tx, ty, tz)
      const len = target.length()

      let qFull: Quaternion
      if (len < 1e-10) {
        // Degenerate vector — keep identity
        qFull = identity.clone()
      } else {
        target.divideScalar(len)
        qFull = new Quaternion().setFromUnitVectors(srcAxis, target)
      }

      // Slerp towards identity by (1 - factor)
      const q = identity.clone().slerp(qFull, clampedFactor)
      const euler = new Euler().setFromQuaternion(q, 'XYZ')

      rotData[i * 3 + 0] = euler.x
      rotData[i * 3 + 1] = euler.y
      rotData[i * 3 + 2] = euler.z
    }

    // Store as BufferAttribute and userData for downstream nodes
    geo.setAttribute('rotation', new BufferAttribute(rotData, 3))
    geo.userData = { ...geo.userData, rotations: rotData }

    return { Geometry: geo }
  }
}
