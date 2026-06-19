import { Vector3, BufferGeometry } from 'three'
import type { Particle } from './Particle.js'
import type { SeededRandom } from './SeededRandom.js'


export type EmitFrom = 'verts' | 'faces' | 'volume'

export interface BaseEmitterOptions {
  /** Velocity along face/vertex normal (Blender: Normal) */
  normalVelocity?:   number
  /** Velocity along surface tangent (Blender: Tangent) */
  tangentVelocity?:  number
  /** Tangent rotation offset in radians (Blender: Tangent Phase) */
  tangentPhase?:     number
  /** Velocity along emitter object X axis (Blender: Object Align X) */
  objectVelocityX?:  number
  /** Velocity along emitter object Y axis (Blender: Object Align Y) */
  objectVelocityY?:  number
  /** Velocity along emitter object Z axis (Blender: Object Align Z) */
  objectVelocityZ?:  number
  /** Fraction of emitter object velocity inherited (Blender: Object Velocity) */
  objectInherit?:    number
  /** Random velocity magnitude (Blender: Randomise) */
  randomVelocity?:   number
  /** Where on the mesh to emit from (Blender: Emit From) */
  emitFrom?:         EmitFrom
  /** Distribute evenly across surface area (Blender: Even Distribution) */
  evenDistribution?: boolean
}

/**
 * Abstract base — knows how to sample a spawn point from a geometry
 * and write initial position/velocity onto a Particle.
 *
 * Concrete subclasses: PointEmitter, MeshEmitter, EdgeEmitter.
 */
export abstract class BaseEmitter {
  /** Blender-matched public parameters — GSAP / keyframe compatible */
  parameters: Record<string, number>

  /**
   * World-space velocity of the emitter object (set externally each frame).
   * Blender: Velocity → Object Velocity — particles inherit this × objectInherit.
   */
  worldVelocity: Vector3 = new Vector3()

  constructor(opts: BaseEmitterOptions = {}) {
    this.parameters = {
      normalVelocity:   opts.normalVelocity  ?? 0,
      tangentVelocity:  opts.tangentVelocity ?? 0,
      tangentPhase:     opts.tangentPhase    ?? 0,
      objectVelocityX:  opts.objectVelocityX ?? 0,
      objectVelocityY:  opts.objectVelocityY ?? 0,
      objectVelocityZ:  opts.objectVelocityZ ?? 0,
      objectInherit:    opts.objectInherit   ?? 0,
      randomVelocity:   opts.randomVelocity  ?? 0,
      // emitFrom stored as 0=verts, 1=faces, 2=volume
      emitFrom:         opts.emitFrom === 'faces' ? 1 : opts.emitFrom === 'volume' ? 2 : 0,
      evenDistribution: opts.evenDistribution ? 1 : 0,
    }
  }

  /**
   * Write spawn position and initial velocity onto the particle.
   * Called by ParticleSystem each time a particle is born.
   */
  abstract spawn(
    particle: Particle,
    geometry: BufferGeometry | null,
    rng: SeededRandom,
  ): void

  /** Apply velocity parameters after spawn point is set */
  protected applyVelocity(
    particle: Particle,
    normal: Vector3,
    tangent: Vector3,
    rng: SeededRandom,
  ): void {
    const p = this.parameters

    // Normal component
    particle.velocity.addScaledVector(normal, p.normalVelocity)

    // Tangent component (rotated by tangentPhase)
    const t = tangent.clone().applyAxisAngle(normal, p.tangentPhase)
    particle.velocity.addScaledVector(t, p.tangentVelocity)

    // Object-axis components
    particle.velocity.x += p.objectVelocityX
    particle.velocity.y += p.objectVelocityY
    particle.velocity.z += p.objectVelocityZ

    // Random component
    if (p.randomVelocity > 0) {
      particle.velocity.x += rng.signed() * p.randomVelocity
      particle.velocity.y += rng.signed() * p.randomVelocity
      particle.velocity.z += rng.signed() * p.randomVelocity
    }

    // Emitter object velocity inheritance (Blender: Object Velocity)
    if (p.objectInherit !== 0) {
      particle.velocity.addScaledVector(this.worldVelocity, p.objectInherit)
    }
  }
}
