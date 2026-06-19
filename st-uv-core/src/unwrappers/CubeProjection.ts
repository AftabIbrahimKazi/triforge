import { BufferGeometry, BufferAttribute } from 'three'
import { BaseUnwrapper } from '../core/BaseUnwrapper.js'

export interface CubeProjectionOptions {
  /** UV scale. Default 1.0. Blender: Cube Projection → Scale */
  scale?: number
}

/**
 * CubeProjection — Blender UV: Cube Projection
 *
 * Projects UVs from the dominant face normal direction.
 * Each vertex is mapped to one of 6 cube faces based on its normal.
 * Good for blocky/hard-surface geometry with clear face orientations.
 */
export class CubeProjection extends BaseUnwrapper {
  readonly unwrapType = 'CubeProjection'
  parameters: { scale: number }

  constructor(opts: CubeProjectionOptions = {}) {
    super()
    this.parameters = { scale: opts.scale ?? 1.0 }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    if (!this.enabled) return geometry.clone()

    const result  = geometry.clone()
    const posAttr = result.getAttribute('position') as BufferAttribute
    const nrmAttr = result.getAttribute('normal')   as BufferAttribute | undefined
    const count   = posAttr.count
    const scale   = this.parameters.scale
    const uv      = new Float32Array(count * 2)

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i)
      const y = posAttr.getY(i)
      const z = posAttr.getZ(i)

      // Use normal if available, else use position as approximation
      const nx = nrmAttr ? nrmAttr.getX(i) : x
      const ny = nrmAttr ? nrmAttr.getY(i) : y
      const nz = nrmAttr ? nrmAttr.getZ(i) : z

      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz)

      let u: number, v: number
      if (ax >= ay && ax >= az) {
        // X-dominant face
        u = nx > 0 ? -z : z
        v = y
      } else if (ay >= ax && ay >= az) {
        // Y-dominant face
        u = x
        v = ny > 0 ? z : -z
      } else {
        // Z-dominant face
        u = nz > 0 ? x : -x
        v = y
      }

      uv[i * 2]     = (u / scale) * 0.5 + 0.5
      uv[i * 2 + 1] = (v / scale) * 0.5 + 0.5
    }

    result.setAttribute('uv', new BufferAttribute(uv, 2))
    return result
  }
}
