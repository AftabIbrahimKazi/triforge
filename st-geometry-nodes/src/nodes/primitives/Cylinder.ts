import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, type Inputs } from '../../core/GeometryNode.js'

/**
 * Cylinder — vertical cylinder with optional caps.
 * Blender: Add > Mesh > Cylinder
 */
export class Cylinder extends GeometryNode {
  readonly nodeType = 'Cylinder'

  parameters: {
    /** Number of side vertices. Blender: Vertices. */
    vertices:    number
    /** Radius at top. Blender: Radius Top. */
    radiusTop:   number
    /** Radius at bottom. Blender: Radius Bottom. */
    radiusBottom: number
    /** Height. Blender: Depth. */
    depth:       number
    /** Number of height segments. */
    segments:    number
    /** Fill caps: 'NOTHING' | 'NGON' | 'TRIFAN'. Blender: Cap Fill Type. */
    capFill:     string
  }

  constructor(opts: {
    vertices?: number; radiusTop?: number; radiusBottom?: number
    depth?: number; segments?: number; capFill?: string
  } = {}) {
    super()
    this.parameters = {
      vertices:     opts.vertices     ?? 32,
      radiusTop:    opts.radiusTop    ?? 1,
      radiusBottom: opts.radiusBottom ?? 1,
      depth:        opts.depth        ?? 2,
      segments:     opts.segments     ?? 1,
      capFill:      opts.capFill      ?? 'NGON',
    }
  }

  _evaluate(_inputs: Inputs): Record<string, BufferGeometry> {
    const { vertices, radiusTop, radiusBottom, depth, segments, capFill } = this.parameters
    const verts = Math.max(3, vertices)
    const segs  = Math.max(1, segments)
    const hd    = depth / 2

    const pos: number[] = []
    const nor: number[] = []
    const uvs: number[] = []
    const idx: number[] = []

    // Side rings
    const ringStart: number[] = []
    for (let s = 0; s <= segs; s++) {
      const t  = s / segs
      const ry = -hd + t * depth
      const r  = radiusBottom + (radiusTop - radiusBottom) * t
      ringStart.push(pos.length / 3)
      const slope = (radiusBottom - radiusTop) / depth
      const nLen  = Math.sqrt(1 + slope * slope)
      for (let v = 0; v <= verts; v++) {
        const a = (v / verts) * Math.PI * 2
        const x = Math.cos(a), z = Math.sin(a)
        pos.push(x * r, ry, z * r)
        nor.push(x / nLen, slope / nLen, z / nLen)
        uvs.push(v / verts, t)
      }
    }

    const cols = verts + 1
    for (let s = 0; s < segs; s++) {
      const base = ringStart[s]
      for (let v = 0; v < verts; v++) {
        const a = base + v, b = base + cols + v
        idx.push(a, b, a+1, b, b+1, a+1)
      }
    }

    // Caps
    if (capFill !== 'NOTHING') {
      const buildCap = (y: number, r: number, flipNormal: boolean) => {
        const centerIdx = pos.length / 3
        pos.push(0, y, 0); nor.push(0, flipNormal ? -1 : 1, 0); uvs.push(0.5, 0.5)
        const rimStart = pos.length / 3
        for (let v = 0; v <= verts; v++) {
          const a = (v / verts) * Math.PI * 2
          const x = Math.cos(a), z = Math.sin(a)
          pos.push(x * r, y, z * r)
          nor.push(0, flipNormal ? -1 : 1, 0)
          uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5)
        }
        for (let v = 0; v < verts; v++) {
          const a = rimStart + v, b = rimStart + v + 1
          if (flipNormal) idx.push(centerIdx, b, a)
          else            idx.push(centerIdx, a, b)
        }
      }
      buildCap( hd, radiusTop,    false)
      buildCap(-hd, radiusBottom, true)
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute('normal',   new BufferAttribute(new Float32Array(nor), 3))
    geo.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs), 2))
    geo.setIndex(idx)
    return { Geometry: geo }
  }
}
