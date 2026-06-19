import { BufferGeometry, BufferAttribute } from 'three'
import { BaseUnwrapper } from '../core/BaseUnwrapper.js'

export interface CylinderProjectionOptions {
  /** UV scale along the circumference. Default 1.0. */
  scaleU?: number
  /** UV scale along the cylinder axis. Default 1.0. */
  scaleV?: number
}

/**
 * CylinderProjection — Blender UV: Cylinder Projection
 *
 * Wraps UVs around the Y-axis.
 * U = angle around Y-axis mapped to [0,1].
 * V = normalised height along Y-axis.
 */
export class CylinderProjection extends BaseUnwrapper {
  readonly unwrapType = 'CylinderProjection'
  parameters: { scaleU: number; scaleV: number }

  constructor(opts: CylinderProjectionOptions = {}) {
    super()
    this.parameters = {
      scaleU: opts.scaleU ?? 1.0,
      scaleV: opts.scaleV ?? 1.0,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    if (!this.enabled) return geometry.clone()

    const result  = geometry.clone()
    const posAttr = result.getAttribute('position') as BufferAttribute
    const count   = posAttr.count

    // Find Y extents
    let yMin = Infinity, yMax = -Infinity
    for (let i = 0; i < count; i++) {
      const y = posAttr.getY(i)
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
    const yRange = yMax - yMin || 1

    const { scaleU, scaleV } = this.parameters
    const uv = new Float32Array(count * 2)

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i)
      const y = posAttr.getY(i)
      const z = posAttr.getZ(i)

      const u = (Math.atan2(x, z) / (2 * Math.PI) + 0.5) / scaleU
      const v = ((y - yMin) / yRange)                    / scaleV

      uv[i * 2]     = u
      uv[i * 2 + 1] = v
    }

    result.setAttribute('uv', new BufferAttribute(uv, 2))
    return result
  }
}
