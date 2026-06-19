/**
 * QuaternionKeyframe — a single keyframe for a quaternion animation channel.
 * Blender: F-Curve quaternion rotation channel group.
 */
export interface QuaternionKeyframe {
  time: number
  value: { x: number; y: number; z: number; w: number }
}

/** Quaternion-like target — any object with x, y, z, w numeric properties. */
export type QuaternionTarget = { x: number; y: number; z: number; w: number }

/**
 * QuaternionTrack — drives a THREE.Quaternion-like object {x,y,z,w} with SLERP.
 * Blender: F-Curve quaternion rotation channel group.
 *
 * SLERP is implemented manually (dot product, theta, sin-weighted blend).
 * Uses THREE.Quaternion only as a type reference — no internal THREE methods relied upon.
 *
 * Usage:
 *   const track = new QuaternionTrack(bone.quaternion, [
 *     { time: 0, value: new THREE.Quaternion() },
 *     { time: 1, value: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2) },
 *   ])
 *   track.evaluate(0.5) // SLERPs and writes x,y,z,w onto the quaternion
 */
export class QuaternionTrack {
  /** The quaternion-like object this track writes to. */
  readonly target: QuaternionTarget

  private _keyframes: QuaternionKeyframe[]

  constructor(
    target: QuaternionTarget,
    keyframes: QuaternionKeyframe[] = [],
  ) {
    this.target = target
    this._keyframes = [...keyframes].sort((a, b) => a.time - b.time)
  }

  get keyframes(): readonly QuaternionKeyframe[] { return this._keyframes }

  /** Add or replace a keyframe at the given time. Keeps list sorted. */
  addKeyframe(kf: QuaternionKeyframe): void {
    const idx = this._keyframes.findIndex(k => k.time === kf.time)
    if (idx !== -1) {
      this._keyframes[idx] = kf
    } else {
      this._keyframes.push(kf)
      this._keyframes.sort((a, b) => a.time - b.time)
    }
  }

  /** Duration of this track in seconds (time of the last keyframe). */
  get duration(): number {
    if (this._keyframes.length === 0) return 0
    return this._keyframes[this._keyframes.length - 1].time
  }

  /**
   * Evaluate the track at time `t` and write the SLERP result to `target`.
   * - Before first keyframe: clamps to first keyframe value.
   * - After last keyframe: clamps to last keyframe value.
   */
  evaluate(t: number): void {
    const kfs = this._keyframes
    if (kfs.length === 0) return
    if (kfs.length === 1 || t <= kfs[0].time) {
      copyQuat(this.target, kfs[0].value)
      return
    }
    if (t >= kfs[kfs.length - 1].time) {
      copyQuat(this.target, kfs[kfs.length - 1].value)
      return
    }

    // Binary search for the segment [kf0, kf1] containing t
    let lo = 0, hi = kfs.length - 2
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (kfs[mid + 1].time <= t) lo = mid + 1
      else hi = mid
    }

    const kf0 = kfs[lo]
    const kf1 = kfs[lo + 1]
    const span = kf1.time - kf0.time
    const alpha = span === 0 ? 0 : (t - kf0.time) / span

    const result = slerp(kf0.value, kf1.value, alpha)
    copyQuat(this.target, result)
  }

  /**
   * Sample the track at time `t` without modifying the target.
   * Returns a plain {x,y,z,w} object.
   */
  sample(t: number): { x: number; y: number; z: number; w: number } {
    // Save & restore
    const prev = { x: this.target.x, y: this.target.y, z: this.target.z, w: this.target.w }
    this.evaluate(t)
    const result = { x: this.target.x, y: this.target.y, z: this.target.z, w: this.target.w }
    copyQuat(this.target, prev)
    return result
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function copyQuat(
  dst: QuaternionTarget,
  src: { x: number; y: number; z: number; w: number },
): void {
  dst.x = src.x
  dst.y = src.y
  dst.z = src.z
  dst.w = src.w
}

/**
 * Manual SLERP between two quaternions.
 * Returns a normalised quaternion — does not rely on THREE internals.
 */
function slerp(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
  t: number,
): { x: number; y: number; z: number; w: number } {
  let bx = b.x, by = b.y, bz = b.z, bw = b.w

  // Compute the dot product
  let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw

  // If dot is negative, negate b to ensure shortest path
  if (dot < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw
    dot = -dot
  }

  // Clamp dot to valid acos range
  if (dot > 0.9995) {
    // Quaternions are very close — linear interpolation to avoid numerical instability
    return normaliseQuat({
      x: a.x + t * (bx - a.x),
      y: a.y + t * (by - a.y),
      z: a.z + t * (bz - a.z),
      w: a.w + t * (bw - a.w),
    })
  }

  const theta0 = Math.acos(dot)
  const theta  = theta0 * t
  const sinT0  = Math.sin(theta0)
  const sinT   = Math.sin(theta)

  const s1 = sinT / sinT0
  const s0 = Math.cos(theta) - dot * s1

  return {
    x: s0 * a.x + s1 * bx,
    y: s0 * a.y + s1 * by,
    z: s0 * a.z + s1 * bz,
    w: s0 * a.w + s1 * bw,
  }
}

function normaliseQuat(q: { x: number; y: number; z: number; w: number }): typeof q {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w) || 1
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len }
}

