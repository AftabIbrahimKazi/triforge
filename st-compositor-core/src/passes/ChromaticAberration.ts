import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface ChromaticAberrationOptions {
  /** RGB channel offset amount. Default 0.005. Blender: Lens Distortion → Dispersion */
  offset?: number
  /** Radial falloff — 0 = uniform, 1 = edge only. Default 0.5. */
  radialModulation?: number
}

/** ChromaticAberration — Blender Compositor: Lens Distortion node (Dispersion) */
export class ChromaticAberration extends BasePass {
  readonly passType = 'ChromaticAberration'
  parameters: { offset: number; radialModulation: number }

  constructor(opts: ChromaticAberrationOptions = {}) {
    super()
    this.parameters = {
      offset:            opts.offset            ?? 0.005,
      radialModulation:  opts.radialModulation  ?? 0.5,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('ChromaticAberration: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        offset:   { value: this.parameters.offset },
        radMod:   { value: this.parameters.radialModulation },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float radMod;
        varying vec2 vUv;
        void main() {
          vec2 dir = vUv - 0.5;
          float dist = length(dir) * radMod + (1.0 - radMod);
          vec2 o = normalize(dir) * offset * dist;
          float r = texture2D(tDiffuse, vUv - o).r;
          float g = texture2D(tDiffuse, vUv     ).g;
          float b = texture2D(tDiffuse, vUv + o).b;
          float a = texture2D(tDiffuse, vUv     ).a;
          gl_FragColor = vec4(r, g, b, a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }

  override _buildPmndrs(reg: PassRegistry): unknown {
    const Effect = reg['ChromaticAberrationEffect'] as (new (...a: unknown[]) => unknown) | undefined
    if (!Effect) throw new Error('ChromaticAberration: ChromaticAberrationEffect not found in postprocessing.')
    return new Effect({ offset: this.parameters.offset })
  }

  override get _isPmndrsEffect(): boolean { return true }
}
