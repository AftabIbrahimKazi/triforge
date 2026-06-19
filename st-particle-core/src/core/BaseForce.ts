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
   * Apply force to a single particle for one timestep.
   * Mutates particle.velocity only — never position.
   */
  abstract apply(particle: Particle, dt: number): void
}
