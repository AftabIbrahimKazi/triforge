import type { Particle } from './Particle.js'

/**
 * Abstract base for all force field effectors.
 * Each force receives a particle and a dt, and mutates particle.velocity.
 *
 * Concrete subclasses: GravityForce, WindForce, VortexForce, DragForce,
 * TurbulenceForce, MagneticForce, HarmonicForce, ChargeForce,
 * LennardJonesForce, TextureForce, DragFieldForce.
 */
export abstract class BaseForce {
  /** Whether this force is currently active */
  enabled = true

  /** Blender-matched public parameters — GSAP / keyframe compatible */
  abstract parameters: Record<string, number>

  /**
   * Optional once-per-frame hook, called before the owning system's per-particle
   * apply() loop. Forces that need frame-level bookkeeping (e.g. rebuilding a
   * spatial-partition structure from an external source) override this; the
   * default is a no-op so existing forces are unaffected.
   */
  beginFrame?(): void

  /**
   * Apply force to a single particle for one timestep.
   * Mutates particle.velocity only — never position.
   */
  abstract apply(particle: Particle, dt: number): void
}
