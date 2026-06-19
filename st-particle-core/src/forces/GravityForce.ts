import { BaseForce } from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/** Directional gravity force (Blender: Force Field → Gravity) */
export class GravityForce extends BaseForce {
  parameters: Record<string, number>

  constructor(strength = 9.81) {
    super()
    this.parameters = { strength }
  }

  apply(particle: Particle, dt: number): void {
    particle.velocity.y -= this.parameters.strength * dt
  }
}
