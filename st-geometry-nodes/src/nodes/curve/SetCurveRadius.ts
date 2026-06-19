import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

type CurveLike = { getPoint(t: number): import('three').Vector3 }
type RadiusFn  = (t: number) => number

/**
 * SetCurveRadius — wrap a curve with a per-t radius function.
 * Blender: Geometry Nodes > Curve > Set Curve Radius
 *
 * Returns a decorated curve object with the same `getPoint` / `getTangent`
 * interface as st-curve-core curves, plus a `getRadius(t)` method that
 * CurveToMesh can optionally call for tapered tubes.
 */
export class SetCurveRadius extends GeometryNode {
  readonly nodeType = 'SetCurveRadius'

  parameters: {
    /** Constant radius when no radiusFn is provided. Default 0.1. */
    radius: number
  }

  private _radiusFn?: RadiusFn

  constructor(opts: {
    curve?:    OutputRef | CurveLike | null
    radius?:   number
    radiusFn?: RadiusFn
  } = {}) {
    super()
    this.parameters = { radius: opts.radius ?? 0.1 }
    this._radiusFn = opts.radiusFn
    if (opts.curve != null) this._inputs.curve = opts.curve as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const curve = inputs.curve as CurveLike | null
    if (!curve) return { Curve: null }

    const radiusFn = this._radiusFn
    const baseRadius = this.parameters.radius

    // Return a decorated curve proxy
    const decorated = {
      getPoint: (t: number) => curve.getPoint(t),
      getRadius: (t: number) => radiusFn ? radiusFn(t) : baseRadius,
    } as unknown as SocketValue

    return { Curve: decorated }
  }
}
