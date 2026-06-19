import { Vector3, BufferGeometry } from 'three'
import { BaseEmitter, BaseEmitterOptions } from '../core/BaseEmitter.js'
import type { Particle }     from '../core/Particle.js'
import type { SeededRandom } from '../core/SeededRandom.js'

export interface PointEmitterOptions extends BaseEmitterOptions {
  /** World-space origin of the point emitter */
  position?: { x: number; y: number; z: number }
}

/**
 * PointEmitter — emits particles from a single world-space point.
 * Equivalent to Blender's particle system on an Empty object.
 */
export class PointEmitter extends BaseEmitter {
  private _origin = new Vector3()

  constructor(opts: PointEmitterOptions = {}) {
    super(opts)
    if (opts.position) {
      this._origin.set(opts.position.x, opts.position.y, opts.position.z)
    }
    this.parameters.positionX = this._origin.x
    this.parameters.positionY = this._origin.y
    this.parameters.positionZ = this._origin.z
  }

  spawn(particle: Particle, _geometry: BufferGeometry | null, rng: SeededRandom): void {
    particle.position.set(
      this.parameters.positionX,
      this.parameters.positionY,
      this.parameters.positionZ,
    )

    // Default normal = world up
    const normal  = new Vector3(0, 1, 0)
    const tangent = new Vector3(1, 0, 0)
    this.applyVelocity(particle, normal, tangent, rng)
  }
}
