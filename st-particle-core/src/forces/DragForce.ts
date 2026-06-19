import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/** Velocity-proportional air resistance (Blender: Force Field → Drag) */
export class DragForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space field origin for maxDistance range check. Not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    linear?: number; quadratic?: number; maxDistance?: number
    px?: number; py?: number; pz?: number
  } = {}) {
    super()
    this.position = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.parameters = {
      linear:      opts.linear      ?? 1,
      quadratic:   opts.quadratic   ?? 0,
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
    const speed = particle.velocity.length()
    if (speed < 0.0001) return
    const drag   = p.linear + p.quadratic * speed
    const factor = Math.max(0, 1 - drag * dt)
    particle.velocity.multiplyScalar(factor)
  }
}
