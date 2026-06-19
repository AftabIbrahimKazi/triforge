import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface ArrayModifierOptions {
  count?:   number
  offsetX?: number
  offsetY?: number
  offsetZ?: number
}

/**
 * Array Modifier — Blender "Array" modifier equivalent.
 * Duplicates geometry N times along a fixed offset vector.
 *
 * parameters.count:   number of copies (including the original)
 * parameters.offsetX/Y/Z: distance between each copy
 */
export class ArrayModifier extends BaseModifier {
  get name() { return 'Array' }

  parameters: Record<string, number>

  constructor(options: ArrayModifierOptions = {}) {
    super()
    this.parameters = {
      count:   Math.round(options.count   ?? 2),
      offsetX: options.offsetX ?? 1.0,
      offsetY: options.offsetY ?? 0.0,
      offsetZ: options.offsetZ ?? 0.0,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const count   = Math.max(1, Math.round(this.parameters.count))
    const offX    = this.parameters.offsetX
    const offY    = this.parameters.offsetY
    const offZ    = this.parameters.offsetZ

    const srcPos  = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcUv   = geometry.getAttribute('uv')
    const srcIdx  = geometry.getIndex()
    const vCount  = srcPos.count

    const outPos:  number[] = []
    const outNorm: number[] = []
    const outUv:   number[] = []
    const outIdx:  number[] = []

    for (let i = 0; i < count; i++) {
      const dx = offX * i, dy = offY * i, dz = offZ * i

      for (let v = 0; v < vCount; v++) {
        outPos.push(
          srcPos.getX(v) + dx,
          srcPos.getY(v) + dy,
          srcPos.getZ(v) + dz,
        )
        if (srcNorm) outNorm.push(srcNorm.getX(v), srcNorm.getY(v), srcNorm.getZ(v))
        if (srcUv)   outUv.push(srcUv.getX(v), srcUv.getY(v))
      }

      const base = i * vCount
      if (srcIdx) {
        const ia = srcIdx.array
        for (let t = 0; t < ia.length; t++) outIdx.push(ia[t] + base)
      } else {
        for (let t = 0; t < vCount; t++) outIdx.push(t + base)
      }
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
    if (outNorm.length) result.setAttribute('normal', new BufferAttribute(new Float32Array(outNorm), 3))
    if (outUv.length)   result.setAttribute('uv',     new BufferAttribute(new Float32Array(outUv),   2))
    result.setIndex(new BufferAttribute(new Uint32Array(outIdx), 1))
    return result
  }
}
