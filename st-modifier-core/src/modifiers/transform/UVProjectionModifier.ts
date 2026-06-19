import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export type UVProjectionType = 'box' | 'sphere' | 'triplanar'

export interface UVProjectionModifierOptions {
  type?:   UVProjectionType
  scaleX?: number
  scaleY?: number
  scaleZ?: number
}

/**
 * UV Projection Modifier — generates procedural UVs from vertex positions.
 * Replaces baked UVs with projection-based coordinates.
 * Essential for geometry that was generated procedurally and has no meaningful UVs.
 *
 * NOTE: This is NOT a direct equivalent of Blender's "UV Project" modifier,
 * which projects from a camera/object frustum onto a mesh. This modifier
 * generates UVs mathematically from vertex positions — closer to Blender's
 * "Generated" texture coordinate mode or the Smart UV Project unwrap.
 *
 * modes:
 *   box       — axis-aligned cubic projection (Blender "Box" mapping equivalent)
 *   sphere    — lat/lon spherical projection (Blender "Sphere" mapping equivalent)
 *   triplanar — normal-weighted blend of all three axis projections (no seams,
 *               no Blender equivalent — best for organic/displaced surfaces)
 *
 * parameters.scaleX/Y/Z: UV scale per axis
 */
export class UVProjectionModifier extends BaseModifier {
  get name() { return 'UVProjection' }

  parameters: Record<string, number>
  type: UVProjectionType

  constructor(options: UVProjectionModifierOptions = {}) {
    super()
    this.type       = options.type   ?? 'box'
    this.parameters = {
      scaleX: options.scaleX ?? 1.0,
      scaleY: options.scaleY ?? 1.0,
      scaleZ: options.scaleZ ?? 1.0,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const srcPos  = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcIdx  = geometry.getIndex()
    const vCount  = srcPos.count

    const outUv = new Float32Array(vCount * 2)
    const sx = this.parameters.scaleX
    const sy = this.parameters.scaleY
    const sz = this.parameters.scaleZ

    for (let v = 0; v < vCount; v++) {
      const px = srcPos.getX(v), py = srcPos.getY(v), pz = srcPos.getZ(v)
      let u = 0, uv = 0

      switch (this.type) {
        case 'sphere': {
          const len = Math.sqrt(px*px + py*py + pz*pz) || 1
          u  = (Math.atan2(pz/len, px/len) / (Math.PI * 2) + 0.5) * sx
          uv = (Math.asin(Math.max(-1, Math.min(1, py/len))) / Math.PI + 0.5) * sy
          break
        }
        case 'triplanar': {
          const nx = srcNorm ? Math.abs(srcNorm.getX(v)) : 0.333
          const ny = srcNorm ? Math.abs(srcNorm.getY(v)) : 0.334
          const nz = srcNorm ? Math.abs(srcNorm.getZ(v)) : 0.333
          const sum = nx + ny + nz || 1
          const wx = nx/sum, wy = ny/sum, wz = nz/sum
          u  = (py*sz * wx + pz*sz * wy + px*sx * wz)
          uv = (pz*sy * wx + px*sx * wy + py*sy * wz)
          break
        }
        default: { // box
          const nx = srcNorm ? Math.abs(srcNorm.getX(v)) : 0
          const ny = srcNorm ? Math.abs(srcNorm.getY(v)) : 1
          const nz = srcNorm ? Math.abs(srcNorm.getZ(v)) : 0
          if (ny >= nx && ny >= nz)      { u = px * sx; uv = pz * sz }
          else if (nx >= ny && nx >= nz) { u = pz * sz; uv = py * sy }
          else                           { u = px * sx; uv = py * sy }
          break
        }
      }

      outUv[v*2]   = u
      outUv[v*2+1] = uv
    }

    const result = geometry.clone()
    result.setAttribute('uv', new BufferAttribute(outUv, 2))
    return result
  }
}
