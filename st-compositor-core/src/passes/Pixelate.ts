import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface PixelateOptions {
  /** Pixel block size in screen pixels. Default 8. Blender: Pixelate node */
  pixelSize?: number
}

/** Pixelate — Blender Compositor: Pixelate node */
export class Pixelate extends BasePass {
  readonly passType = 'Pixelate'
  parameters: { pixelSize: number }

  constructor(opts: PixelateOptions = {}) {
    super()
    this.parameters = { pixelSize: opts.pixelSize ?? 8 }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('Pixelate: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse:  { value: null },
        resolution: { value: [_width, _height] },
        pixelSize:  { value: this.parameters.pixelSize },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float pixelSize;
        varying vec2 vUv;
        void main() {
          vec2 dxy = pixelSize / resolution;
          vec2 uv  = dxy * floor(vUv / dxy);
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }

  override _buildPmndrs(reg: PassRegistry): unknown {
    const Effect = reg['PixelationEffect'] as (new (...a: unknown[]) => unknown) | undefined
    if (!Effect) throw new Error('Pixelate: PixelationEffect not found in postprocessing.')
    return new Effect(this.parameters.pixelSize)
  }

  override get _isPmndrsEffect(): boolean { return true }
}
