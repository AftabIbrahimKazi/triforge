import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export type TwistAxis = 'x' | 'y' | 'z'

export interface TwistModifierOptions {
  angle?: number   // total twist angle in radians
  axis?:  TwistAxis
}

/**
 * Twist Modifier — Blender "Simple Deform" (Twist mode) equivalent.
 * Rotates vertices around an axis by an amount proportional to their position along that axis.
 * Vertices at one end are unrotated; vertices at the other end are rotated by `angle` radians.
 *
 * parameters.angle: total twist in radians (Math.PI * 2 = one full revolution)
 */
export class TwistModifier extends BaseModifier {
  get name() { return 'Twist' }

  parameters: Record<string, number>
  axis: TwistAxis

  constructor(options: TwistModifierOptions = {}) {
    super()
    this.parameters = { angle: options.angle ?? Math.PI }
    this.axis       = options.axis ?? 'y'
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const angle   = this.parameters.angle
    const srcPos  = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcUv   = geometry.getAttribute('uv')
    const srcIdx  = geometry.getIndex()
    const vCount  = srcPos.count

    // Find axis extent for normalizing twist amount
    let min = Infinity, max = -Infinity
    for (let v = 0; v < vCount; v++) {
      const val = this._axisVal(srcPos, v)
      if (val < min) min = val
      if (val > max) max = val
    }
    const range = max - min || 1

    const outPos  = new Float32Array(vCount * 3)
    const outNorm = srcNorm ? new Float32Array(vCount * 3) : null

    for (let v = 0; v < vCount; v++) {
      const t   = (this._axisVal(srcPos, v) - min) / range
      const a   = t * angle
      const cos = Math.cos(a), sin = Math.sin(a)

      const [px, py, pz] = this._rotate(srcPos.getX(v), srcPos.getY(v), srcPos.getZ(v), cos, sin)
      outPos[v*3] = px; outPos[v*3+1] = py; outPos[v*3+2] = pz

      if (srcNorm && outNorm) {
        const [nx, ny, nz] = this._rotate(srcNorm.getX(v), srcNorm.getY(v), srcNorm.getZ(v), cos, sin)
        outNorm[v*3] = nx; outNorm[v*3+1] = ny; outNorm[v*3+2] = nz
      }
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(outPos, 3))
    if (outNorm) result.setAttribute('normal', new BufferAttribute(outNorm, 3))
    if (srcUv)   result.setAttribute('uv', srcUv.clone())
    if (srcIdx)  result.setIndex(srcIdx.clone())
    return result
  }

  private _axisVal(pos: ReturnType<BufferGeometry['getAttribute']>, v: number): number {
    if (this.axis === 'x') return pos.getX(v)
    if (this.axis === 'z') return pos.getZ(v)
    return pos.getY(v)
  }

  private _rotate(x: number, y: number, z: number, cos: number, sin: number): [number, number, number] {
    if (this.axis === 'y') return [x*cos - z*sin, y, x*sin + z*cos]
    if (this.axis === 'x') return [x, y*cos - z*sin, y*sin + z*cos]
    return [x*cos - y*sin, x*sin + y*cos, z]
  }
}
