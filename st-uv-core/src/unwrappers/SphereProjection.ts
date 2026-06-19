import { BufferGeometry, BufferAttribute } from 'three'
import { BaseUnwrapper } from '../core/BaseUnwrapper.js'

export interface SphereProjectionOptions {
  /** UV scale. Default 1.0. Blender: Sphere Projection → Scale */
  scale?: number
}

/**
 * SphereProjection — Blender UV: Sphere Projection
 *
 * Latitude/longitude spherical mapping.
 * U = longitude (angle around Y-axis) → [0, 1].
 * V = latitude  (angle from top)      → [0, 1].
 *
 * Best for spherical or organic shapes centered near the origin.
 */
export class SphereProjection extends BaseUnwrapper {
  readonly unwrapType = 'SphereProjection'
  parameters: { scale: number }

  constructor(opts: SphereProjectionOptions = {}) {
    super()
    this.parameters = { scale: opts.scale ?? 1.0 }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    if (!this.enabled) return geometry.clone()

    const result  = geometry.clone()
    const posAttr = result.getAttribute('position') as BufferAttribute
    const count   = posAttr.count
    const scale   = this.parameters.scale
    const uv      = new Float32Array(count * 2)

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i)
      const y = posAttr.getY(i)
      const z = posAttr.getZ(i)
      const r = Math.sqrt(x * x + y * y + z * z) || 1

      const u = (Math.atan2(x, z) / (2 * Math.PI) + 0.5) / scale
      const v = (Math.acos(Math.max(-1, Math.min(1, y / r))) / Math.PI) / scale

      uv[i * 2]     = u
      uv[i * 2 + 1] = v
    }

    result.setAttribute('uv', new BufferAttribute(uv, 2))
    return result
  }
}
