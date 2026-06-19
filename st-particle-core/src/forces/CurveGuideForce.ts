import { Vector3 }        from 'three'
import type { CatmullRomCurve3 } from 'three'
import { BaseForce }       from '../core/BaseForce.js'
import type { Particle }   from '../core/Particle.js'

/**
 * CurveGuideForce — attracts particles toward the nearest point on a
 * CatmullRomCurve3. (Blender: Force Fields → Curve Guide)
 *
 * The curve is sampled at `samples` points each construction; the nearest
 * sample is found each apply() call (O(samples) — keep samples ≤ 256 for
 * large pools). The particle is attracted to that nearest point.
 *
 * parameters.clumpFactor: 0 = attract to nearest point, 1 = also align
 * velocity toward the curve tangent at that point (Blender: Clump).
 * parameters.freeEnd:     0 = full curve influence, 1 = weaker at the
 * end of the curve (Blender: Free End).
 */
export class CurveGuideForce extends BaseForce {
  parameters: Record<string, number>

  private readonly _pts:  Vector3[]   // pre-sampled curve points
  private readonly _tans: Vector3[]   // tangents at each sample
  private readonly _tmp:  Vector3 = new Vector3()

  /**
   * @param curve   A THREE.CatmullRomCurve3 — must be set before the first
   *                update() call. Can be replaced at runtime; call resample().
   * @param opts    strength: attraction force magnitude (Blender: Strength).
   *                clumpFactor: tangent-alignment blend 0–1 (Blender: Clump).
   *                freeEnd: reduce influence near curve end 0–1 (Blender: Free End).
   *                samples: internal sampling resolution (default 64).
   */
  constructor(
    public curve: CatmullRomCurve3,
    opts: {
      strength?:     number
      clumpFactor?:  number
      freeEnd?:      number
      samples?:      number
      maxDistance?:  number
    } = {},
  ) {
    super()
    this.parameters = {
      strength:    opts.strength    ?? 1,
      clumpFactor: opts.clumpFactor ?? 0,
      freeEnd:     opts.freeEnd     ?? 0,
      maxDistance: opts.maxDistance ?? 0,
    }
    const n = Math.max(4, Math.min(256, opts.samples ?? 64))
    this._pts  = Array.from({ length: n }, () => new Vector3())
    this._tans = Array.from({ length: n }, () => new Vector3())
    this._buildSamples(n)
  }

  /** Re-sample the curve — call after modifying curve control points. */
  resample(): void {
    this._buildSamples(this._pts.length)
  }

  apply(particle: Particle, dt: number): void {
    const n = this._pts.length
    if (n === 0) return

    // maxDistance: skip particles too far from the closest curve point
    const maxD = this.parameters.maxDistance
    if (maxD > 0) {
      let minD2 = Infinity
      const px = particle.position.x, py = particle.position.y, pz = particle.position.z
      for (let i = 0; i < n; i++) {
        const q  = this._pts[i]
        const d2 = (px - q.x) ** 2 + (py - q.y) ** 2 + (pz - q.z) ** 2
        if (d2 < minD2) minD2 = d2
      }
      if (minD2 > maxD * maxD) return
    }

    // Find nearest sampled point
    let nearestIdx = 0
    let nearestDist2 = Infinity
    const px = particle.position.x
    const py = particle.position.y
    const pz = particle.position.z

    for (let i = 0; i < n; i++) {
      const q = this._pts[i]
      const dx = px - q.x
      const dy = py - q.y
      const dz = pz - q.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < nearestDist2) {
        nearestDist2 = d2
        nearestIdx   = i
      }
    }

    const target = this._pts[nearestIdx]
    const tan    = this._tans[nearestIdx]
    const { strength, clumpFactor, freeEnd } = this.parameters

    // Free-end attenuation: t ∈ [0,1] along curve — weaken near the end
    const t       = nearestIdx / Math.max(n - 1, 1)
    const freeAtt = freeEnd > 0 ? 1 - t * freeEnd : 1

    const effStr  = strength * freeAtt * dt

    // Attraction toward nearest point
    this._tmp.set(target.x - px, target.y - py, target.z - pz)
    const dist = this._tmp.length()
    if (dist > 1e-6 && clumpFactor < 1) {
      const attStr = effStr * (1 - clumpFactor)
      particle.velocity.x += (this._tmp.x / dist) * attStr
      particle.velocity.y += (this._tmp.y / dist) * attStr
      particle.velocity.z += (this._tmp.z / dist) * attStr
    }

    // Tangent alignment (clump): steer velocity toward curve direction
    if (clumpFactor > 0) {
      const tanLen = tan.length()
      if (tanLen > 1e-6) {
        const tnx = tan.x / tanLen
        const tny = tan.y / tanLen
        const tnz = tan.z / tanLen
        // Project current velocity onto tangent then lerp
        const dot = particle.velocity.x * tnx + particle.velocity.y * tny + particle.velocity.z * tnz
        particle.velocity.x += (dot * tnx - particle.velocity.x) * clumpFactor * effStr
        particle.velocity.y += (dot * tny - particle.velocity.y) * clumpFactor * effStr
        particle.velocity.z += (dot * tnz - particle.velocity.z) * clumpFactor * effStr
      }
    }
  }

  private _buildSamples(n: number): void {
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1)
      this.curve.getPoint(t, this._pts[i])
      this.curve.getTangent(t, this._tans[i])
    }
  }
}
