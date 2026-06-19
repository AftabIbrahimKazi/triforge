import { BaseForce } from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/**
 * A minimal interface for any particle pool that BoidField can read positions from.
 * Pass `otherSystem.pool` or any array of objects with a `position` and `alive` flag.
 */
export interface BoidFieldSource {
  readonly position: { x: number; y: number; z: number }
  readonly alive:    boolean
}

export interface BoidFieldOptions {
  /** Radius within which agents are repelled away from source particles. Default 1. */
  repelRadius?:   number
  /** Radius within which agents are attracted toward source particles. Default 0 (disabled). */
  attractRadius?: number
  /** Strength of the repulsion force. Default 3. */
  repelStrength?: number
  /** Strength of the attraction force. Default 1. */
  attractStrength?: number
  /** Maximum velocity magnitude a particle may reach. Default 8. */
  maxSpeed?: number
}

/**
 * BoidField — a scene-level force that steers one particle system
 * based on the positions of another (or an arbitrary point cloud).
 *
 * Blender equivalent: a Boid rules effector applied at scene level,
 * letting different systems interact (predator/prey, crowd avoidance,
 * swarming around attractors).
 *
 * @example
 * // System B avoids system A's particles
 * const field = new BoidField(systemA.pool, { repelRadius: 1.5, repelStrength: 5 })
 * systemB.addForce(field)
 *
 * // System B swarms toward system A
 * const field = new BoidField(systemA.pool, { attractRadius: 3, attractStrength: 2 })
 * systemB.addForce(field)
 */
export class BoidField extends BaseForce {
  parameters: {
    repelRadius:    number
    attractRadius:  number
    repelStrength:  number
    attractStrength: number
    maxSpeed:       number
  }

  private _source: BoidFieldSource[]

  constructor(source: BoidFieldSource[], opts: BoidFieldOptions = {}) {
    super()
    this._source = source
    this.parameters = {
      repelRadius:    opts.repelRadius     ?? 1.0,
      attractRadius:  opts.attractRadius   ?? 0.0,
      repelStrength:  opts.repelStrength   ?? 3.0,
      attractStrength: opts.attractStrength ?? 1.0,
      maxSpeed:       opts.maxSpeed        ?? 8.0,
    }
  }

  /** Swap the source pool at runtime — e.g. switch which system acts as the attractor. */
  setSource(source: BoidFieldSource[]): void {
    this._source = source
  }

  apply(particle: Particle, dt: number): void {
    const { repelRadius, attractRadius, repelStrength, attractStrength, maxSpeed } = this.parameters
    const repR2  = repelRadius   * repelRadius
    const attR2  = attractRadius * attractRadius
    // Minimum distance to prevent force explosion at near-zero separation
    const minD   = 0.05

    let fx = 0, fy = 0, fz = 0

    for (const agent of this._source) {
      if (!agent.alive) continue
      const dx = particle.position.x - agent.position.x
      const dy = particle.position.y - agent.position.y
      const dz = particle.position.z - agent.position.z
      const d2 = dx*dx + dy*dy + dz*dz
      if (d2 < 1e-8) continue
      const d = Math.max(Math.sqrt(d2), minD)

      // Repulsion — push away
      if (repR2 > 0 && d2 < repR2) {
        const fade = 1 - d / repelRadius
        const mag  = repelStrength * fade / d
        fx += dx * mag
        fy += dy * mag
        fz += dz * mag
      }

      // Attraction — pull toward
      if (attR2 > 0 && d2 < attR2) {
        const fade = 1 - d / attractRadius
        const mag  = -attractStrength * fade / d
        fx += dx * mag
        fy += dy * mag
        fz += dz * mag
      }
    }

    particle.velocity.x += fx * dt
    particle.velocity.y += fy * dt
    particle.velocity.z += fz * dt

    // Clamp speed to prevent runaway / NaN
    const spd2 = particle.velocity.x**2 + particle.velocity.y**2 + particle.velocity.z**2
    if (spd2 > maxSpeed * maxSpeed) {
      const inv = maxSpeed / Math.sqrt(spd2)
      particle.velocity.x *= inv
      particle.velocity.y *= inv
      particle.velocity.z *= inv
    }
  }
}
