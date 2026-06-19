import { Vector3 } from 'three'

export interface MetaballObjectOptions {
  position?: [number, number, number]
  radius?:   number
  strength?: number
  negative?: boolean
}

/**
 * MetaballObject — a single metaball field source.
 * Blender equivalent: a Metaball data-block element (Ball / Capsule type).
 *
 * The field contribution at world point p is:
 *   f(p) = strength * radius² / |p - position|²
 * A negative metaball subtracts from the field (carves holes).
 */
export class MetaballObject {
  readonly position: Vector3

  parameters: {
    radius:   number
    strength: number
  }

  /** When true this ball subtracts from the field. Blender: Negative checkbox. */
  negative: boolean

  constructor(opts: MetaballObjectOptions = {}) {
    const [x, y, z] = opts.position ?? [0, 0, 0]
    this.position   = new Vector3(x, y, z)
    this.negative   = opts.negative ?? false
    this.parameters = {
      radius:   opts.radius   ?? 0.5,
      strength: opts.strength ?? 1.0,
    }
  }

  /** Field value contributed by this ball at world point (wx, wy, wz). */
  evaluate(wx: number, wy: number, wz: number): number {
    const dx = wx - this.position.x
    const dy = wy - this.position.y
    const dz = wz - this.position.z
    const d2 = dx*dx + dy*dy + dz*dz
    if (d2 < 1e-8) return this.negative ? -1e6 : 1e6
    const r  = this.parameters.radius
    const v  = this.parameters.strength * r * r / d2
    return this.negative ? -v : v
  }
}
