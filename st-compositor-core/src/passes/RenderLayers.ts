import { Scene, Camera } from 'three'
import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface RenderLayersOptions {
  /** Three.js layer mask to render. Default 0xffffffff (all layers). */
  layerMask?: number
}

/**
 * RenderLayers — render a specific Three.js layer mask into the buffer.
 * Blender Compositor: Render Layers node.
 *
 * Replaces the default RenderPass with one that temporarily sets
 * camera.layers to the given mask, then restores it.
 *
 * Usage:
 *   // Render only layer 1
 *   comp.add(new RenderLayers({ layerMask: 2 }))
 *
 * Note: because EffectComposer always prepends its own RenderPass,
 * this pass renders an additional layer-filtered pass on top.
 * For full control, set layerMask = 0xffffffff to render all layers.
 */
export class RenderLayers extends BasePass {
  readonly passType = 'RenderLayers'
  parameters: { layerMask: number }

  constructor(opts: RenderLayersOptions = {}) {
    super()
    this.parameters = { layerMask: opts.layerMask ?? 0xffffffff }
  }

  _threePassDeps() { return ['RenderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const RenderPass = reg['RenderPass'] as (new (s: Scene, c: Camera) => unknown) | undefined
    if (!RenderPass) throw new Error('RenderLayers: RenderPass not found in three/addons.')

    const scene  = reg['_scene']  as Scene  | undefined
    const camera = reg['_camera'] as Camera | undefined
    if (!scene || !camera) throw new Error('RenderLayers: scene/camera not injected into registry.')

    const mask = this.parameters.layerMask

    // Build a custom RenderPass wrapper that applies the layer mask
    const pass = new RenderPass(scene, camera)
    const origRender = (pass as Record<string,unknown>)['render']

    ;(pass as Record<string,unknown>)['render'] = function(
      this: unknown,
      renderer: unknown,
      writeBuffer: unknown,
      readBuffer: unknown,
      ...rest: unknown[]
    ) {
      const layers = (camera as unknown as Record<string,{mask:number}>)['layers']
      const savedMask = layers.mask
      layers.mask = mask
      ;(origRender as (...a: unknown[]) => void).call(this, renderer, writeBuffer, readBuffer, ...rest)
      layers.mask = savedMask
    }

    return pass
  }
}
