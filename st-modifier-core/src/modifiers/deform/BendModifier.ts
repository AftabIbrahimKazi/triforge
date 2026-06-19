import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export type BendAxis = 'x' | 'y' | 'z'

export interface BendModifierOptions {
  angle?: number   // total bend angle in radians
  axis?:  BendAxis // axis to bend around
}

/**
 * Bend Modifier — Blender "Simple Deform" (Bend mode) equivalent.
 * Bends geometry around an axis by wrapping it along a circular arc.
 * A 2π angle wraps the geometry into a full ring.
 *
 * parameters.angle: total bend angle in radians
 */
export class BendModifier extends BaseModifier {
  get name() { return 'Bend' }

  parameters: Record<string, number>
  axis: BendAxis

  constructor(options: BendModifierOptions = {}) {
    super()
    this.parameters = { angle: options.angle ?? Math.PI * 0.5 }
    this.axis       = options.axis ?? 'y'
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const angle  = this.parameters.angle
    const srcPos = geometry.getAttribute('position')
    const srcUv  = geometry.getAttribute('uv')
    const srcIdx = geometry.getIndex()
    const vCount = srcPos.count

    if (Math.abs(angle) < 1e-6) return geometry

    // Find extent along bend axis
    let min = Infinity, max = -Infinity
    for (let v = 0; v < vCount; v++) {
      const val = this._axisVal(srcPos, v)
      if (val < min) min = val
      if (val > max) max = val
    }
    const range  = max - min || 1
    const radius = range / angle

    const outPos  = new Float32Array(vCount * 3)
    const outNorm = new Float32Array(vCount * 3)

    for (let v = 0; v < vCount; v++) {
      const t   = (this._axisVal(srcPos, v) - min) / range
      const a   = t * angle - angle * 0.5
      const cos = Math.cos(a), sin = Math.sin(a)

      const off = this._offsetVal(srcPos, v)
      const r   = radius + off

      const [px, py, pz] = this._applyBend(r, a, cos, sin, srcPos, v)
      outPos[v*3] = px; outPos[v*3+1] = py; outPos[v*3+2] = pz

      // Outward normal points radially
      outNorm[v*3] = cos; outNorm[v*3+1] = 0; outNorm[v*3+2] = sin
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(outPos, 3))
    result.setAttribute('normal',   new BufferAttribute(outNorm, 3))
    if (srcUv)  result.setAttribute('uv', srcUv.clone())
    if (srcIdx) result.setIndex(srcIdx.clone())
    result.computeVertexNormals()
    return result
  }

  private _axisVal(pos: ReturnType<BufferGeometry['getAttribute']>, v: number): number {
    if (this.axis === 'x') return pos.getX(v)
    if (this.axis === 'z') return pos.getZ(v)
    return pos.getX(v)
  }

  private _offsetVal(pos: ReturnType<BufferGeometry['getAttribute']>, v: number): number {
    if (this.axis === 'y') return pos.getZ(v)
    return pos.getY(v)
  }

  private _applyBend(
    r: number, _a: number, cos: number, sin: number,
    pos: ReturnType<BufferGeometry['getAttribute']>, v: number,
  ): [number, number, number] {
    if (this.axis === 'y') return [r * sin, pos.getY(v), r * cos]
    if (this.axis === 'x') return [pos.getX(v), r * sin, r * cos]
    return [r * cos, r * sin, pos.getZ(v)]
  }
}
