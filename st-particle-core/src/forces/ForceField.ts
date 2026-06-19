import { Vector3 }        from 'three'
import { BaseForce }      from '../core/BaseForce.js'
import type { Particle }  from '../core/Particle.js'

/**
 * Radial push/pull force field — a point in world space that repels or
 * attracts particles.  Positive strength = repel, negative = attract.
 *
 * Force magnitude = strength / (distance ^ falloff), clamped to maxDistance.
 *
 * Blender parallel: Force Fields → Force (Type: Force).
 */
export class ForceField extends BaseForce {
  parameters: Record<string, number>

  /** World-space origin of the field.  Not in parameters — not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    strength?:    number
    falloff?:     number
    maxDistance?: number
    x?:           number
    y?:           number
    z?:           number
  } = {}) {
    super()
    this.position = new Vector3(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0)
    this.parameters = {
      strength:    opts.strength    ?? 1.0,
      falloff:     opts.falloff     ?? 1.0,
      maxDistance: opts.maxDistance ?? 10.0,
    }
  }

  apply(particle: Particle, dt: number): void {
    if (!particle.alive) return

    const { strength, falloff, maxDistance } = this.parameters

    const dx = particle.position.x - this.position.x
    const dy = particle.position.y - this.position.y
    const dz = particle.position.z - this.position.z
    const dist2 = dx * dx + dy * dy + dz * dz

    if (dist2 < 1e-10 || dist2 > maxDistance * maxDistance) return

    const dist = Math.sqrt(dist2)
    // Clamp falloff exponent to avoid unbounded forces at zero distance
    const safeExp = Math.max(0, falloff)
    const magnitude = strength / Math.pow(Math.max(dist, 0.01), safeExp)

    const inv = magnitude / dist
    particle.velocity.x += dx * inv * dt
    particle.velocity.y += dy * inv * dt
    particle.velocity.z += dz * inv * dt
  }
}
