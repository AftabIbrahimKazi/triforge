import { Vector3 }   from 'three'
import { BaseForce }  from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/**
 * Callback that returns a velocity vector at a world-space position.
 * Use this to connect FlowFieldForce to a fluid simulation:
 *
 * ```typescript
 * // Outside st-particle-core — no import restriction applies
 * import { FLIPSimulator } from '@st-fluid-core'
 * const fluid = new FLIPSimulator({ ... })
 *
 * const force = new FlowFieldForce({
 *   velocityFn: (x, y, z) => {
 *     const u = fluid.grid.interpU(x, y, z)
 *     const v = fluid.grid.interpV(x, y, z)
 *     const w = fluid.grid.interpW(x, y, z)
 *     return { x: u, y: v, z: w }
 *   }
 * })
 * ```
 *
 * When `velocityFn` is provided the built-in noise field is bypassed entirely.
 */
export type FlowVelocityFn = (x: number, y: number, z: number) => { x: number; y: number; z: number }

export interface FlowFieldForceOptions {
  /** Field strength multiplier. Default 1. */
  strength?: number
  /** Noise scale — spatial frequency of the flow field. Default 1. */
  scale?: number
  /** Animation speed (scrolls the field over time). Default 0.3. */
  speed?: number
  /** How strongly particles align to the field vs keep inertia [0–1]. Default 0.5. */
  influence?: number
  /** Maximum distance from `position` to apply force. 0 = unlimited. Default 0. */
  maxDistance?: number
  /** World-space field origin. Default [0,0,0]. */
  px?: number; py?: number; pz?: number
  /**
   * Optional external velocity field callback.
   * When provided, replaces the built-in curl-noise field.
   * Receives world-space (x,y,z), returns velocity vector.
   * Use to connect to st-fluid-core FLIPSimulator or any other velocity source.
   */
  velocityFn?: FlowVelocityFn
}

/**
 * FlowFieldForce — steers particles along a smooth 3-D noise velocity field.
 * Blender: Force Field → Texture (with animated noise).
 *
 * Each particle samples a curl-noise-like direction at its world position
 * and is nudged toward that direction. The field animates over time via
 * `parameters.speed`.
 */
export class FlowFieldForce extends BaseForce {
  parameters: Record<string, number>

  /** World-space field origin for maxDistance range check. Not GSAP-animatable. */
  position: Vector3

  /** Optional external velocity callback — overrides built-in noise when set. */
  velocityFn: FlowVelocityFn | null

  private _t = 0

  constructor(opts: FlowFieldForceOptions = {}) {
    super()
    this.position   = new Vector3(opts.px ?? 0, opts.py ?? 0, opts.pz ?? 0)
    this.velocityFn = opts.velocityFn ?? null
    this.parameters = {
      strength:    opts.strength    ?? 1,
      scale:       opts.scale       ?? 1,
      speed:       opts.speed       ?? 0.3,
      influence:   opts.influence   ?? 0.5,
      maxDistance: opts.maxDistance ?? 0,
    }
  }

  apply(particle: Particle, dt: number): void {
    const { strength, scale, speed, influence, maxDistance } = this.parameters
    this._t += dt * speed

    if (maxDistance > 0) {
      const dx = particle.position.x - this.position.x
      const dy = particle.position.y - this.position.y
      const dz = particle.position.z - this.position.z
      if (dx * dx + dy * dy + dz * dz > maxDistance * maxDistance) return
    }

    let vx: number, vy: number, vz: number

    if (this.velocityFn) {
      // External fluid sim velocity field
      const v = this.velocityFn(particle.position.x, particle.position.y, particle.position.z)
      vx = v.x; vy = v.y; vz = v.z
    } else {
      // Built-in curl-noise field
      const x = particle.position.x * scale
      const y = particle.position.y * scale
      const z = particle.position.z * scale
      const t = this._t
      vx = this._noise(x + 0.0, y + 1.7, z + 3.4, t + 0.0)
         - this._noise(x + 0.0, y - 1.7, z - 3.4, t + 0.0)
      vy = this._noise(x + 5.2, y + 0.0, z + 1.3, t + 1.1)
         - this._noise(x - 5.2, y + 0.0, z - 1.3, t + 1.1)
      vz = this._noise(x + 2.8, y + 4.1, z + 0.0, t + 2.3)
         - this._noise(x - 2.8, y - 4.1, z + 0.0, t + 2.3)
    }

    const len = Math.sqrt(vx*vx + vy*vy + vz*vz) + 1e-6
    const nx = vx/len, ny = vy/len, nz = vz/len

    const s = strength * influence * dt
    particle.velocity.x += nx * s
    particle.velocity.y += ny * s
    particle.velocity.z += nz * s
  }

  private _noise(x: number, y: number, z: number, t: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + t * 591.3) * 43758.5453
    return (n - Math.floor(n)) * 2 - 1
  }
}
