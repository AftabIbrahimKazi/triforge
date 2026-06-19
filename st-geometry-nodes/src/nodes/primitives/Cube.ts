import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, type Inputs } from '../../core/GeometryNode.js'

/**
 * Cube — axis-aligned box.
 * Blender: Add > Mesh > Cube
 */
export class Cube extends GeometryNode {
  readonly nodeType = 'Cube'

  parameters: {
    /** Half-size along each axis. Blender: Size. */
    sizeX: number
    sizeY: number
    sizeZ: number
  }

  constructor(opts: { sizeX?: number; sizeY?: number; sizeZ?: number; size?: number } = {}) {
    super()
    const s = opts.size ?? 2
    this.parameters = {
      sizeX: opts.sizeX ?? s,
      sizeY: opts.sizeY ?? s,
      sizeZ: opts.sizeZ ?? s,
    }
  }

  _evaluate(_inputs: Inputs): Record<string, BufferGeometry> {
    const { sizeX, sizeY, sizeZ } = this.parameters
    const hx = sizeX / 2, hy = sizeY / 2, hz = sizeZ / 2

    // 6 faces, each a quad split into 2 triangles
    // [position(3), normal(3), uv(2)] per vertex
    const faces: Array<{
      verts: [number,number,number][]
      normal: [number,number,number]
    }> = [
      { verts: [[-hx,-hy, hz],[ hx,-hy, hz],[ hx, hy, hz],[-hx, hy, hz]], normal: [ 0, 0, 1] },
      { verts: [[ hx,-hy,-hz],[-hx,-hy,-hz],[-hx, hy,-hz],[ hx, hy,-hz]], normal: [ 0, 0,-1] },
      { verts: [[-hx,-hy,-hz],[-hx,-hy, hz],[-hx, hy, hz],[-hx, hy,-hz]], normal: [-1, 0, 0] },
      { verts: [[ hx,-hy, hz],[ hx,-hy,-hz],[ hx, hy,-hz],[ hx, hy, hz]], normal: [ 1, 0, 0] },
      { verts: [[-hx, hy, hz],[ hx, hy, hz],[ hx, hy,-hz],[-hx, hy,-hz]], normal: [ 0, 1, 0] },
      { verts: [[-hx,-hy,-hz],[ hx,-hy,-hz],[ hx,-hy, hz],[-hx,-hy, hz]], normal: [ 0,-1, 0] },
    ]

    const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = []
    let base = 0
    for (const face of faces) {
      for (const [x,y,z] of face.verts) { pos.push(x,y,z); nor.push(...face.normal) }
      uvs.push(0,0, 1,0, 1,1, 0,1)
      idx.push(base, base+1, base+2, base, base+2, base+3)
      base += 4
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute('normal',   new BufferAttribute(new Float32Array(nor), 3))
    geo.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs), 2))
    geo.setIndex(idx)
    return { Geometry: geo }
  }
}
