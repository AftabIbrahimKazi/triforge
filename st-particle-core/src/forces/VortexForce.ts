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

    const axisLenSq = p.axisX * p.axisX + p.axisY * p.axisY + p.axisZ * p.axisZ
    if (axisLenSq < 1e-8) return
    const axisInvLen = 1 / Math.sqrt(axisLenSq)
    const ax = p.axisX * axisInvLen
    const ay = p.axisY * axisInvLen
    const az = p.axisZ * axisInvLen

    // tangential = normalize(axis × rel), computed in place to avoid per-call Vector3 allocation
    let tx = ay * dz - az * dy
    let ty = az * dx - ax * dz
    let tz = ax * dy - ay * dx
    const tLenSq = tx * tx + ty * ty + tz * tz
    if (tLenSq < 1e-8) return
    const tInvLen = 1 / Math.sqrt(tLenSq)
    tx *= tInvLen
    ty *= tInvLen
    tz *= tInvLen

    const mag = p.strength * dt
    particle.velocity.x += tx * mag
    particle.velocity.y += ty * mag
    particle.velocity.z += tz * mag
  }
}
