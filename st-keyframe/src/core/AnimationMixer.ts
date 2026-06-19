import type { AnimationClip } from './AnimationClip.js'

export type WrapMode = 'once' | 'loop' | 'pingpong'

/**
 * AnimationAction — controls playback of one AnimationClip.
 * Mirrors Blender's NLA strip / action slot.
 */
export interface AnimationAction {
  clip: AnimationClip
  /** Playback speed multiplier. Default 1. Negative plays in reverse. */
  timeScale: number
  /** Loop behaviour: 'once' stops at end, 'loop' restarts, 'pingpong' reverses. */
  wrapMode: WrapMode
  /** How many loops have completed (read-only, managed by mixer). */
  loopCount: number
  /** Whether this action is currently playing. */
  playing: boolean
  /** Current local time in seconds. */
  time: number
}

/**
 * AnimationMixer — drives AnimationClips forward in time.
 *
 * Call `mixer.update(delta)` every frame (delta = seconds since last frame).
 * All active clips advance and their tracks write to their target parameters.
 *
 * Mirrors Blender's NLA Editor top-level playback.
 *
 * Usage:
 *   const mixer = new AnimationMixer()
 *   const action = mixer.play(clip)
 *   // in render loop:
 *   mixer.update(clock.getDelta())
 */
export class AnimationMixer {
  private _actions: AnimationAction[] = []

  /** Play a clip. Returns the AnimationAction for fine-grained control. */
  play(clip: AnimationClip, options: Partial<Omit<AnimationAction, 'clip' | 'loopCount'>> = {}): AnimationAction {
    const action: AnimationAction = {
      clip,
      timeScale: options.timeScale ?? 1,
      wrapMode:  options.wrapMode  ?? 'once',
      playing:   options.playing   ?? true,
      time:      options.time      ?? 0,
      loopCount: 0,
    }
    this._actions.push(action)
    return action
  }

  /** Stop and remove a specific action. */
  stop(action: AnimationAction): void {
    this._actions = this._actions.filter(a => a !== action)
  }

  /** Stop all actions. */
  stopAll(): void {
    this._actions = []
  }

  get actions(): readonly AnimationAction[] { return this._actions }

  /**
   * Advance all active actions by `delta` seconds and evaluate their clips.
   * @param delta Time since last frame in seconds.
   */
  update(delta: number): void {
    for (const action of this._actions) {
      if (!action.playing) continue

      action.time += delta * action.timeScale
      const duration = action.clip.duration
      if (duration <= 0) { action.clip.evaluate(0); continue }

      let t = action.time

      if (action.wrapMode === 'once') {
        if (t >= duration) { t = duration; action.playing = false }
        else if (t < 0)    { t = 0;        action.playing = false }
      } else if (action.wrapMode === 'loop') {
        if (t >= duration) {
          action.loopCount++
          action.time = t = t % duration
        } else if (t < 0) {
          action.loopCount++
          action.time = t = duration + (t % duration)
        }
      } else {
        // pingpong
        if (t >= duration) {
          action.loopCount++
          action.timeScale = -Math.abs(action.timeScale)
          action.time = t = duration
        } else if (t <= 0) {
          action.loopCount++
          action.timeScale = Math.abs(action.timeScale)
          action.time = t = 0
        }
      }

      action.clip.evaluate(t)
    }
  }
}
