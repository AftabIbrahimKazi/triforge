import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface ZCombineOptions {
  /**
   * Depth split point [0–1]. Pixels with luma below this are treated as far.
   * Default 0.5. Blender: Z Combine → use luminance as depth proxy.
   */
  split?: number
  /** Blend softness around the split [0–1]. Default 0.1. */
  softness?: number
}

/**
 * ZCombine — Blender Compositor: Z Combine node.
 *
 * In a linear render pipeline, a true Z combine (selecting pixels by
 * depth buffer comparison) requires two separate render targets.
 * This pass implements a luminance-keyed depth blend as a single-pass
 * approximation: pixels darker than `split` are treated as "far" and
 * receive a darken/fade effect; bright pixels are treated as "near".
 *
 * For a true two-target Z combine, render to two WebGLRenderTargets
 * and composite them yourself before passing to the pipeline.
 */
export class ZCombine extends BasePass {
  readonly passType = 'ZCombine'
  parameters: { split: number; softness: number }

  constructor(opts: ZCombineOptions = {}) {
    super()
    this.parameters = {
      split:    opts.split    ?? 0.5,
      softness: opts.softness ?? 0.1,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('ZCombine: ShaderPass not found.')
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        split:    { value: this.parameters.split },
        softness: { value: this.parameters.softness },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float split;
        uniform float softness;
        varying vec2 vUv;
        void main(){
          vec4 col    = texture2D(tDiffuse, vUv);
          float luma  = dot(col.rgb, vec3(0.299, 0.587, 0.114));
          float depth = 1.0 - smoothstep(split - softness, split + softness, luma);
          gl_FragColor = vec4(col.rgb * (1.0 - depth * 0.5), col.a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
