import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, type Inputs } from '../../core/GeometryNode.js'

/**
 * Circle — n-gon ring or filled disk.
 * Blender: Add > Mesh > Circle
 */
export class Circle extends GeometryNode {
  readonly nodeType = 'Circle'

  parameters: {
    /** Number of vertices. Blender: Vertices. */
    vertices: number
    /** Radius. */
    radius:   number
    /** Fill: 'NOTHING' | 'NGON' | 'TRIFAN'. Blender: Fill Type. */
    fillType: string
  }

  constructor(opts: { vertices?: number; radius?: number; fillType?: string } = {}) {
    super()
    this.parameters = {
      vertices: opts.vertices ?? 32,
      radius:   opts.radius   ?? 1,
      fillType: opts.fillType ?? 'NOTHING',
    }
  }

  _evaluate(_inputs: Inputs): Record<string, BufferGeometry> {
    const { vertices, radius, fillType } = this.parameters
    const verts = Math.max(3, vertices)

    const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = []

    if (fillType === 'TRIFAN') {
      // Center vertex
      pos.push(0, 0, 0); nor.push(0, 0, 1); uvs.push(0.5, 0.5)
      for (let v = 0; v <= verts; v++) {
        const a = (v / verts) * Math.PI * 2
        const x = Math.cos(a), z = Math.sin(a)
        pos.push(x * radius, 0, z * radius)
        nor.push(0, 0, 1)
        uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5)
      }
      for (let v = 0; v < verts; v++) idx.push(0, v + 1, v + 2)
    } else {
      for (let v = 0; v < verts; v++) {
        const a = (v / verts) * Math.PI * 2
        const x = Math.cos(a), z = Math.sin(a)
        pos.push(x * radius, 0, z * radius)
        nor.push(0, 0, 1)
        uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5)
      }
      if (fillType === 'NGON') {
        for (let v = 1; v < verts - 1; v++) idx.push(0, v, v + 1)
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute('normal',   new BufferAttribute(new Float32Array(nor), 3))
    geo.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs), 2))
    if (idx.length) geo.setIndex(idx)
    return { Geometry: geo }
  }
}
