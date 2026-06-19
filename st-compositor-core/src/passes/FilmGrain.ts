import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface FilmGrainOptions {
  /** Noise intensity [0–1]. Default 0.35. Blender: Film node → Grain */
  intensity?: number
  /** Greyscale grain. Default false. Blender: Film node → Greyscale */
  greyscale?: boolean
}

/**
 * FilmGrain — Blender Compositor: Film node.
 *
 * Uses Three.js FilmPass (r165 constructor: intensity, grayscale).
 */
export class FilmGrain extends BasePass {
  readonly passType = 'FilmGrain'
  parameters: { intensity: number; greyscale: number }

  constructor(opts: FilmGrainOptions = {}) {
    super()
    this.parameters = {
      intensity: opts.intensity ?? 0.35,
      greyscale: opts.greyscale ? 1 : 0,
    }
  }

  _threePassDeps() { return ['FilmPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const Pass = reg['FilmPass']
    if (!Pass) throw new Error('FilmGrain: FilmPass not found in three/addons.')
    // r165 FilmPass(intensity, grayscale)
    return new (Pass as new (intensity: number, grayscale: boolean) => unknown)(
      this.parameters.intensity,
      this.parameters.greyscale > 0.5,
    )
  }

  override _buildPmndrs(reg: PassRegistry): unknown {
    const Effect = reg['NoiseEffect']
    if (!Effect) throw new Error('FilmGrain: NoiseEffect not found in postprocessing.')
    return new (Effect as new (opts: Record<string, unknown>) => unknown)({ premultiply: true })
  }

  override get _isPmndrsEffect(): boolean { return true }
}
