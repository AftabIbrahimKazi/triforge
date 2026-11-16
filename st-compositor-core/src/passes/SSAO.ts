import { Vector2 } from 'three'
import type { Plane } from 'three'
import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface SSAOOptions {
  /** AO sample radius in world units. Default 0.5. Blender: Ambient Occlusion → Distance */
  radius?: number
  /** Minimum depth difference to generate occlusion. Default 0.005. */
  minDistance?: number
  /** Maximum depth difference to generate occlusion. Default 0.1. */
  maxDistance?: number
  /**
   * Clipping planes to apply to the pass's own normal/depth render of the scene. A scene that clips its meshes
   * (cutaways, sections) must give the same planes here, or the clipped-away half comes back as occlusion.
   * Default none.
   */
  clippingPlanes?: Plane[]
}

/**
 * SSAO — Screen Space Ambient Occlusion.
 * Blender Compositor: Ambient Occlusion pass.
 *
 * Wraps Three.js SSAOPass from three/addons.
 * Requires scene and camera — injected automatically by CompositorOutput.
 *
 * Post-compile injection needed:
 * ```typescript
 * comp.compile(renderer, scene, camera)
 * ```
 */
export class SSAO extends BasePass {
  readonly passType = 'SSAO'
  parameters: { radius: number; minDistance: number; maxDistance: number }
  /** Planes applied to the pass's normal material. Not animatable, so not part of `parameters`. */
  clippingPlanes: Plane[]

  constructor(opts: SSAOOptions = {}) {
    super()
    this.parameters = {
      radius:      opts.radius      ?? 0.5,
      minDistance: opts.minDistance ?? 0.005,
      maxDistance: opts.maxDistance ?? 0.1,
    }
    this.clippingPlanes = opts.clippingPlanes ?? []
  }

  _threePassDeps() { return ['SSAOPass'] }

  _buildThree(width: number, height: number, reg: PassRegistry): unknown {
    const Pass    = reg['SSAOPass'] as (new (...a: unknown[]) => unknown) | undefined
    const scene   = reg['_scene']
    const camera  = reg['_camera']
    if (!Pass)   throw new Error('SSAO: SSAOPass not found in three/addons.')
    if (!scene)  throw new Error('SSAO: scene not provided. Pass scene to CompositorOutput.compile().')
    if (!camera) throw new Error('SSAO: camera not provided. Pass camera to CompositorOutput.compile().')

    const pass = new Pass(scene, camera, new Vector2(width, height)) as Record<string, unknown>
    pass['kernelRadius'] = this.parameters.radius
    pass['minDistance']  = this.parameters.minDistance
    pass['maxDistance']  = this.parameters.maxDistance
    // SSAOPass draws the scene again with its own normal material; give that draw the same clipping as the real one
    const normalMaterial = pass['normalMaterial'] as { clippingPlanes?: Plane[] } | undefined
    if (this.clippingPlanes.length && normalMaterial) normalMaterial.clippingPlanes = this.clippingPlanes
    return pass
  }
}
