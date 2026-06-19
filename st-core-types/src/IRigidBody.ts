import type { Vector3, Quaternion } from 'three'

/**
 * IRigidBody — the minimal readable interface for a rigid body in
 * st-physics-core's RigidBodyWorld.
 *
 * Use this when a force field or constraint needs to read body state
 * without importing the concrete RigidBody class.
 */
export interface IRigidBody {
  position:    Vector3
  velocity:    Vector3
  orientation: Quaternion
  angularVel:  Vector3
  isStatic:    boolean
  parameters: {
    mass:           number
    linearDamping:  number
    angularDamping: number
    restitution:    number
  }
}
