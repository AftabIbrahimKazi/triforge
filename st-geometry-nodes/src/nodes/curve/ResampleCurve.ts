import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

type CurveLike = { getPoint(t: number, target?: Vector3): Vector3 }

/**
 * ResampleCurve — sample a curve into a point cloud at uniform intervals.
 * Blender: Geometry Nodes > Curve > Resample Curve
 *
 * Accepts any object with a `getPoint(t)` method.
 * Output is a BufferGeometry of points (no index), suitable as input
 * to InstanceOnPoints or CurveToMesh.
 */
export class ResampleCurve extends GeometryNode {
  readonly nodeType = 'ResampleCurve'

  parameters: {
    /** Number of sample points. Blender: Count. Default 32. */
    count: number
  }

  constructor(opts: {
    curve?:  OutputRef | CurveLike | null
    count?:  number
  } = {}) {
    super()
    this.parameters = { count: opts.count ?? 32 }
    if (opts.curve != null) this._inputs.curve = opts.curve as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const curve = inputs.curve as CurveLike | null
    if (!curve || typeof curve.getPoint !== 'function') return { Geometry: null }

    const n   = Math.max(2, Math.round(this.parameters.count))
    const pos = new Float32Array(n * 3)
    const tmp = new Vector3()

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      curve.getPoint(t, tmp)
      pos[i*3]=tmp.x; pos[i*3+1]=tmp.y; pos[i*3+2]=tmp.z
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    return { Geometry: geo }
  }
}
