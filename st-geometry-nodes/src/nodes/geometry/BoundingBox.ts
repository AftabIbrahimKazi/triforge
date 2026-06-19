import { BufferGeometry, BufferAttribute, Box3, Vector3 } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * BoundingBox — compute axis-aligned bounding box of a geometry.
 * Blender: Geometry Nodes > Geometry > Bounding Box
 *
 * Outputs:
 *   Bounding Box — a BoxGeometry matching the AABB
 *   Min          — [minX, minY, minZ]
 *   Max          — [maxX, maxY, maxZ]
 */
export class BoundingBox extends GeometryNode {
  readonly nodeType = 'BoundingBox'
  parameters = {}

  constructor(opts: { geometry?: OutputRef | BufferGeometry | null } = {}) {
    super()
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { 'Bounding Box': null, Min: null, Max: null }

    const box = new Box3().setFromBufferAttribute(
      src.getAttribute('position') as BufferAttribute,
    )
    const min = box.min, max = box.max
    const sx = max.x - min.x, sy = max.y - min.y, sz = max.z - min.z
    const cx = (min.x + max.x) * 0.5
    const cy = (min.y + max.y) * 0.5
    const cz = (min.z + max.z) * 0.5

    // Build a box geometry matching the AABB
    const verts = [
      [cx-sx/2, cy-sy/2, cz-sz/2], [cx+sx/2, cy-sy/2, cz-sz/2],
      [cx+sx/2, cy+sy/2, cz-sz/2], [cx-sx/2, cy+sy/2, cz-sz/2],
      [cx-sx/2, cy-sy/2, cz+sz/2], [cx+sx/2, cy-sy/2, cz+sz/2],
      [cx+sx/2, cy+sy/2, cz+sz/2], [cx-sx/2, cy+sy/2, cz+sz/2],
    ]
    const pos = new Float32Array(verts.flatMap(v => v))
    const idx = new Uint32Array([
      0,1,2, 0,2,3,  // -Z
      5,4,7, 5,7,6,  // +Z
      4,0,3, 4,3,7,  // -X
      1,5,6, 1,6,2,  // +X
      4,5,1, 4,1,0,  // -Y
      3,2,6, 3,6,7,  // +Y
    ])
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setIndex(new BufferAttribute(idx, 1))
    geo.computeVertexNormals()

    return {
      'Bounding Box': geo,
      Min: [min.x, min.y, min.z] as [number,number,number],
      Max: [max.x, max.y, max.z] as [number,number,number],
    }
  }
}
