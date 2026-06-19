import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface ColorBalanceOptions {
  /** Lift (shadows) offset [-1, 1] per channel. Default 0. Blender: Color Balance → Lift */
  liftR?: number; liftG?: number; liftB?: number
  /** Gamma (midtones) [0.01, 10]. Default 1. Blender: Color Balance → Gamma */
  gammaR?: number; gammaG?: number; gammaB?: number
  /** Gain (highlights) [0, 4]. Default 1. Blender: Color Balance → Gain */
  gainR?: number; gainG?: number; gainB?: number
  /** Blend factor [0–1]. Default 1. */
  fac?: number
}

/** ColorBalance — Blender Compositor: Color Balance node */
export class ColorBalance extends BasePass {
  readonly passType = 'ColorBalance'
  parameters: {
    liftR: number; liftG: number; liftB: number
    gammaR: number; gammaG: number; gammaB: number
    gainR: number; gainG: number; gainB: number
    fac: number
  }

  constructor(opts: ColorBalanceOptions = {}) {
    super()
    this.parameters = {
      liftR:  opts.liftR  ?? 0, liftG:  opts.liftG  ?? 0, liftB:  opts.liftB  ?? 0,
      gammaR: opts.gammaR ?? 1, gammaG: opts.gammaG ?? 1, gammaB: opts.gammaB ?? 1,
      gainR:  opts.gainR  ?? 1, gainG:  opts.gainG  ?? 1, gainB:  opts.gainB  ?? 1,
      fac:    opts.fac    ?? 1,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('ColorBalance: ShaderPass not found in three/addons.')

    const p = this.parameters
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        lift:  { value: [p.liftR,  p.liftG,  p.liftB]  },
        gamma: { value: [p.gammaR, p.gammaG, p.gammaB] },
        gain:  { value: [p.gainR,  p.gainG,  p.gainB]  },
        fac:   { value: p.fac },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 lift;
        uniform vec3 gamma;
        uniform vec3 gain;
        uniform float fac;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(tDiffuse, vUv);
          // ASC CDL: out = pow(clamp(in * gain + lift, 0, 1), 1/gamma)
          vec3 g = max(gamma, vec3(0.0001));
          vec3 col = pow(clamp(tex.rgb * gain + lift, vec3(0.0), vec3(1.0)), vec3(1.0) / g);
          gl_FragColor = vec4(mix(tex.rgb, col, fac), tex.a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
