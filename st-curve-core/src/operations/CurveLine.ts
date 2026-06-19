import { BufferGeometry, BufferAttribute } from 'three'
import type { BaseCurve } from '../core/BaseCurve.js'

export interface CurveLineOptions {
  /** Number of sample points. Default 128. */
  points?: number
}

/**
 * CurveLine — sample a curve into a line BufferGeometry.
 * Use with THREE.Line / THREE.LineLoop for wireframe curve visualization.
 * Arc-length uniform sampling (constant density along the path).
 */
export class CurveLine {
  parameters: { points: number }

  constructor(opts: CurveLineOptions = {}) {
    this.parameters = { points: opts.points ?? 128 }
  }

  apply(curve: BaseCurve): BufferGeometry {
    const count  = Math.max(2, this.parameters.points)
    const pts    = curve.getSpacedPoints(count)
    const positions = new Float32Array(count * 3)
    pts.forEach((p, i) => {
      positions[i * 3]     = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
    })
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    return geo
  }
}
