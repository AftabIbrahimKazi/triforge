import type { Vector3 } from 'three'

/**
 * ICurve — the minimal interface shared by all st-curve-core curve types
 * (BezierCurve, NURBSCurve, CatmullRomCurve) and any custom curve.
 *
 * Consumers (CurveTube, PathFollow, CurveToMesh, etc.) accept ICurve so they
 * work with any curve implementation — not just the ones in st-curve-core.
 *
 * @example
 * // A custom circle curve compatible with the whole ecosystem:
 * const circle: ICurve = {
 *   getPoint: (t, out = new Vector3()) =>
 *     out.set(Math.cos(t * Math.PI * 2), 0, Math.sin(t * Math.PI * 2)),
 *   getTangent: (t, out = new Vector3()) =>
 *     out.set(-Math.sin(t * Math.PI * 2), 0, Math.cos(t * Math.PI * 2)).normalize(),
 * }
 */
export interface ICurve {
  /**
   * Sample the curve at normalised parameter t ∈ [0, 1].
   * Returns a world-space point; writes into `target` if supplied.
   */
  getPoint(t: number, target?: Vector3): Vector3
  /**
   * Sample the unit tangent (direction of travel) at t ∈ [0, 1].
   * Returns a normalised Vector3; writes into `target` if supplied.
   */
  getTangent(t: number, target?: Vector3): Vector3
}
