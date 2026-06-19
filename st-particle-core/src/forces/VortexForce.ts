import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/** Spiral force around an axis (Blender: Force Field → Vortex) */
export class VortexForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space axis origin — axis passes through this point. Not GSAP-animatable. */
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
    const p  = this.parameters
    const dx = particle.position.x - this.position.x
    const dy = particle.position.y - this.position.y
    const dz = particle.position.z - this.position.z
    if (p.maxDistance > 0 && dx * dx + dy * dy + dz * dz > p.maxDistance * p.maxDistance) return
    const axis = new Vector3(p.axisX, p.axisY, p.axisZ).normalize()
    const rel  = new Vector3(dx, dy, dz)
    const tangential = new Vector3().crossVectors(axis, rel).normalize()
    particle.velocity.addScaledVector(tangential, p.strength * dt)
  }
}
