/**
 * NLAStrip — a time-positioned, scaled, and weighted animation clip on a track.
 * Blender: NLA Strip.
 *
 * `start` and `end` are in global time (seconds).
 * The clip is stretched/squeezed to fill [start, end].
 * `influence` blends this strip's output with what's already been evaluated.
 */
export interface NLAStrip {
  /** Display name. */
  name: string
  /** The AnimationClip (from st-keyframe) to play. */
  clip: { duration: number; evaluate(t: number): void }
  /** Global start time in seconds. */
  start: number
  /** Global end time in seconds. */
  end: number
  /**
   * Blend weight [0, 1]. Blender: Influence.
   * 1 = fully replace, 0 = no contribution.
   */
  influence: number
  /** Whether to loop the clip within [start, end]. Blender: Repeat. Default false. */
  repeat: boolean
  /** Extrapolation before/after strip. 'hold' keeps the clip's endpoint values. Blender: Extrapolation. */
  extrapolation: 'nothing' | 'hold'
}
