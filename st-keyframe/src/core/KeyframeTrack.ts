import type { Keyframe } from './Keyframe.js'
import { interpolateKeyframes } from './Keyframe.js'

/**
 * KeyframeTrack — drives a single numeric property on a target object.
 *
 * Mirrors Blender's F-Curve: one track per channel (one parameter, one property).
 * The target is any plain object with a writable numeric property — typically
 * a `parameters` object from any ecosystem class (modifier, shader node, etc.).
 *
 * Usage:
 *   const track = new KeyframeTrack(bloom.parameters, 'strength', [
 *     { time: 0, value: 0 },
 *     { time: 2, value: 1, easing: easeInOutSine },
 *   ])
 *   track.evaluate(1.0)  // sets bloom.parameters.strength = 0.5 (approx)
 */
export class KeyframeTrack {
  /** The object whose property this track drives. */
  readonly target: Record<string, number>
  /** The property name on the target object. */
  readonly property: string

  private _keyframes: Keyframe[]

  constructor(
    target: Record<string, number>,
    property: string,
    keyframes: Keyframe[] = [],
  ) {
    this.target   = target
    this.property = property
    this._keyframes = [...keyframes].sort((a, b) => a.time - b.time)
  }

  get keyframes(): readonly Keyframe[] { return this._keyframes }

  /** Add or replace a keyframe at the given time. Keeps list sorted. */
  addKeyframe(kf: Keyframe): void {
    const idx = this._keyframes.findIndex(k => k.time === kf.time)
    if (idx !== -1) {
      this._keyframes[idx] = kf
    } else {
      this._keyframes.push(kf)
      this._keyframes.sort((a, b) => a.time - b.time)
    }
  }

  removeKeyframe(time: number): void {
    this._keyframes = this._keyframes.filter(k => k.time !== time)
  }

  /** Duration of this track in seconds. */
  get duration(): number {
    if (this._keyframes.length === 0) return 0
    return this._keyframes[this._keyframes.length - 1].time
  }

  /**
   * Evaluate the track at time `t` and write the result to `target[property]`.
   * - Before first keyframe: clamps to first keyframe value.
   * - After last keyframe: clamps to last keyframe value.
   */
  evaluate(t: number): void {
    const kfs = this._keyframes
    if (kfs.length === 0) return
    if (kfs.length === 1 || t <= kfs[0].time) {
      this.target[this.property] = kfs[0].value
      return
    }
    if (t >= kfs[kfs.length - 1].time) {
      this.target[this.property] = kfs[kfs.length - 1].value
      return
    }

    // Binary search for the segment [kf0, kf1] that contains t
    let lo = 0, hi = kfs.length - 2
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (kfs[mid + 1].time <= t) lo = mid + 1
      else hi = mid
    }

    this.target[this.property] = interpolateKeyframes(kfs[lo], kfs[lo + 1], t)
  }

  /**
   * Evaluate and return the value WITHOUT writing to the target.
   * Useful for read-only sampling or blending.
   */
  sample(t: number): number {
    const prev = this.target[this.property]
    this.evaluate(t)
    const val = this.target[this.property]
    this.target[this.property] = prev
    return val
  }
}
