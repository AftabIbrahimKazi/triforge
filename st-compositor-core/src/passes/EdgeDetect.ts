import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface EdgeDetectOptions {
  /** Edge line thickness in pixels. Default 1. */
  thickness?: number
  /** Edge intensity multiplier. Default 1. */
  strength?: number
  /** Edge colour as hex string. Default '#000000'. */
  color?: string
  /** Mix original image with detected edges [0=edges only, 1=original+edges]. Default 1. */
  mix?: number
}

/**
 * EdgeDetect — Blender Compositor: Filter node (Sobel operator type).
 * Extracts edges from luminance using a Sobel kernel.
 */
export class EdgeDetect extends BasePass {
  readonly passType = 'EdgeDetect'
  parameters: { thickness: number; strength: number; mix: number; r: number; g: number; b: number }

  constructor(opts: EdgeDetectOptions = {}) {
    super()
    const hex = (opts.color ?? '#000000').replace('#', '')
    this.parameters = {
      thickness: opts.thickness ?? 1,
      strength:  opts.strength  ?? 1,
      mix:       opts.mix       ?? 1,
      r: parseInt(hex.substring(0, 2), 16) / 255,
      g: parseInt(hex.substring(2, 4), 16) / 255,
      b: parseInt(hex.substring(4, 6), 16) / 255,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(w: number, h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass'] as (new (s: unknown) => unknown) | undefined
    if (!ShaderPass) throw new Error('EdgeDetect: ShaderPass not found.')

    const { thickness, strength, mix, r, g, b } = this.parameters

    const shader = {
      uniforms: {
        tDiffuse:  { value: null },
        texelSize: { value: [thickness / w, thickness / h] },
        strength:  { value: strength },
        edgeColor: { value: [r, g, b] },
        mix:       { value: mix },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2  texelSize;
        uniform float strength;
        uniform vec3  edgeColor;
        uniform float mix;
        varying vec2 vUv;

        float lum(vec2 uv) {
          vec3 c = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
          return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
          vec2 t = texelSize;
          // Sobel X and Y kernels
          float gx = -lum(vUv + vec2(-t.x,  t.y)) + lum(vUv + vec2( t.x,  t.y))
                   - 2.0 * lum(vUv + vec2(-t.x, 0.0)) + 2.0 * lum(vUv + vec2( t.x, 0.0))
                   - lum(vUv + vec2(-t.x, -t.y)) + lum(vUv + vec2( t.x, -t.y));
          float gy = -lum(vUv + vec2(-t.x,  t.y)) - 2.0 * lum(vUv + vec2(0.0,  t.y)) - lum(vUv + vec2( t.x,  t.y))
                   +  lum(vUv + vec2(-t.x, -t.y)) + 2.0 * lum(vUv + vec2(0.0, -t.y)) + lum(vUv + vec2( t.x, -t.y));
          float edge = clamp(sqrt(gx*gx + gy*gy) * strength, 0.0, 1.0);

          vec4 base = texture2D(tDiffuse, vUv);
          vec3 out_  = base.rgb * mix + edgeColor * edge * (1.0 - mix * (1.0 - edge));
          gl_FragColor = vec4(out_, base.a);
        }
      `,
    }

    return new ShaderPass(shader)
  }
}
