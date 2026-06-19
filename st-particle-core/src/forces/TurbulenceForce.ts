import { Vector3 }    from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/** Noise-based random force (Blender: Force Field → Turbulence) */
export class TurbulenceForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space field origin for maxDistance range check. Not GSAP-animatable. */
  position: Vector3

  constructor(opts: {
    strength?: number; scale?: number; speed?: number; maxDistance?: number
    px?: number; py?: number; pz?: number
  } = {}) {
    super()
    this.position = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.parameters = {
      strength:    opts.strength    ?? 1,
      scale:       opts.scale       ?? 1,
      speed:       opts.speed       ?? 1,
      maxDistance: opts.maxDistance ?? 0,
    }
  }

  apply(particle: Particle, dt: number): void {
    const { strength, scale, speed, maxDistance } = this.parameters
    if (maxDistance > 0) {
      const dx = particle.position.x - this.position.x
      const dy = particle.position.y - this.position.y
      const dz = particle.position.z - this.position.z
      if (dx * dx + dy * dy + dz * dz > maxDistance * maxDistance) return
    }
    const t = performance.now() * 0.001 * speed
    const x = particle.position.x * scale
    const z = particle.position.z * scale
    const nx = this._hash(x + 0.0, z + 13.7, t + 0.0)
    const ny = this._hash(x + 4.1, z + 7.3,  t + 1.3)
    const nz = this._hash(x + 9.2, z + 2.8,  t + 2.7)
    particle.velocity.x += nx * strength * dt
    particle.velocity.y += ny * strength * dt
    particle.velocity.z += nz * strength * dt
  }

  private _hash(x: number, y: number, z: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
    return (n - Math.floor(n)) * 2 - 1
  }
}
