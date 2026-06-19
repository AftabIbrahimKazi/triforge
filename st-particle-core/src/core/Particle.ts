import { Vector3 } from 'three'

/**
 * A single particle — all mutable state lives here.
 * Allocated once in a pool, reset on each re-emit.
 */
export class Particle {
  /** World-space position */
  position    = new Vector3()
  /** World-space velocity */
  velocity    = new Vector3()
  /** World-space angular velocity (for rotation) */
  angularVel  = new Vector3()
  /** Euler rotation angles in radians */
  rotation    = new Vector3()
  /** Current age in seconds */
  age         = 0
  /** Total lifetime in seconds */
  lifetime    = 1
  /** Size in world units */
  size        = 1
  /** Normalised age [0,1] — updated each tick */
  normalised  = 0
  /** Whether this slot is currently alive */
  alive       = false
  /** Which emitter spawned this particle (index into emitter array) */
  emitterIndex = 0

  reset(): void {
    this.position.set(0, 0, 0)
    this.velocity.set(0, 0, 0)
    this.angularVel.set(0, 0, 0)
    this.rotation.set(0, 0, 0)
    this.age       = 0
    this.lifetime  = 1
    this.size      = 1
    this.normalised = 0
    this.alive     = false
  }
}
