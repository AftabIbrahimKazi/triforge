/**
 * BaseCollider — abstract collision shape.
 * Blender: Collision modifier on a mesh object.
 *
 * `resolve(px, py, pz)` returns the corrected position if the point
 * is inside the collider, or null if no collision.
 */
export abstract class BaseCollider {
  abstract readonly colliderType: string
  /** When false, collider is skipped. */
  enabled: boolean = true

  /**
   * If the point (px, py, pz) penetrates this collider, return the
   * corrected position that places it on the surface.
   * Returns null when no collision.
   */
  abstract resolve(px: number, py: number, pz: number): [number, number, number] | null
}
