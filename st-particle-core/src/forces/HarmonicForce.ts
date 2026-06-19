import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/** Spring attraction toward a point (Blender: Force Field → Harmonic) */
export class HarmonicForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space field origin for maxDistance range check. Not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    strength?: number; damping?: number; x?: number; y?: number; z?: number
    maxDistance?: number
    px?: number; py?: number; pz?: number
  } = {}) {
    super()
    this.position = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.parameters = {
      strength:    opts.strength    ?? 1,
      damping:     opts.damping     ?? 0.5,
      x:           opts.x          ?? 0,
      y:           opts.y          ?? 0,
      z:           opts.z          ?? 0,
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
    const toTarget = new Vector3(p.x - particle.position.x, p.y - particle.position.y, p.z - particle.position.z)
    particle.velocity.addScaledVector(toTarget, p.strength * dt)
    particle.velocity.multiplyScalar(1 - Math.min(p.damping * dt, 1))
  }
}
