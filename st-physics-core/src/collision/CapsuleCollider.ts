import { BaseCollider } from './BaseCollider.js'

/**
 * CapsuleCollider — a cylinder with hemispherical caps.
 * Blender: Collision modifier on a capsule mesh.
 *
 * Good for character bodies, limbs, and pillars.
 * Defined by two endpoint centers and a radius.
 */
export class CapsuleCollider extends BaseCollider {
  readonly colliderType = 'CapsuleCollider'

  parameters: {
    ax: number; ay: number; az: number  // endpoint A
    bx: number; by: number; bz: number  // endpoint B
    radius: number
    friction: number
  }

  constructor(opts: {
    a?: [number, number, number]
    b?: [number, number, number]
    radius?: number
    friction?: number
  } = {}) {
    super()
    const a = opts.a ?? [0, -1, 0]
    const b = opts.b ?? [0,  1, 0]
    this.parameters = {
      ax: a[0], ay: a[1], az: a[2],
      bx: b[0], by: b[1], bz: b[2],
      radius:  opts.radius  ?? 0.5,
      friction: opts.friction ?? 0.1,
    }
  }

  resolve(px: number, py: number, pz: number): [number, number, number] | null {
    if (!this.enabled) return null
    const { ax, ay, az, bx, by, bz, radius } = this.parameters

    // Closest point on segment AB to point P
    const abx = bx-ax, aby = by-ay, abz = bz-az
    const apx = px-ax, apy = py-ay, apz = pz-az
    const ab2 = abx*abx + aby*aby + abz*abz
    const t   = ab2 > 0 ? Math.max(0, Math.min(1, (apx*abx + apy*aby + apz*abz) / ab2)) : 0

    const cx = ax + abx*t, cy = ay + aby*t, cz = az + abz*t
    const dx = px-cx, dy = py-cy, dz = pz-cz
    const d2 = dx*dx + dy*dy + dz*dz

    if (d2 >= radius*radius) return null

    const d   = Math.sqrt(d2) || 1e-6
    const inv = radius / d
    return [cx + dx*inv, cy + dy*inv, cz + dz*inv]
  }
}
