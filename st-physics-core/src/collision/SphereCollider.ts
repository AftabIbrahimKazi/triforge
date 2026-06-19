import { BaseCollider } from './BaseCollider.js'

/**
 * SphereCollider — sphere-shaped collider.
 * Blender: Collision modifier on a sphere mesh object.
 *
 * Cloth particles are pushed to the sphere surface when inside.
 */
export class SphereCollider extends BaseCollider {
  readonly colliderType = 'SphereCollider'

  parameters: {
    centerX: number; centerY: number; centerZ: number
    radius: number
    /** Friction coefficient [0, 1]. */
    friction: number
  }

  constructor(opts: {
    center?:  [number, number, number]
    radius?:  number
    friction?: number
  } = {}) {
    super()
    const c = opts.center ?? [0, 0, 0]
    this.parameters = {
      centerX: c[0], centerY: c[1], centerZ: c[2],
      radius:  opts.radius  ?? 1,
      friction: opts.friction ?? 0.1,
    }
  }

  resolve(px: number, py: number, pz: number): [number, number, number] | null {
    if (!this.enabled) return null
    const { centerX, centerY, centerZ, radius } = this.parameters
    const dx = px - centerX, dy = py - centerY, dz = pz - centerZ
    const d2 = dx*dx + dy*dy + dz*dz

    if (d2 >= radius * radius) return null  // outside sphere

    const d   = Math.sqrt(d2) || 1e-6
    const inv = radius / d
    return [
      centerX + dx * inv,
      centerY + dy * inv,
      centerZ + dz * inv,
    ]
  }
}
