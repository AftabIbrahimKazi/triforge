import { BaseCollider } from './BaseCollider.js'

/**
 * PlaneCollider — infinite flat plane collider.
 * Blender: Collision object with a flat plane mesh.
 *
 * The plane is defined by a point on it and a normal vector.
 * Default: ground plane at Y=0, normal pointing up.
 */
export class PlaneCollider extends BaseCollider {
  readonly colliderType = 'PlaneCollider'

  parameters: {
    /** Point on the plane (Y component used for horizontal planes). */
    pointX: number; pointY: number; pointZ: number
    /** Normal direction (should be unit length). */
    normalX: number; normalY: number; normalZ: number
    /** Friction coefficient [0, 1]. 0 = frictionless, 1 = full stop. */
    friction: number
  }

  constructor(opts: {
    point?:  [number, number, number]
    normal?: [number, number, number]
    friction?: number
  } = {}) {
    super()
    const p = opts.point  ?? [0, 0, 0]
    const n = opts.normal ?? [0, 1, 0]
    this.parameters = {
      pointX: p[0],  pointY: p[1],  pointZ: p[2],
      normalX: n[0], normalY: n[1], normalZ: n[2],
      friction: opts.friction ?? 0.1,
    }
  }

  resolve(px: number, py: number, pz: number): [number, number, number] | null {
    if (!this.enabled) return null
    const { pointX, pointY, pointZ, normalX, normalY, normalZ } = this.parameters
    // Signed distance from plane
    const dx = px - pointX, dy = py - pointY, dz = pz - pointZ
    const dist = dx * normalX + dy * normalY + dz * normalZ

    if (dist >= 0) return null  // above plane — no collision

    // Push back to plane surface
    return [
      px - normalX * dist,
      py - normalY * dist,
      pz - normalZ * dist,
    ]
  }
}
