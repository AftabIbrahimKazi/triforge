import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface ExtrudeModifierOptions {
  amount?: number
}

/**
 * Face Extrude Modifier — procedurally extrudes every face along its normal.
 * Produces a mesh where each triangle becomes a raised column with side walls.
 *
 * NOTE: This is NOT Blender's Extrude modifier. Blender does not have a
 * non-destructive extrude modifier — extrusion is an edit mode operation on
 * selected faces. This modifier is a procedural equivalent useful for
 * stylized effects (crystalline surfaces, low-poly spiky geometry).
 *
 * For Blender-equivalent face extrusion, use edit mode or geometry nodes.
 *
 * parameters.amount: extrusion distance along face normal
 */
export class ExtrudeModifier extends BaseModifier {
  get name() { return 'FaceExtrude' }

  parameters: Record<string, number>

  constructor(options: ExtrudeModifierOptions = {}) {
    super()
    this.parameters = { amount: options.amount ?? 0.1 }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const amount  = this.parameters.amount
    const srcPos  = geometry.getAttribute('position')
    const srcUv   = geometry.getAttribute('uv')
    const srcIdx  = geometry.getIndex()
    const vCount  = srcPos.count

    const outPos:  number[] = []
    const outNorm: number[] = []
    const outUv:   number[] = []
    const outIdx:  number[] = []

    const tris = buildTriList(srcIdx, vCount)

    for (const [a, b, c] of tris) {
      // Face normal
      const ax = srcPos.getX(a), ay = srcPos.getY(a), az = srcPos.getZ(a)
      const bx = srcPos.getX(b), by = srcPos.getY(b), bz = srcPos.getZ(b)
      const cx = srcPos.getX(c), cy = srcPos.getY(c), cz = srcPos.getZ(c)

      const ux = bx-ax, uy = by-ay, uz = bz-az
      const vx = cx-ax, vy = cy-ay, vz = cz-az
      let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
      nx /= len; ny /= len; nz /= len

      const base = outPos.length / 3

      // Bottom (original) face
      const positions = [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]
      const uvs = srcUv ? [
        [srcUv.getX(a), srcUv.getY(a)],
        [srcUv.getX(b), srcUv.getY(b)],
        [srcUv.getX(c), srcUv.getY(c)],
      ] : [[0,0],[1,0],[0,1]]

      for (let i = 0; i < 3; i++) {
        outPos.push(...positions[i])
        outNorm.push(-nx, -ny, -nz)
        outUv.push(...uvs[i])
      }
      // Top (extruded) face
      for (let i = 0; i < 3; i++) {
        outPos.push(positions[i][0] + nx*amount, positions[i][1] + ny*amount, positions[i][2] + nz*amount)
        outNorm.push(nx, ny, nz)
        outUv.push(...uvs[i])
      }

      // Bottom winding reversed
      outIdx.push(base, base+2, base+1)
      // Top winding
      outIdx.push(base+3, base+4, base+5)
      // Side walls
      const pairs: [number,number,number,number][] = [[0,1,4,3],[1,2,5,4],[2,0,3,5]]
      for (const [p0,p1,p2,p3] of pairs) {
        outIdx.push(base+p0, base+p1, base+p2)
        outIdx.push(base+p0, base+p2, base+p3)
      }
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
    result.setAttribute('normal',   new BufferAttribute(new Float32Array(outNorm), 3))
    result.setAttribute('uv',       new BufferAttribute(new Float32Array(outUv),   2))
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
