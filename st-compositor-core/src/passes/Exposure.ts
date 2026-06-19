import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface ExposureOptions {
  /** Exposure value in EV stops. Default 0 (no change). Blender: Exposure → Exposure */
  exposure?: number
}

/** Exposure — Blender Compositor: Exposure node */
export class Exposure extends BasePass {
  readonly passType = 'Exposure'
  parameters: { exposure: number }

  constructor(opts: ExposureOptions = {}) {
    super()
    this.parameters = { exposure: opts.exposure ?? 0 }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('Exposure: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        exposure: { value: this.parameters.exposure },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float exposure;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(tDiffuse, vUv);
          gl_FragColor = vec4(tex.rgb * pow(2.0, exposure), tex.a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }

  override _buildPmndrs(reg: PassRegistry): unknown {
    const Effect = reg['ToneMappingEffect'] as (new (...a: unknown[]) => unknown) | undefined
    if (!Effect) throw new Error('Exposure: ToneMappingEffect not found in postprocessing.')
    return new Effect({ exposure: Math.pow(2.0, this.parameters.exposure) })
  }

  override get _isPmndrsEffect(): boolean { return true }
}
