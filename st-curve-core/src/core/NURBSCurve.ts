import { Vector3 } from 'three'
import { BaseCurve } from './BaseCurve.js'

/**
 * NURBSCurve — Non-Uniform Rational B-Spline.
 * Blender: NURBS spline type.
 *
 * Supports arbitrary degree (order = degree + 1), non-uniform knots, and per-point weights.
 * A weight > 1 pulls the curve toward that control point; weight = 1 is uniform (B-spline).
 * Circle arcs require weight = cos(θ/2) where θ is the arc angle.
 */
export class NURBSCurve extends BaseCurve {
  readonly curveType = 'NURBSCurve'
  parameters: Record<string, number> = {}

  private _points: Vector3[]
  private _weights: number[]
  private _knots: number[]
  /** Blender: Order U — degree = order - 1. Default 4 (cubic). */
  order: number
  closed: boolean

  constructor(points: Vector3[], opts: {
    order?: number
    weights?: number[]
    knots?: number[]
    closed?: boolean
  } = {}) {
    super()
    if (points.length < 2) throw new Error('NURBSCurve requires at least 2 control points')
    this._points  = points
    this.order    = Math.min(opts.order ?? 4, points.length)  // order must be ≤ n
    this._weights = opts.weights ?? points.map(() => 1)
    this.closed   = opts.closed ?? false

    this._knots = opts.knots ?? buildOpenUniformKnots(points.length, this.order)
  }

  get points():  readonly Vector3[] { return this._points }
  get weights(): readonly number[]  { return this._weights }
  get knots():   readonly number[]  { return this._knots }

  getPoint(t: number, target = new Vector3()): Vector3 {
    t = Math.max(0, Math.min(1, t))
    const n    = this._points.length
    const p    = this.order - 1   // degree
    const knots = this._knots

    // Map t to knot range [knots[p], knots[n]]
    const lo = knots[p], hi = knots[n]
    const u  = lo + t * (hi - lo)

    let wx = 0, wy = 0, wz = 0, ww = 0

    for (let i = 0; i < n; i++) {
      const b = basisFunction(i, p, u, knots, hi)
      const w = this._weights[i] * b
      wx += this._points[i].x * w
      wy += this._points[i].y * w
      wz += this._points[i].z * w
      ww += w
    }

    if (ww === 0) return target.copy(this._points[0])
    return target.set(wx / ww, wy / ww, wz / ww)
  }
}

/** Cox-de Boor recursion for B-spline basis function N_{i,p}(u). */
function basisFunction(i: number, p: number, u: number, knots: number[], uMax: number): number {
  if (p === 0) {
    // Special case: at the last knot value, the last basis function = 1
    if (u === uMax) return (knots[i + 1] === uMax) ? 1 : 0
    return (u >= knots[i] && u < knots[i + 1]) ? 1 : 0
  }
  const left  = knots[i + p]     - knots[i]
  const right = knots[i + p + 1] - knots[i + 1]
  let result = 0
  if (left  > 0) result += ((u - knots[i])         / left)  * basisFunction(i,     p - 1, u, knots, uMax)
  if (right > 0) result += ((knots[i+p+1] - u)     / right) * basisFunction(i + 1, p - 1, u, knots, uMax)
  return result
}

/** Open uniform knot vector for n control points and given order (clamped at both ends). */
export function buildOpenUniformKnots(n: number, order: number): number[] {
  const p     = order - 1
  const total = n + order
  const knots: number[] = []
  for (let i = 0; i < total; i++) {
    if (i < order)        knots.push(0)
    else if (i >= n)      knots.push(n - p)
    else                  knots.push(i - p)
  }
  return knots
}

/**
 * Build a NURBS circle in XY plane with given radius.
 * Uses 9 control points with cos(45°) weights for exact circular arcs.
 */
export function buildNURBSCircle(radius = 1): { points: Vector3[]; weights: number[]; knots: number[] } {
  const w  = Math.SQRT1_2  // cos(45°) = 1/√2
  const r  = radius
  const points: Vector3[] = [
    new Vector3(r, 0, 0),
    new Vector3(r, r, 0),
    new Vector3(0, r, 0),
    new Vector3(-r, r, 0),
    new Vector3(-r, 0, 0),
    new Vector3(-r, -r, 0),
    new Vector3(0, -r, 0),
    new Vector3(r, -r, 0),
    new Vector3(r, 0, 0),
  ]
  const weights = [1, w, 1, w, 1, w, 1, w, 1]
  const knots   = [0,0,0,1,1,2,2,3,3,4,4,4]
  return { points, weights, knots }
}
