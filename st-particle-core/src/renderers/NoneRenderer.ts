import { Object3D }    from 'three'
import { BaseRenderer } from '../core/BaseRenderer.js'
import type { ParticleLike } from '../core/BaseRenderer.js'
import type { SeededRandom } from '../core/SeededRandom.js'

/**
 * NoneRenderer — invisible particle renderer.
 * Blender: Render → None.
 *
 * Useful when particles drive physics/emitters but should not be drawn,
 * e.g. when particles spawn child systems or are consumed by a fluid sim.
 */
export class NoneRenderer extends BaseRenderer {
  readonly object3D: Object3D = new Object3D()
  parameters: Record<string, number> = {}

  constructor() {
    super()
    this.object3D.visible = false
  }

  update(_particles: ParticleLike[], _aliveCount: number, _params?: Record<string, number>, _rng?: SeededRandom): void {
    // intentionally empty — no visual output
  }

  dispose(): void {
    // nothing to clean up
  }
}
