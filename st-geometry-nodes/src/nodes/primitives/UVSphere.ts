import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, type Inputs } from '../../core/GeometryNode.js'

/**
 * UVSphere — latitude/longitude sphere.
 * Blender: Add > Mesh > UV Sphere
 */
export class UVSphere extends GeometryNode {
  readonly nodeType = 'UVSphere'

  parameters: {
    /** Sphere radius. */
    radius:   number
    /** Longitude segments. Blender: Segments. */
    segments: number
    /** Latitude rings. Blender: Rings. */
    rings:    number
  }

  constructor(opts: { radius?: number; segments?: number; rings?: number } = {}) {
    super()
    this.parameters = {
      radius:   opts.radius   ?? 1,
      segments: opts.segments ?? 32,
      rings:    opts.rings    ?? 16,
    }
  }

  _evaluate(_inputs: Inputs): Record<string, BufferGeometry> {
    const { radius, segments, rings } = this.parameters
    const segs = Math.max(3, segments)
    const rngs = Math.max(2, rings)

    const pos: number[] = []
    const nor: number[] = []
    const uvs: number[] = []
    const idx: number[] = []

    for (let r = 0; r <= rngs; r++) {
      const phi = (r / rngs) * Math.PI
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)
      for (let s = 0; s <= segs; s++) {
        const theta = (s / segs) * Math.PI * 2
        const x = Math.cos(theta) * sinPhi
        const y = cosPhi
        const z = Math.sin(theta) * sinPhi
        pos.push(x * radius, y * radius, z * radius)
        nor.push(x, y, z)
        uvs.push(s / segs, 1 - r / rngs)
      }
    }

    const cols = segs + 1
    for (let r = 0; r < rngs; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * cols + s
        const b = a + cols
        idx.push(a, b, a + 1, b, b + 1, a + 1)
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
