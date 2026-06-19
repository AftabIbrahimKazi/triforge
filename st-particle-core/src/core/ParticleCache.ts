import type { Particle }       from './Particle.js'
import type { ParticleSystem } from './ParticleSystem.js'

/**
 * Bake / cache system for ParticleSystem — records a range of the simulation
 * to a frame-indexed snapshot array and replays it deterministically.
 *
 * Blender parallel: the Cache panel on a particle system.
 *
 * Layout per particle per frame (12 floats):
 *   [0..2]  position xyz
 *   [3..5]  velocity xyz
 *   [6..8]  rotation xyz
 *   [9]     size
 *   [10]    normalised (0–1)
 *   [11]    alive flag  (1 = alive, 0 = dead)
 */
export class ParticleCache {
  /** All public scalar inputs — GSAP / keyframe compatible */
  parameters: Record<string, number>

  private _frames: number[][] = []
  private static readonly _FPP = 12   // floats per particle

  get isBaked():    boolean { return this._frames.length > 0 }
  get frameCount(): number  { return this._frames.length }

  constructor() {
    this.parameters = { startSec: 0, endSec: 5, fps: 30, step: 0 }
  }

  /**
   * Run the simulation from startSec to endSec at fps steps/sec and record
   * each frame as a flat number[] snapshot.  The system is reset and warmed
   * up to startSec before recording begins, so the result is fully
   * deterministic for any given seed.
   *
   * Stored parameters are updated but the caller's parameters object is never
   * touched — baking is non-destructive toward external state.
   */
  bake(sys: ParticleSystem, startSec: number, endSec: number, fps: number): void {
    this._frames = []
    this.parameters.startSec = startSec
    this.parameters.endSec   = endSec
    this.parameters.fps      = fps
    this.parameters.step     = 0

    const dt          = 1 / fps
    const totalFrames = Math.ceil((endSec - startSec) * fps) + 1

    // Reset and warm up to startSec
    sys.reset()
    const warmupSteps = Math.round(startSec * fps)
    for (let i = 0; i < warmupSteps; i++) sys.update(dt)

    // Record frames — snapshot before stepping so frame[0] = t=startSec
    for (let f = 0; f < totalFrames; f++) {
      this._frames.push(this._snapshot(sys.pool))
      if (f < totalFrames - 1) sys.update(dt)
    }
  }

  /**
   * Restore the particle pool to the interpolated state at timeSec.
   * Clamps to first / last frame if timeSec is outside the baked range.
   *
   * Zero allocations — writes directly into existing Particle instances.
   */
  seek(sys: ParticleSystem, timeSec: number): void {
    if (this._frames.length === 0) return

    const { startSec, fps } = this.parameters
    const relTime  = timeSec - startSec
    // Clamp the fractional frame position before splitting into f0/t
    const clampedF = Math.max(0, Math.min(this._frames.length - 1, relTime * fps))
    const f0       = Math.floor(clampedF)
    const f1       = Math.min(this._frames.length - 1, f0 + 1)
    const t        = (f0 === f1) ? 0 : (clampedF - f0)

    const pool = sys.pool
    const fpp  = ParticleCache._FPP

    if (t === 0) {
      // Exact frame — direct copy, no interpolation
      const frame = this._frames[f0]
      for (let i = 0; i < pool.length; i++) {
        this._restoreParticle(pool[i], frame, i * fpp)
      }
    } else {
      // Sub-frame — linear interpolate between f0 and f1
      const fr0 = this._frames[f0]
      const fr1 = this._frames[f1]
      const t1  = 1 - t
      for (let i = 0; i < pool.length; i++) {
        const base = i * fpp
        const p    = pool[i]
        p.position.x  = fr0[base]     * t1 + fr1[base]     * t
        p.position.y  = fr0[base + 1] * t1 + fr1[base + 1] * t
        p.position.z  = fr0[base + 2] * t1 + fr1[base + 2] * t
        p.velocity.x  = fr0[base + 3] * t1 + fr1[base + 3] * t
        p.velocity.y  = fr0[base + 4] * t1 + fr1[base + 4] * t
        p.velocity.z  = fr0[base + 5] * t1 + fr1[base + 5] * t
        p.rotation.x  = fr0[base + 6] * t1 + fr1[base + 6] * t
        p.rotation.y  = fr0[base + 7] * t1 + fr1[base + 7] * t
        p.rotation.z  = fr0[base + 8] * t1 + fr1[base + 8] * t
        p.size        = fr0[base + 9]  * t1 + fr1[base + 9]  * t
        p.normalised  = fr0[base + 10] * t1 + fr1[base + 10] * t
        p.alive       = fr0[base + 11] > 0.5  // alive = alive in the source frame
      }
    }
  }

  /** Drop all baked frames. */
  clear(): void {
    this._frames = []
  }

  /**
   * Bake all systems over the same time range in a single shared simulation
   * loop — one pass rather than N independent passes.
   *
   * Blender parallel: Cache → Bake All Dynamics.
   *
   * Each system's built-in `.cache` is populated.  Systems are reset, warmed
   * up, and recorded in lock-step so the total cost is one shared loop rather
   * than N independent loops.
   */
  static bakeAll(
    systems:  ParticleSystem[],
    startSec: number,
    endSec:   number,
    fps:      number,
  ): void {
    if (systems.length === 0) return

    const dt          = 1 / fps
    const totalFrames = Math.ceil((endSec - startSec) * fps) + 1
    const warmupSteps = Math.round(startSec * fps)

    // Initialise each system's cache and reset simulation state
    const pairs: Array<{ cache: ParticleCache; sys: ParticleSystem }> = []
    for (const sys of systems) {
      const cache = sys.cache
      cache['_frames'] = []
      cache.parameters.startSec = startSec
      cache.parameters.endSec   = endSec
      cache.parameters.fps      = fps
      cache.parameters.step     = 0
      sys.reset()
      pairs.push({ cache, sys })
    }

    // Shared warm-up
    for (let i = 0; i < warmupSteps; i++) {
      for (const { sys } of pairs) sys.update(dt)
    }

    // Shared recording loop
    for (let f = 0; f < totalFrames; f++) {
      for (const { cache, sys } of pairs) {
        cache['_frames'].push(cache['_snapshot'](sys.pool))
      }
      if (f < totalFrames - 1) {
        for (const { sys } of pairs) sys.update(dt)
      }
    }
  }

  /**
   * Serialise to a plain JSON-compatible object.
   * frames are stored as Array<number> so JSON.stringify / JSON.parse
   * round-trips without loss.
   */
  toJSON(): { parameters: Record<string, number>; frames: number[][] } {
    return {
      parameters: { ...this.parameters },
      frames:     this._frames.map(f => Array.from(f)),
    }
  }

  /**
   * Restore from a value previously returned by toJSON().
   */
  fromJSON(data: { parameters: Record<string, number>; frames: number[][] }): void {
    this.parameters.startSec = data.parameters.startSec ?? 0
    this.parameters.endSec   = data.parameters.endSec   ?? 5
    this.parameters.fps      = data.parameters.fps      ?? 30
    this.parameters.step     = data.parameters.step     ?? 0
    this._frames = data.frames.map(f => Array.from(f))
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _snapshot(pool: Particle[]): number[] {
    const fpp  = ParticleCache._FPP
    const data = new Array<number>(pool.length * fpp)
    for (let i = 0; i < pool.length; i++) {
      const p    = pool[i]
      const base = i * fpp
      data[base]      = p.position.x
      data[base + 1]  = p.position.y
      data[base + 2]  = p.position.z
      data[base + 3]  = p.velocity.x
      data[base + 4]  = p.velocity.y
      data[base + 5]  = p.velocity.z
      data[base + 6]  = p.rotation.x
      data[base + 7]  = p.rotation.y
      data[base + 8]  = p.rotation.z
      data[base + 9]  = p.size
      data[base + 10] = p.normalised
      data[base + 11] = p.alive ? 1 : 0
    }
    return data
  }

  private _restoreParticle(p: Particle, frame: number[], base: number): void {
    p.position.x = frame[base]
    p.position.y = frame[base + 1]
    p.position.z = frame[base + 2]
    p.velocity.x = frame[base + 3]
    p.velocity.y = frame[base + 4]
    p.velocity.z = frame[base + 5]
    p.rotation.x = frame[base + 6]
    p.rotation.y = frame[base + 7]
    p.rotation.z = frame[base + 8]
    p.size        = frame[base + 9]
    p.normalised  = frame[base + 10]
    p.alive       = frame[base + 11] > 0.5
  }
}
