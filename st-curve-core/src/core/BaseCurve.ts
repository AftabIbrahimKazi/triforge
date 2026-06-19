import { Vector3 } from 'three'

/**
 * Abstract base for all curve types.
 * Mirrors Blender's internal curve spline: evaluate at parameter t ∈ [0,1].
 */
export abstract class BaseCurve {
  abstract readonly curveType: string
  /** All scalar inputs live here for GSAP/keyframe compatibility. */
  abstract parameters: Record<string, number>

  /**
   * Evaluate the curve at parameter t ∈ [0,1].
   * t=0 → start point, t=1 → end point.
   */
  abstract getPoint(t: number, target?: Vector3): Vector3

  /**
   * Tangent vector at t (unit length).
   * Default: finite difference. Override for analytic tangents.
   */
  getTangent(t: number, target = new Vector3()): Vector3 {
    const delta = 1e-4
    const t0 = Math.max(0, t - delta)
    const t1 = Math.min(1, t + delta)
    const p0 = this.getPoint(t0)
    const p1 = this.getPoint(t1)
    return target.subVectors(p1, p0).normalize()
  }

  /** Arc length of the curve, sampled at `divisions` points. */
  getLength(divisions = 200): number {
    let len = 0
    let prev = this.getPoint(0)
    for (let i = 1; i <= divisions; i++) {
      const cur = this.getPoint(i / divisions)
      len += prev.distanceTo(cur)
      prev = cur
    }
    return len
  }

  /**
   * Build a cumulative arc-length LUT (lookup table).
   * Returns array of {t, len} pairs with `divisions+1` entries.
   * Used internally for uniform-speed parameterization.
   */
  buildArcLengthLUT(divisions = 200): { t: number; len: number }[] {
    const lut: { t: number; len: number }[] = [{ t: 0, len: 0 }]
    let acc = 0
    let prev = this.getPoint(0)
    for (let i = 1; i <= divisions; i++) {
      const ti  = i / divisions
      const cur = this.getPoint(ti)
      acc += prev.distanceTo(cur)
      lut.push({ t: ti, len: acc })
      prev = cur
    }
    return lut
  }

  /**
   * Map a uniform arc-length fraction u ∈ [0,1] → curve parameter t ∈ [0,1].
   * Enables constant-speed path-follow.
   */
  getUtoTmapping(u: number, lut: { t: number; len: number }[]): number {
    const totalLen = lut[lut.length - 1].len
    const target   = u * totalLen
    // Binary search for the segment
    let lo = 0, hi = lut.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (lut[mid].len < target) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return 0
    const a = lut[lo - 1], b = lut[lo]
    if (b.len === a.len) return b.t
    const alpha = (target - a.len) / (b.len - a.len)
    return a.t + alpha * (b.t - a.t)
  }

  /**
   * Sample N evenly-spaced points along the curve (arc-length uniform).
   */
  getSpacedPoints(count: number, divisions = 200): Vector3[] {
    const lut = this.buildArcLengthLUT(divisions)
    return Array.from({ length: count }, (_, i) => {
      const t = this.getUtoTmapping(i / (count - 1), lut)
      return this.getPoint(t)
    })
  }
}
