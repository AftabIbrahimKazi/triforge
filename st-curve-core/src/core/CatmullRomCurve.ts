import { Vector3 } from 'three'
import { BaseCurve } from './BaseCurve.js'

/**
 * CatmullRomCurve — smooth interpolating spline through all control points.
 * Blender: Poly spline with smooth interpolation / Path animation target.
 *
 * Unlike Bezier, every point lies ON the curve. Ideal for camera paths,
 * particle guides, and path-follow animations.
 *
 * Supports Catmull-Rom (tension=0.5) and general tension control.
 * Blender uses Catmull-Rom for its path animation curves by default.
 */
export class CatmullRomCurve extends BaseCurve {
  readonly curveType = 'CatmullRomCurve'
  parameters: { tension: number }

  private _points: Vector3[]
  closed: boolean

  constructor(points: Vector3[], opts: { tension?: number; closed?: boolean } = {}) {
    super()
    if (points.length < 2) throw new Error('CatmullRomCurve requires at least 2 points')
    this._points   = points
    this.closed     = opts.closed ?? false
    this.parameters = { tension: opts.tension ?? 0.5 }
  }

  get points(): readonly Vector3[] { return this._points }

  getPoint(t: number, target = new Vector3()): Vector3 {
    t = Math.max(0, Math.min(1, t))
    const pts = this._points
    const n   = pts.length

    const segments = this.closed ? n : n - 1
    const seg      = Math.min(Math.floor(t * segments), segments - 1)
    const local    = t * segments - seg

    const alpha = this.parameters.tension

    let p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3

    if (this.closed) {
      p0 = pts[(seg - 1 + n) % n]
      p1 = pts[seg % n]
      p2 = pts[(seg + 1) % n]
      p3 = pts[(seg + 2) % n]
    } else {
      // Clamp phantom points at both ends
      p0 = seg === 0 ? pts[0] : pts[seg - 1]
      p1 = pts[seg]
      p2 = pts[seg + 1]
      p3 = seg + 2 < n ? pts[seg + 2] : pts[n - 1]
    }

    return catmullRom(p0, p1, p2, p3, local, alpha, target)
  }

  getTangent(t: number, target = new Vector3()): Vector3 {
    t = Math.max(0, Math.min(1, t))
    const pts = this._points
    const n   = pts.length

    const segments = this.closed ? n : n - 1
    const seg      = Math.min(Math.floor(t * segments), segments - 1)
    const local    = t * segments - seg
    const alpha    = this.parameters.tension

    let p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3
    if (this.closed) {
      p0 = pts[(seg - 1 + n) % n]
      p1 = pts[seg % n]
      p2 = pts[(seg + 1) % n]
      p3 = pts[(seg + 2) % n]
    } else {
      p0 = seg === 0 ? pts[0] : pts[seg - 1]
      p1 = pts[seg]
      p2 = pts[seg + 1]
      p3 = seg + 2 < n ? pts[seg + 2] : pts[n - 1]
    }

    return catmullRomTangent(p0, p1, p2, p3, local, alpha, target)
  }
}

/** Cubic Hermite form of Catmull-Rom. alpha = tension (0.5 = standard). */
function catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, alpha: number, out: Vector3): Vector3 {
  const t2 = t * t, t3 = t2 * t
  // Tangent vectors at p1 and p2
  const m1x = alpha * (p2.x - p0.x), m1y = alpha * (p2.y - p0.y), m1z = alpha * (p2.z - p0.z)
  const m2x = alpha * (p3.x - p1.x), m2y = alpha * (p3.y - p1.y), m2z = alpha * (p3.z - p1.z)

  // Hermite basis
  const h00 = 2*t3 - 3*t2 + 1
  const h10 = t3 - 2*t2 + t
  const h01 = -2*t3 + 3*t2
  const h11 = t3 - t2

  return out.set(
    h00*p1.x + h10*m1x + h01*p2.x + h11*m2x,
    h00*p1.y + h10*m1y + h01*p2.y + h11*m2y,
    h00*p1.z + h10*m1z + h01*p2.z + h11*m2z,
  )
}

function catmullRomTangent(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, alpha: number, out: Vector3): Vector3 {
  const t2 = t * t
  const m1x = alpha * (p2.x - p0.x), m1y = alpha * (p2.y - p0.y), m1z = alpha * (p2.z - p0.z)
  const m2x = alpha * (p3.x - p1.x), m2y = alpha * (p3.y - p1.y), m2z = alpha * (p3.z - p1.z)

  // Derivative of Hermite basis
  const dh00 = 6*t2 - 6*t
  const dh10 = 3*t2 - 4*t + 1
  const dh01 = -6*t2 + 6*t
  const dh11 = 3*t2 - 2*t

  const x = dh00*p1.x + dh10*m1x + dh01*p2.x + dh11*m2x
  const y = dh00*p1.y + dh10*m1y + dh01*p2.y + dh11*m2y
  const z = dh00*p1.z + dh10*m1z + dh01*p2.z + dh11*m2z
  const len = Math.sqrt(x*x + y*y + z*z) || 1
  return out.set(x/len, y/len, z/len)
}
