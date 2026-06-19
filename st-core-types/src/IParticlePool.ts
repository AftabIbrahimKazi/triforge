import type { Vector3, Quaternion } from 'three'

/**
 * IParticleLike — the minimal shape of a particle in the pool.
 * Used by forces, renderers, and anything that reads the live particle state
 * without importing the concrete Particle class from st-particle-core.
 */
export interface IParticleLike {
  alive:      boolean
  position:   Vector3
  velocity:   Vector3
  size:       number
  /** Normalised lifetime progress: 0 at birth → 1 at death. */
  normalised: number
  /** Age in seconds since birth. */
  age:        number
  rotation:   Quaternion
  angularVel: Vector3
}

/**
 * IParticlePool — the live particle array exposed by ParticleSystem.
 * BoidField, FlowFieldForce and other cross-system forces accept this
 * instead of a concrete ParticleSystem to avoid coupling.
 *
 * @example
 * // Wire two particle systems together via pool reference:
 * const field = new BoidField(predatorSystem.pool as IParticlePool)
 * preySystem.addForce(field)
 */
export type IParticlePool = IParticleLike[]
