import type { NLATrack } from './NLATrack.js'

/**
 * NLAEditor — drives multiple NLATracks and advances global time.
 * Blender: NLA Editor playback engine.
 *
 * Evaluation order: tracks are evaluated bottom-to-top (index 0 = base layer).
 * Each track's strips write to their target `parameters` objects.
 * When multiple strips write the same property, the last write wins.
 * For proper additive blending, use separate target objects per track.
 *
 * Usage:
 *   const nla = new NLAEditor()
 *   nla.addTrack(walkTrack)
 *   nla.addTrack(waveTrack)  // evaluated on top
 *   // In render loop:
 *   nla.update(clock.getDelta())
 */
export class NLAEditor {
  private _tracks: NLATrack[] = []
  /** Current global playback time in seconds. */
  time: number = 0
  /** Playback speed multiplier. */
  timeScale: number = 1
  /** Whether playback is advancing. */
  playing: boolean = true

  get tracks(): readonly NLATrack[] { return this._tracks }

  addTrack(track: NLATrack): void {
    this._tracks.push(track)
  }

  removeTrack(track: NLATrack): void {
    this._tracks = this._tracks.filter(t => t !== track)
  }

  /**
   * Advance time by `delta` seconds and evaluate all tracks.
   */
  update(delta: number): void {
    if (this.playing) this.time += delta * this.timeScale
    this.evaluate(this.time)
  }

  /**
   * Evaluate all tracks at an explicit global time without advancing.
   */
  evaluate(t: number): void {
    for (const track of this._tracks) {
      track.evaluate(t)
    }
  }

  /** Duration = end of the last strip across all tracks. */
  get duration(): number {
    let max = 0
    for (const track of this._tracks) {
      for (const strip of track.strips) {
        if (strip.end > max) max = strip.end
      }
    }
    return max
  }
}
