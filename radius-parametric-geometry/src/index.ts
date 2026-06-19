export { RadiusParametricGeometry } from './geometries/RadiusParametricGeometry.js'
export type {
  RadiusFunction,
  HeightFunction,
  RadiusGeometryOptions,
  GeometryStats,
} from './types/index.js'

import { RadiusParametricGeometry } from './geometries/RadiusParametricGeometry.js'

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).st =
    (window as unknown as Record<string, unknown>).st ?? {}
  ;((window as unknown as Record<string, Record<string, unknown>>).st).RadiusParametricGeometry =
    RadiusParametricGeometry
}
