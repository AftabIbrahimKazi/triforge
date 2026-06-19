import type { Vector3 } from 'three'

export type RadiusFunction = (u: number, v: number) => number
export type HeightFunction = (u: number, v: number) => number

export interface RadiusGeometryOptions {
  radiusSegments?: number
  heightSegments?: number
  closed?: boolean
  thetaStart?: number
  thetaLength?: number
  phiStart?: number
  phiLength?: number
}

export interface GeometryStats {
  vertexCount: number
  triangleCount: number
  normalCount: number
  uvCount: number
  totalMemory: number
}
