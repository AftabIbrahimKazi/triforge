export type Vec3 = readonly [number, number, number]

export interface SunSpec {
  direction: Vec3
  color: Vec3
  intensity: number
}

export type SkyFunction = (direction: Vec3) => Vec3

export interface RayHit {
  t: number
  triangle: number
}

export interface RayIntersector {
  raycast(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    hit: RayHit,
  ): boolean
}

export interface MeshRange {
  start: number
  end: number
}

export interface TriangleSoup {
  count: number
  positions: Float32Array
  uvs: Float32Array
  normals: Float32Array
  triangleMesh: Uint32Array
  meshRanges: ReadonlyArray<MeshRange>
}

export type IntersectorFactory = (soup: TriangleSoup) => RayIntersector

export interface BakeProgress {
  meshIndex: number
  meshCount: number
  rowsDone: number
  rowsTotal: number
}
