import type { Vector3 } from 'three'

/**
 * ICollider — the contract every st-physics-core collider fulfils.
 *
 * Colliders resolve penetration by pushing a particle/vertex outside the
 * collider surface and optionally reflecting its velocity.
 */
export interface ICollider {
  parameters: Record<string, number>
  enabled: boolean
  /**
   * If `position` is inside the collider, move it to the surface and
   * reflect `velocity` accordingly.
   * @returns true if a collision was resolved this call.
   */
  resolve(position: Vector3, velocity: Vector3): boolean
}
