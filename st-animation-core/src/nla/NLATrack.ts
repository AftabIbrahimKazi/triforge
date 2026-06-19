import type { NLAStrip } from './NLAStrip.js'

/**
 * NLATrack — an ordered list of NLAStrips that don't overlap.
 * Blender: NLA Track.
 *
 * Evaluation: strips are evaluated left-to-right in time.
 * If a strip's time range contains the current time, it is evaluated.
 * Multiple tracks in the NLAEditor are blended in order (lower tracks first).
 */
export class NLATrack {
  name: string
  /** Whether this track contributes to the final output. */
  muted: boolean
  private _strips: NLAStrip[]

  constructor(name: string, strips: NLAStrip[] = []) {
    this.name    = name
    this.muted   = false
    this._strips = [...strips].sort((a, b) => a.start - b.start)
  }

  get strips(): readonly NLAStrip[] { return this._strips }

  addStrip(strip: NLAStrip): void {
    this._strips.push(strip)
    this._strips.sort((a, b) => a.start - b.start)
  }

  removeStrip(strip: NLAStrip): void {
    this._strips = this._strips.filter(s => s !== strip)
  }

  /**
   * Evaluate all strips active at global time `t`.
   * Returns the total influence contributed (0 if no strips active or muted).
   */
  evaluate(t: number): number {
    if (this.muted) return 0
    let totalInfluence = 0

    for (const strip of this._strips) {
      let localT: number | null = null

      if (t >= strip.start && t <= strip.end) {
        const duration = strip.end - strip.start
        const clipDur  = strip.clip.duration
        const raw      = ((t - strip.start) / duration) * clipDur

        localT = strip.repeat && clipDur > 0
          ? raw % clipDur
          : Math.min(raw, clipDur)
      } else if (strip.extrapolation === 'hold') {
        if (t < strip.start) localT = 0
        else localT = strip.clip.duration
      }

      if (localT !== null) {
        strip.clip.evaluate(localT)
        totalInfluence += strip.influence
      }
    }

    return totalInfluence
  }
}
