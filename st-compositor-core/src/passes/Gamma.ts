import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface GammaOptions {
  /** Gamma exponent. Default 1.0 (no change). Blender: Gamma → Gamma */
  gamma?: number
}

/** Gamma — Blender Compositor: Gamma node */
export class Gamma extends BasePass {
  readonly passType = 'Gamma'
  parameters: { gamma: number }

  constructor(opts: GammaOptions = {}) {
    super()
    this.parameters = { gamma: opts.gamma ?? 1.0 }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('Gamma: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        gamma:    { value: this.parameters.gamma },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float gamma;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(tDiffuse, vUv);
          float g = max(gamma, 0.0001);
          gl_FragColor = vec4(pow(max(tex.rgb, vec3(0.0)), vec3(1.0 / g)), tex.a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
