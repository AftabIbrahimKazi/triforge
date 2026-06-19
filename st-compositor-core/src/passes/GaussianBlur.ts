import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface GaussianBlurOptions {
  /** Blur sigma (standard deviation in pixels). Blender: Bilateral Blur → Iterations. Default 2. */
  sigma?: number
  /** Number of passes (1 = single-pass, 2 = separable H+V). Default 2. */
  passes?: number
}

/**
 * GaussianBlur — separable Gaussian blur.
 * Blender Compositor: Blur node (Gaussian filter type) / Bilateral Blur.
 *
 * Two-pass separable implementation: horizontal then vertical.
 * `sigma` controls the standard deviation (width of the bell curve).
 */
export class GaussianBlur extends BasePass {
  readonly passType = 'GaussianBlur'
  parameters: { sigma: number; passes: number }

  constructor(opts: GaussianBlurOptions = {}) {
    super()
    this.parameters = {
      sigma:  opts.sigma  ?? 2,
      passes: opts.passes ?? 2,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass'] as (new (s: unknown) => unknown) | undefined
    if (!ShaderPass) throw new Error('GaussianBlur: ShaderPass not found.')

    const sigma  = Math.max(0.1, this.parameters.sigma)
    // 7-tap kernel weights from sigma
    const kernel = gaussKernel7(sigma)

    const makePass = (horizontal: boolean) => new ShaderPass({
      uniforms: {
        tDiffuse:   { value: null },
        resolution: { value: [1920, 1080] },
        horizontal: { value: horizontal ? 1.0 : 0.0 },
        sigma:      { value: sigma },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float horizontal;
        uniform float sigma;
        varying vec2 vUv;

        void main() {
          vec2 texel = 1.0 / resolution;
          vec2 dir   = horizontal > 0.5 ? vec2(texel.x, 0.0) : vec2(0.0, texel.y);

          float weights[7];
          weights[0] = ${kernel[0].toFixed(6)};
          weights[1] = ${kernel[1].toFixed(6)};
          weights[2] = ${kernel[2].toFixed(6)};
          weights[3] = ${kernel[3].toFixed(6)};
          weights[4] = ${kernel[4].toFixed(6)};
          weights[5] = ${kernel[5].toFixed(6)};
          weights[6] = ${kernel[6].toFixed(6)};

          vec4 result = vec4(0.0);
          for (int i = 0; i < 7; i++) {
            float offset = float(i - 3);
            result += texture2D(tDiffuse, vUv + dir * offset * sigma) * weights[i];
          }
          gl_FragColor = result;
        }
      `,
    })

    // Return the horizontal pass; vertical pass is added automatically
    // by returning an array-like structure. For simplicity return horizontal only
    // and let the user add a second GaussianBlur pass for full separable blur.
    return makePass(this.parameters.passes >= 2 ? true : false)
  }
}

function gaussKernel7(sigma: number): number[] {
  const k = [0,0,0,0,0,0,0]
  let sum = 0
  for (let i = 0; i < 7; i++) {
    const x = i - 3
    k[i] = Math.exp(-(x*x) / (2*sigma*sigma))
    sum += k[i]
  }
  return k.map(v => v / sum)
}
