import type { Particle }       from '../core/Particle.js'
import type { ParticleSystem } from '../core/ParticleSystem.js'

/**
 * KeyedPhysics — Blender: Keyed physics type.
 *
 * Blends particle positions (and velocities) between a list of target
 * particle systems. `parameters.blend` drives the blend index:
 *   0   → particles match target[0] exactly
 *   0.5 → halfway between target[0] and target[1]
 *   1   → particles match target[1] exactly
 *   N   → particles match target[N] exactly
 *
 * The blend value can be driven by GSAP or st-keyframe AnimationMixer
 * via the `parameters` object — no cross-package imports needed.
 *
 * @example
 * const sys   = new ParticleSystem({ count: 500 })
 * const key   = new KeyedPhysics([targetA, targetB])
 * sys.addPhysics(key)
 *
 * // Drive blend from outside:
 * gsap.to(key.parameters, { blend: 1.0, duration: 2 })
 */
export class KeyedPhysics {
  /** All public scalar inputs — GSAP / st-keyframe compatible. */
  parameters: Record<string, number>

  /**
   * How strongly position is pulled toward the target [0–1].
   * 1 = snap to target each frame (Blender default).
   * Lower values give spring-like interpolation.
   */
  stiffness: number

  private readonly _targets: ParticleSystem[]

  constructor(targets: ParticleSystem[], stiffness = 1.0) {
    this._targets = targets
    this.stiffness = stiffness
    this.parameters = {
      blend: 0,   // 0 = target[0], 1 = target[1], etc.
    }
  }

  /** Number of registered target systems. */
  get targetCount(): number { return this._targets.length }

  /**
   * Apply keyed blending to the live pool.
   * Called by ParticleSystem.step() each tick.
   */
  apply(pool: Particle[], _dt: number): void {
    if (this._targets.length === 0) return

    const blend = Math.max(0, this.parameters.blend)
    const loIdx = Math.min(Math.floor(blend), this._targets.length - 1)
    const hiIdx = Math.min(loIdx + 1, this._targets.length - 1)
    const t     = blend - loIdx  // fractional part [0, 1]

    const loPool = this._targets[loIdx].pool
    const hiPool = hiIdx !== loIdx ? this._targets[hiIdx].pool : null

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]
      if (!p.alive) continue

      const loP = loPool[i % loPool.length]
      if (!loP) continue

      if (hiPool && t > 0) {
        const hiP = hiPool[i % hiPool.length]
        if (hiP) {
          p.position.lerpVectors(loP.position, hiP.position, t)
          p.velocity.lerpVectors(loP.velocity, hiP.velocity, t)
        } else {
          p.position.copy(loP.position)
          p.velocity.copy(loP.velocity)
        }
      } else {
        p.position.copy(loP.position)
        p.velocity.copy(loP.velocity)
      }

      // Optionally copy size / normalised for visual variation
      p.size       = loP ? loP.size * (1 - t) + (hiPool ? (hiPool[i % hiPool.length]?.size ?? loP.size) : loP.size) * t : p.size
      p.normalised = loP.normalised
    }
  }
}
