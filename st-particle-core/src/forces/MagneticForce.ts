import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/** Velocity-dependent lateral force (Blender: Force Field → Magnetic) */
export class MagneticForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space field origin for maxDistance range check. Not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    strength?: number; axisX?: number; axisY?: number; axisZ?: number
    maxDistance?: number
    px?: number; py?: number; pz?: number
  } = {}) {
    super()
    this.position = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.parameters = {
      strength:    opts.strength    ?? 1,
      axisX:       opts.axisX      ?? 0,
      axisY:       opts.axisY      ?? 1,
      axisZ:       opts.axisZ      ?? 0,
      maxDistance: opts.maxDistance ?? 0,
    }
  }

  apply(particle: Particle, dt: number): void {
    const p = this.parameters
    if (p.maxDistance > 0) {
      const dx = particle.position.x - this.position.x
      const dy = particle.position.y - this.position.y
      const dz = particle.position.z - this.position.z
      if (dx * dx + dy * dy + dz * dz > p.maxDistance * p.maxDistance) return
    }
    const field = new Vector3(p.axisX, p.axisY, p.axisZ).normalize()
    const force = new Vector3().crossVectors(particle.velocity, field)
    particle.velocity.addScaledVector(force, p.strength * dt)
  }
}
