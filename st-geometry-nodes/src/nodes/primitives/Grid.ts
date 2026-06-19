import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, type Inputs } from '../../core/GeometryNode.js'

/**
 * Grid — flat plane grid mesh.
 * Blender: Add > Mesh > Grid
 */
export class Grid extends GeometryNode {
  readonly nodeType = 'Grid'

  parameters: {
    /** Total width along X. Blender: Size X. */
    sizeX:  number
    /** Total height along Y. Blender: Size Y. */
    sizeY:  number
    /** Vertex count along X. Blender: Vertices X. */
    vertsX: number
    /** Vertex count along Y. Blender: Vertices Y. */
    vertsY: number
  }

  constructor(opts: { sizeX?: number; sizeY?: number; vertsX?: number; vertsY?: number } = {}) {
    super()
    this.parameters = {
      sizeX:  opts.sizeX  ?? 2,
      sizeY:  opts.sizeY  ?? 2,
      vertsX: opts.vertsX ?? 3,
      vertsY: opts.vertsY ?? 3,
    }
  }

  _evaluate(_inputs: Inputs): Record<string, BufferGeometry> {
    const { sizeX, sizeY, vertsX, vertsY } = this.parameters
    const cols = Math.max(2, vertsX)
    const rows = Math.max(2, vertsY)
    const segX = cols - 1
    const segY = rows - 1
    const hx = sizeX / 2
    const hy = sizeY / 2

    const pos: number[] = []
    const nor: number[] = []
    const uvs: number[] = []
    const idx: number[] = []

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const u = x / segX
        const v = y / segY
        pos.push(u * sizeX - hx, v * sizeY - hy, 0)
        nor.push(0, 0, 1)
        uvs.push(u, v)
      }
    }

    for (let y = 0; y < segY; y++) {
      for (let x = 0; x < segX; x++) {
        const a = y * cols + x
        idx.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols)
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute('normal',   new BufferAttribute(new Float32Array(nor), 3))
    geo.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs), 2))
    geo.setIndex(idx)
    return { Geometry: geo }
  }
}
