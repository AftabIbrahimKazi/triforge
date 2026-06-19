import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/**
 * Lennard-Jones inter-particle force — attraction at long range, repulsion
 * at short range. Models molecular-like particle interaction.
 * (Blender: Force Field → Lennard-Jones)
 */
export class LennardJonesForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space field origin. Physics and range check both use this. Not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    strength?: number; equilibrium?: number; maxDistance?: number
    px?: number; py?: number; pz?: number
  } = {}) {
    super()
    this.position = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.parameters = {
      strength:    opts.strength    ?? 1,
      equilibrium: opts.equilibrium ?? 1,
      maxDistance: opts.maxDistance ?? 0,
    }
  }

  apply(particle: Particle, dt: number): void {
    const p  = this.parameters
    const dx = particle.position.x - this.position.x
    const dy = particle.position.y - this.position.y
    const dz = particle.position.z - this.position.z
    const r2 = dx * dx + dy * dy + dz * dz
    if (r2 < 1e-8) return
    if (p.maxDistance > 0 && r2 > p.maxDistance * p.maxDistance) return
    const r     = Math.sqrt(r2)
    const r0    = p.equilibrium
    const ratio = r0 / r
    // Simplified LJ: F = ε [ 2(r0/r)^7 - (r0/r)^13 ]
    const mag = p.strength * (2 * Math.pow(ratio, 7) - Math.pow(ratio, 13))
    particle.velocity.x -= (dx / r) * mag * dt
    particle.velocity.y -= (dy / r) * mag * dt
    particle.velocity.z -= (dz / r) * mag * dt
  }
}
