import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface SolidifyModifierOptions {
  thickness?: number
  offset?:    number  // -1 = inward only, 0 = centered, 1 = outward only
}

/**
 * Solidify Modifier — Blender "Solidify" modifier equivalent.
 * Adds thickness to a surface by extruding it along vertex normals.
 * Produces a closed shell: original face + offset face + side walls.
 *
 * parameters.thickness: extrusion distance
 * parameters.offset:    -1 (inward) to 1 (outward), 0 = centered
 */
export class SolidifyModifier extends BaseModifier {
  get name() { return 'Solidify' }

  parameters: Record<string, number>

  constructor(options: SolidifyModifierOptions = {}) {
    super()
    this.parameters = {
      thickness: options.thickness ?? 0.1,
      offset:    options.offset    ?? -1.0,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const thickness = this.parameters.thickness
    const offset    = Math.max(-1, Math.min(1, this.parameters.offset))

    const srcPos  = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcUv   = geometry.getAttribute('uv')
    const srcIdx  = geometry.getIndex()
    const vCount  = srcPos.count

    // outward shift: offset maps [-1,1] → [0,1] fraction of thickness
    const outerShift = thickness * (1.0 + offset) * 0.5
    const innerShift = thickness * (1.0 - offset) * 0.5

    const outPos:  number[] = []
    const outNorm: number[] = []
    const outUv:   number[] = []
    const outIdx:  number[] = []

    // Front face vertices (shifted outward)
    for (let v = 0; v < vCount; v++) {
      const nx = srcNorm ? srcNorm.getX(v) : 0
      const ny = srcNorm ? srcNorm.getY(v) : 1
      const nz = srcNorm ? srcNorm.getZ(v) : 0
      outPos.push(srcPos.getX(v) + nx * outerShift, srcPos.getY(v) + ny * outerShift, srcPos.getZ(v) + nz * outerShift)
      outNorm.push(nx, ny, nz)
      if (srcUv) outUv.push(srcUv.getX(v), srcUv.getY(v))
    }

    // Back face vertices (shifted inward, flipped normal)
    for (let v = 0; v < vCount; v++) {
      const nx = srcNorm ? srcNorm.getX(v) : 0
      const ny = srcNorm ? srcNorm.getY(v) : 1
      const nz = srcNorm ? srcNorm.getZ(v) : 0
      outPos.push(srcPos.getX(v) - nx * innerShift, srcPos.getY(v) - ny * innerShift, srcPos.getZ(v) - nz * innerShift)
      outNorm.push(-nx, -ny, -nz)
      if (srcUv) outUv.push(srcUv.getX(v), srcUv.getY(v))
    }

    const tris = buildTriList(srcIdx, vCount)

    // Front faces (original winding)
    for (const [a, b, c] of tris) outIdx.push(a, b, c)

    // Back faces (reversed winding)
    for (const [a, b, c] of tris) outIdx.push(a + vCount, c + vCount, b + vCount)

    // Side walls — connect each edge of each triangle
    for (const [a, b, c] of tris) {
      const edges: [number, number][] = [[a,b],[b,c],[c,a]]
      for (const [e0, e1] of edges) {
        outIdx.push(e0, e1, e1 + vCount)
        outIdx.push(e0, e1 + vCount, e0 + vCount)
      }
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
    result.setAttribute('normal',   new BufferAttribute(new Float32Array(outNorm), 3))
    if (outUv.length) result.setAttribute('uv', new BufferAttribute(new Float32Array(outUv), 2))
    result.setIndex(new BufferAttribute(new Uint32Array(outIdx), 1))
    return result
  }
}

function buildTriList(idx: ReturnType<BufferGeometry['getIndex']>, vCount: number): [number, number, number][] {
  const tris: [number, number, number][] = []
  if (idx) {
    const ia = idx.array
    for (let i = 0; i < ia.length; i += 3) tris.push([ia[i], ia[i+1], ia[i+2]])
  } else {
    for (let i = 0; i < vCount; i += 3) tris.push([i, i+1, i+2])
  }
  return tris
}
