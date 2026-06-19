import type { BufferGeometry } from 'three'
import type { Vector3 } from 'three'

/**
 * IEmitter — the contract every st-particle-core emitter fulfils.
 *
 * Emitters write spawn position and initial velocity onto a particle-like
 * object. The geometry argument is the source surface for mesh emitters;
 * point emitters ignore it.
 */
export interface IEmitter {
  parameters: Record<string, number>
  /** World-space velocity of the emitter object (set externally each frame). */
  worldVelocity: Vector3
  /**
   * Write spawn position and initial velocity onto the particle.
   * Called by ParticleSystem each time a particle is born.
   */
  spawn(particle: { position: Vector3; velocity: Vector3; size: number }, geometry: BufferGeometry | null, rng: { next(): number; signed(): number }): void
}
