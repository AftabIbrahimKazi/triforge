import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/** Constant directional wind (Blender: Force Field → Wind) */
export class WindForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space field origin used for maxDistance range check. Not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    x?: number; y?: number; z?: number; strength?: number
    maxDistance?: number
    px?: number; py?: number; pz?: number
  } = {}) {
    super()
    this.position = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.parameters = {
      x:           opts.x           ?? 0,
      y:           opts.y           ?? 0,
      z:           opts.z           ?? 1,
      strength:    opts.strength    ?? 1,
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
    const dir = new Vector3(p.x, p.y, p.z).normalize()
    particle.velocity.addScaledVector(dir, p.strength * dt)
  }
}
