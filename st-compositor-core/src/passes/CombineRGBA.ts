import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface CombineRGBAOptions {
  /** Red channel gain [0–2]. Default 1.0. Blender: Combine RGBA → R */
  r?: number
  /** Green channel gain [0–2]. Default 1.0. */
  g?: number
  /** Blue channel gain [0–2]. Default 1.0. */
  b?: number
  /** Output alpha value [0–1]. Default 1.0. Blender: Combine RGBA → A */
  alpha?: number
}

/**
 * CombineRGBA — Blender Compositor: Combine RGBA node.
 *
 * Re-weights each colour channel individually and sets output alpha.
 * Use after SeparateRGBA to remix channels or to tone a single channel.
 *
 * In a single-chain pipeline (where all passes share one framebuffer),
 * this applies per-channel gains to the current render rather than
 * accepting four separate greyscale inputs.
 */
export class CombineRGBA extends BasePass {
  readonly passType = 'CombineRGBA'
  parameters: { r: number; g: number; b: number; alpha: number }

  constructor(opts: CombineRGBAOptions = {}) {
    super()
    this.parameters = {
      r:     opts.r     ?? 1.0,
      g:     opts.g     ?? 1.0,
      b:     opts.b     ?? 1.0,
      alpha: opts.alpha ?? 1.0,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('CombineRGBA: ShaderPass not found.')
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        rGain:    { value: this.parameters.r },
        gGain:    { value: this.parameters.g },
        bGain:    { value: this.parameters.b },
        alpha:    { value: this.parameters.alpha },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float rGain, gGain, bGain, alpha;
        varying vec2 vUv;
        void main(){
          vec4 col = texture2D(tDiffuse, vUv);
          gl_FragColor = vec4(col.r * rGain, col.g * gGain, col.b * bGain, alpha);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
