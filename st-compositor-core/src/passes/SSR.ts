import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface SSROptions {
  /** Maximum ray distance for reflections. Default 180. Blender: Screen Space Reflections → Max Roughness */
  maxDistance?: number
  /** Opacity / blend strength of reflections [0–1]. Default 0.5. */
  opacity?: number
  /** Roughness threshold above which SSR is skipped [0–1]. Default 0.8. */
  maxRoughness?: number
}

/**
 * SSR — Screen Space Reflections.
 * Blender Compositor / EEVEE: Screen Space Reflections.
 *
 * Wraps Three.js SSRPass from three/addons.
 * Requires scene and camera — injected automatically by CompositorOutput.
 *
 * SSR works best with smooth, metallic or glossy surfaces.
 * For very rough surfaces set a low `maxRoughness` to skip the effect.
 */
export class SSR extends BasePass {
  readonly passType = 'SSR'
  parameters: { maxDistance: number; opacity: number; maxRoughness: number }

  constructor(opts: SSROptions = {}) {
    super()
    this.parameters = {
      maxDistance:  opts.maxDistance  ?? 180,
      opacity:      opts.opacity      ?? 0.5,
      maxRoughness: opts.maxRoughness ?? 0.8,
    }
  }

  _threePassDeps() { return ['SSRPass'] }

  _buildThree(width: number, height: number, reg: PassRegistry): unknown {
    const Pass    = reg['SSRPass'] as (new (...a: unknown[]) => unknown) | undefined
    const scene   = reg['_scene']
    const camera  = reg['_camera']
    const renderer = reg['_renderer']
    if (!Pass)   throw new Error('SSR: SSRPass not found in three/addons.')
    if (!scene)  throw new Error('SSR: scene not provided.')
    if (!camera) throw new Error('SSR: camera not provided.')

    const pass = new Pass(renderer, scene, camera, {
      width,
      height,
      isPerspectiveCamera: true,
    }) as Record<string, unknown>

    pass['maxDistance']  = this.parameters.maxDistance
    pass['opacity']      = this.parameters.opacity
    pass['maxRoughness'] = this.parameters.maxRoughness
    return pass
  }
}
