import type { Vector3 } from 'three'

/**
 * IForce — the contract every st-particle-core force field fulfils.
 *
 * Forces accumulate acceleration onto each alive particle each step.
 * They receive the particle's current state and the timestep.
 *
 * @example
 * // A custom upward wind force compatible with ParticleSystem:
 * const wind: IForce = {
 *   parameters: { strength: 2.0 },
 *   enabled: true,
 *   apply: (pos, vel, acc, dt) => { acc.y += 2.0 },
 * }
 */
export interface IForce {
  parameters: Record<string, number>
  enabled: boolean
  /**
   * Accumulate acceleration for one particle.
   * @param position  Current world-space position (read-only)
   * @param velocity  Current velocity (read-only)
   * @param acc       Accumulator — ADD to this, never set it directly
   * @param dt        Timestep in seconds
   */
  apply(position: Vector3, velocity: Vector3, acc: Vector3, dt: number): void
}
