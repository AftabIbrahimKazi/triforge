import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface VignetteOptions {
  /** Vignette darkness [0–1]. Default 0.5. Blender: Lens Distortion → Vignette */
  darkness?: number
  /** Vignette offset — how far from centre the effect starts [0–1]. Default 1.0. */
  offset?: number
}

/** Vignette — Blender Compositor: Lens Distortion node (Vignette) */
export class Vignette extends BasePass {
  readonly passType = 'Vignette'
  parameters: { darkness: number; offset: number }

  constructor(opts: VignetteOptions = {}) {
    super()
    this.parameters = {
      darkness: opts.darkness ?? 0.5,
      offset:   opts.offset   ?? 1.0,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('Vignette: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        darkness: { value: this.parameters.darkness },
        offset:   { value: this.parameters.offset },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float darkness;
        uniform float offset;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float dist  = distance(vUv, vec2(0.5));
          color.rgb  *= smoothstep(0.8, offset * 0.799, dist * (darkness + offset));
          gl_FragColor = color;
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }

  override _buildPmndrs(reg: PassRegistry): unknown {
    const Effect = reg['VignetteEffect'] as (new (...a: unknown[]) => unknown) | undefined
    if (!Effect) throw new Error('Vignette: VignetteEffect not found in postprocessing.')
    return new Effect({ darkness: this.parameters.darkness, offset: this.parameters.offset })
  }

  override get _isPmndrsEffect(): boolean { return true }
}
