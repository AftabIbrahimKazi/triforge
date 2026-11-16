import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from 'three'
import type { Side } from 'three'

import type { IntersectorFactory, RayHit, RayIntersector, TriangleSoup } from '../types.js'

const COORDS = 3
const VERTS_PER_TRI = 3

export interface MeshBVHLike {
  raycastFirst(ray: Ray, materialSide?: Side): { distance: number; faceIndex: number } | null | undefined
}

export type MeshBVHConstructor = new (geometry: BufferGeometry) => MeshBVHLike

class MeshBVHIntersector implements RayIntersector {
  private readonly ray = new Ray()
  private readonly origin = new Vector3()
  private readonly direction = new Vector3()

  constructor(private readonly bvh: MeshBVHLike) {}

  raycast(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    hit: RayHit,
  ): boolean {
    this.origin.set(ox, oy, oz)
    this.direction.set(dx, dy, dz)
    this.ray.set(this.origin, this.direction)
    const result = this.bvh.raycastFirst(this.ray, DoubleSide)
    if (!result || typeof result.faceIndex !== 'number') return false
    hit.t = result.distance
    hit.triangle = result.faceIndex
    return true
  }
}

export function meshBVHIntersector(MeshBVH: MeshBVHConstructor): IntersectorFactory {
  return (soup: TriangleSoup): RayIntersector => {
    const geometry = new BufferGeometry()
    const floats = soup.count * VERTS_PER_TRI * COORDS
    geometry.setAttribute('position', new BufferAttribute(soup.positions.slice(0, floats), COORDS))
    return new MeshBVHIntersector(new MeshBVH(geometry))
  }
}
