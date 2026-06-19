import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/**
 * Radial attract / repel force — positive strength attracts, negative repels.
 * (Blender: Force Field → Charge / Force)
 */
export class ChargeForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space charge origin. Physics and range check both use this. Not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    strength?: number; falloff?: number; maxDistance?: number
    px?: number; py?: number; pz?: number
  } = {}) {
    super()
    this.position = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.parameters = {
      strength:    opts.strength    ?? 1,
      falloff:     opts.falloff     ?? 2,
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
    const r   = Math.sqrt(r2)
    const mag = p.strength / Math.pow(r, p.falloff)
    // toward origin = negative direction from particle
    particle.velocity.x -= (dx / r) * mag * dt
    particle.velocity.y -= (dy / r) * mag * dt
    particle.velocity.z -= (dz / r) * mag * dt
  }
}
