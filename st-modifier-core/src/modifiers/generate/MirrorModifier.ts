import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface MirrorModifierOptions {
  x?:         boolean
  y?:         boolean
  z?:         boolean
  /** Vertices within this distance of the mirror plane are welded (merged). Default 0.001 */
  mergeThreshold?: number
}

/**
 * Mirror Modifier — Blender "Mirror" modifier equivalent.
 *
 * Mirrors geometry across one or more world axes, one axis at a time.
 * Vertices within mergeThreshold of the mirror plane are welded — exactly
 * as Blender does to prevent seams at the mirror boundary.
 *
 * Each active axis is applied sequentially (same as Blender's axis checkboxes):
 *   X active → mirrors across the YZ plane (negates X)
 *   Y active → mirrors across the XZ plane (negates Y)
 *   Z active → mirrors across the XY plane (negates Z)
 *
 * parameters.x/y/z: 1 = mirror across that axis, 0 = skip
 * parameters.mergeThreshold: weld distance at mirror plane
 */
export class MirrorModifier extends BaseModifier {
  get name() { return 'Mirror' }

  parameters: Record<string, number>

  constructor(options: MirrorModifierOptions = {}) {
    super()
    this.parameters = {
      x:               options.x !== false ? 1 : 0,
      y:               options.y ? 1 : 0,
      z:               options.z ? 1 : 0,
      mergeThreshold:  options.mergeThreshold ?? 0.001,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    let geo = geometry

    // Apply each active axis sequentially — same as Blender
    if (this.parameters.x > 0.5) geo = this._mirrorAxis(geo, 0)
    if (this.parameters.y > 0.5) geo = this._mirrorAxis(geo, 1)
    if (this.parameters.z > 0.5) geo = this._mirrorAxis(geo, 2)

    return geo
  }

  /**
   * Mirror across one axis (0=X, 1=Y, 2=Z) and weld vertices at the mirror plane.
   */
  private _mirrorAxis(geometry: BufferGeometry, axis: 0 | 1 | 2): BufferGeometry {
    const srcPos = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcUv  = geometry.getAttribute('uv')
    const srcIdx = geometry.getIndex()
    const vCount = srcPos.count
    const thresh = this.parameters.mergeThreshold

    const tris = buildTriList(srcIdx, vCount)

    const outPos:  number[] = []
    const outNorm: number[] = []
    const outUv:   number[] = []
    const outIdx:  number[] = []

    // Copy original vertices
    for (let v = 0; v < vCount; v++) {
      outPos.push(srcPos.getX(v), srcPos.getY(v), srcPos.getZ(v))
      if (srcNorm) outNorm.push(srcNorm.getX(v), srcNorm.getY(v), srcNorm.getZ(v))
      if (srcUv)   outUv.push(srcUv.getX(v), srcUv.getY(v))
    }

    // Map from original vertex index → mirrored vertex index
    // Vertices ON the mirror plane (within threshold) reuse the original vertex (welded)
    const mirrorMap: number[] = new Array(vCount)

    for (let v = 0; v < vCount; v++) {
      const coords = [srcPos.getX(v), srcPos.getY(v), srcPos.getZ(v)]
      const axVal  = coords[axis]

      if (Math.abs(axVal) <= thresh) {
        // On the mirror plane — weld: mirrored copy reuses original vertex
        // Clamp the original to exactly 0 on the mirror axis
        outPos[v*3 + axis] = 0
        mirrorMap[v] = v
      } else {
        // Off-plane — create a new mirrored vertex
        const mi = outPos.length / 3
        const mx = axis === 0 ? -coords[0] : coords[0]
        const my = axis === 1 ? -coords[1] : coords[1]
        const mz = axis === 2 ? -coords[2] : coords[2]
        outPos.push(mx, my, mz)

        if (srcNorm) {
          const nx = srcNorm.getX(v), ny = srcNorm.getY(v), nz = srcNorm.getZ(v)
          outNorm.push(
            axis === 0 ? -nx : nx,
            axis === 1 ? -ny : ny,
            axis === 2 ? -nz : nz,
          )
        }
        if (srcUv) outUv.push(srcUv.getX(v), srcUv.getY(v))

        mirrorMap[v] = mi
      }
    }

    // Original triangles
    for (const [a, b, c] of tris) outIdx.push(a, b, c)

    // Mirrored triangles — reverse winding to preserve front-face direction
    for (const [a, b, c] of tris) {
      outIdx.push(mirrorMap[a], mirrorMap[c], mirrorMap[b])
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
    if (outNorm.length) result.setAttribute('normal', new BufferAttribute(new Float32Array(outNorm), 3))
    if (outUv.length)   result.setAttribute('uv',     new BufferAttribute(new Float32Array(outUv),   2))
    result.setIndex(new BufferAttribute(new Uint32Array(outIdx), 1))
    result.computeVertexNormals()
    return result
  }
}

function buildTriList(
  idx: ReturnType<BufferGeometry['getIndex']>,
  vCount: number,
): [number, number, number][] {
  const tris: [number, number, number][] = []
  if (idx) {
    const ia = idx.array
    for (let i = 0; i < ia.length; i += 3) tris.push([ia[i], ia[i+1], ia[i+2]])
  } else {
    for (let i = 0; i < vCount; i += 3) tris.push([i, i+1, i+2])
  }
  return tris
}
