import { BufferGeometry } from 'three'

export interface SeamEdge {
  /** Index of first vertex of the seam edge. */
  a: number
  /** Index of second vertex of the seam edge. */
  b: number
}

/**
 * MarkSeams — Blender UV: Mark Seam
 *
 * Stores seam edges in geometry.userData.seams.
 * Seams are used by ConformalLSCM and AngleBasedABF to cut the mesh
 * into disc-topology patches before unwrapping.
 *
 * Non-destructive: returns a clone of the geometry with updated userData.
 */
export class MarkSeams {
  parameters: Record<string, number> = {}

  /**
   * Mark edges as seams on the geometry.
   * @param geometry Source geometry
   * @param edges    Array of vertex-index pairs defining seam edges
   */
  apply(geometry: BufferGeometry, edges: SeamEdge[]): BufferGeometry {
    const result = geometry.clone()
    result.userData = { ...geometry.userData, seams: edges.map(e => ({ a: e.a, b: e.b })) }
    return result
  }

  /**
   * Clear all seam markings from geometry.
   */
  clear(geometry: BufferGeometry): BufferGeometry {
    const result = geometry.clone()
    const ud = { ...geometry.userData }
    delete ud['seams']
    result.userData = ud
    return result
  }

  /**
   * Retrieve seam edges stored on a geometry (or empty array if none).
   */
  static getSeams(geometry: BufferGeometry): SeamEdge[] {
    return (geometry.userData['seams'] as SeamEdge[] | undefined) ?? []
  }
}
