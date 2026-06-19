import { Vector2 } from 'three'
import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface BloomOptions {
  /** Luminance threshold — pixels below this are not bloomed. Default 0.8. Blender: Glare → Threshold */
  threshold?: number
  /** Bloom intensity. Default 1.5. Blender: Glare → Strength */
  strength?: number
  /** Bloom spread radius [0–1]. Default 0.4. Blender: Glare → Size */
  radius?: number
}

/** Bloom — Blender Compositor: Glare node (Bloom type) */
export class Bloom extends BasePass {
  readonly passType = 'Bloom'
  parameters: { threshold: number; strength: number; radius: number }

  constructor(opts: BloomOptions = {}) {
    super()
    this.parameters = {
      threshold: opts.threshold ?? 0.8,
      strength:  opts.strength  ?? 1.5,
      radius:    opts.radius    ?? 0.4,
    }
  }

  _threePassDeps() { return ['UnrealBloomPass'] }

  _buildThree(width: number, height: number, reg: PassRegistry): unknown {
    const Pass = reg['UnrealBloomPass'] as (new (...a: unknown[]) => unknown) | undefined
    if (!Pass) throw new Error('Bloom: UnrealBloomPass not found in three/addons.')
    return new Pass(
      new Vector2(width, height),
      this.parameters.strength,
      this.parameters.radius,
      this.parameters.threshold,
    )
  }

  override _buildPmndrs(reg: PassRegistry): unknown {
    const Effect = reg['BloomEffect'] as (new (...a: unknown[]) => unknown) | undefined
    if (!Effect) throw new Error('Bloom: BloomEffect not found in postprocessing.')
    return new Effect({
      intensity:          this.parameters.strength,
      luminanceThreshold: this.parameters.threshold,
      radius:             this.parameters.radius,
    })
  }

  override get _isPmndrsEffect(): boolean { return true }
}
