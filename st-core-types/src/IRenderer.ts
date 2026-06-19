import type { Object3D } from 'three'
import type { IParticleLike } from './IParticlePool.js'

/**
 * IRenderer — the contract every st-particle-core renderer fulfils.
 *
 * Renderers translate the particle pool into a Three.js Object3D each frame.
 * The object is added to the scene once; update() refreshes its geometry/attributes.
 */
export interface IRenderer {
  /** The Three.js object to add to the scene. Add once; never remove and re-add. */
  readonly object3D: Object3D
  parameters: Record<string, number>
  /**
   * Refresh the rendered output from the current particle pool.
   * Called by ParticleSystem.update() after physics integration.
   */
  update(
    particles:  IParticleLike[],
    aliveCount: number,
    params?:    Record<string, number>,
    childRng?:  { next(): number; signed(): number },
  ): void
  dispose(): void
}
