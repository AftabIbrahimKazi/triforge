import type { KeyframeTrack } from './KeyframeTrack.js'

/**
 * AnimationClip — a named collection of KeyframeTracks.
 * Mirrors Blender's Action: one clip groups all tracks for a related animation.
 *
 * Usage:
 *   const clip = new AnimationClip('dissolve', [trackA, trackB])
 *   clip.evaluate(0.5)  // evaluates all tracks at t=0.5
 */
export class AnimationClip {
  name: string
  private _tracks: KeyframeTrack[]

  constructor(name: string, tracks: KeyframeTrack[] = []) {
    this.name    = name
    this._tracks = [...tracks]
  }

  get tracks(): readonly KeyframeTrack[] { return this._tracks }

  addTrack(track: KeyframeTrack): void {
    this._tracks.push(track)
  }

  removeTrack(track: KeyframeTrack): void {
    this._tracks = this._tracks.filter(t => t !== track)
  }

  /** Duration = longest track duration. */
  get duration(): number {
    return this._tracks.reduce((max, t) => Math.max(max, t.duration), 0)
  }

  /** Evaluate every track at time `t`. */
  evaluate(t: number): void {
    for (const track of this._tracks) track.evaluate(t)
  }
}
