import type { EasingFn } from '../easing/easings.js'
import { linear } from '../easing/easings.js'

/**
 * A single keyframe: time + value + easing to the *next* keyframe.
 * Mirrors Blender's F-Curve keyframe point.
 */
export interface Keyframe {
  /** Time in seconds. */
  time: number
  /** Value at this keyframe. */
  value: number
  /**
   * Easing function applied from this keyframe to the next.
   * Default: linear. Corresponds to Blender's F-Curve interpolation mode.
   */
  easing?: EasingFn
}

/**
 * Evaluate the interpolated value between two keyframes at time t.
 * `t` must be in [kf0.time, kf1.time].
 */
export function interpolateKeyframes(kf0: Keyframe, kf1: Keyframe, t: number): number {
  if (kf1.time === kf0.time) return kf0.value
  const alpha  = (t - kf0.time) / (kf1.time - kf0.time)
  const easing = kf0.easing ?? linear
  return kf0.value + (kf1.value - kf0.value) * easing(alpha)
}
