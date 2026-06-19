import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface BrightnessContrastOptions {
  /** Brightness offset [-1, 1]. Default 0. Blender: Bright/Contrast → Bright */
  brightness?: number
  /** Contrast multiplier [-1, 1]. Default 0. Blender: Bright/Contrast → Contrast */
  contrast?: number
}

/** BrightnessContrast — Blender Compositor: Bright/Contrast node */
export class BrightnessContrast extends BasePass {
  readonly passType = 'BrightnessContrast'
  parameters: { brightness: number; contrast: number }

  constructor(opts: BrightnessContrastOptions = {}) {
    super()
    this.parameters = {
      brightness: opts.brightness ?? 0,
      contrast:   opts.contrast   ?? 0,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('BrightnessContrast: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse:   { value: null },
        brightness: { value: this.parameters.brightness },
        contrast:   { value: this.parameters.contrast },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float brightness;
        uniform float contrast;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(tDiffuse, vUv);
          vec3 col = tex.rgb + brightness;
          col = (col - 0.5) * (1.0 + contrast) + 0.5;
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
