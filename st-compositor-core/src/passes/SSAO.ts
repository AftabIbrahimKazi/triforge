import { Vector2 } from 'three'
import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface SSAOOptions {
  /** AO sample radius in world units. Default 0.5. Blender: Ambient Occlusion → Distance */
  radius?: number
  /** Minimum depth difference to generate occlusion. Default 0.005. */
  minDistance?: number
  /** Maximum depth difference to generate occlusion. Default 0.1. */
  maxDistance?: number
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

  constructor(opts: SSAOOptions = {}) {
    super()
    this.parameters = {
      radius:      opts.radius      ?? 0.5,
      minDistance: opts.minDistance ?? 0.005,
      maxDistance: opts.maxDistance ?? 0.1,
    }
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
    return pass
  }
}
