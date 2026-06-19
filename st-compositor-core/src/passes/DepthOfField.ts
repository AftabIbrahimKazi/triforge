import { Camera, Scene } from 'three'
import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface DepthOfFieldOptions {
  /** World-space focus distance. Default 10. Blender: Defocus → Z */
  focusDistance?: number
  /** Bokeh scale (aperture size). Default 3. Blender: Defocus → fStop */
  bokehScale?: number
  /** Maximum blur radius in pixels. Default 5. */
  maxBlur?: number
}

/** DepthOfField — Blender Compositor: Defocus node */
export class DepthOfField extends BasePass {
  readonly passType = 'DepthOfField'
  parameters: { focusDistance: number; bokehScale: number; maxBlur: number }

  // Scene and camera are injected by CompositorOutput via the registry
  // (BokehPass requires both at construction time)
  private _scene:  Scene  | null = null
  private _camera: Camera | null = null

  constructor(opts: DepthOfFieldOptions = {}) {
    super()
    this.parameters = {
      focusDistance: opts.focusDistance ?? 10,
      bokehScale:    opts.bokehScale    ?? 3,
      maxBlur:       opts.maxBlur       ?? 5,
    }
  }

  _threePassDeps() { return ['BokehPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const Pass   = reg['BokehPass']
    const scene  = (reg as Record<string, unknown>)['_scene']  as Scene  | undefined
    const camera = (reg as Record<string, unknown>)['_camera'] as Camera | undefined

    if (!Pass)   throw new Error('DepthOfField: BokehPass not found in three/addons.')
    if (!scene)  throw new Error('DepthOfField: scene not injected — use CompositorOutput to compile.')
    if (!camera) throw new Error('DepthOfField: camera not injected — use CompositorOutput to compile.')

    return new (Pass as new (s: Scene, c: Camera, p: Record<string, number>) => unknown)(
      scene,
      camera,
      {
        focus:    this.parameters.focusDistance,
        aperture: this.parameters.bokehScale * 0.00001,
        maxblur:  this.parameters.maxBlur * 0.001,
      }
    )
  }

  override _buildPmndrs(reg: PassRegistry): unknown {
    const Effect = reg['DepthOfFieldEffect']
    const camera = (reg as Record<string, unknown>)['_camera'] as Camera | undefined

    if (!Effect) throw new Error('DepthOfField: DepthOfFieldEffect not found in postprocessing.')
    if (!camera) throw new Error('DepthOfField: camera not injected — use CompositorOutput to compile.')

    return new (Effect as new (c: Camera, o: Record<string, number>) => unknown)(camera, {
      focusDistance: this.parameters.focusDistance,
      bokehScale:    this.parameters.bokehScale,
    })
  }

  override get _isPmndrsEffect(): boolean { return true }
}
