import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface MotionBlurOptions {
  /** Number of accumulation samples. Higher = smoother but slower. Default 8. */
  samples?: number
  /**
   * Velocity scale — how far samples are spread from the velocity vector.
   * Blender: Vector Blur → Speed. Default 1.0.
   */
  velocityScale?: number
  /**
   * Maximum blur radius in pixels. Clamps per-pixel blur length.
   * Default 20.
   */
  maxRadius?: number
}

/**
 * MotionBlur — screen-space radial/directional motion blur.
 * Blender Compositor: Vector Blur node.
 *
 * Screen-space approximation: samples radially from screen centre,
 * simulating camera shake / fast-pan motion blur.
 * For true per-object motion blur, a velocity buffer is required
 * (beyond single-pass EffectComposer scope — this is a visual approximation).
 */
export class MotionBlur extends BasePass {
  readonly passType = 'MotionBlur'
  parameters: { samples: number; velocityScale: number; maxRadius: number }

  constructor(opts: MotionBlurOptions = {}) {
    super()
    this.parameters = {
      samples:       opts.samples       ?? 8,
      velocityScale: opts.velocityScale ?? 1.0,
      maxRadius:     opts.maxRadius     ?? 20,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass'] as (new (s: unknown) => unknown) | undefined
    if (!ShaderPass) throw new Error('MotionBlur: ShaderPass not found.')

    const { samples, velocityScale, maxRadius } = this.parameters
    const n = Math.max(1, Math.round(samples))

    const shader = {
      uniforms: {
        tDiffuse:      { value: null },
        resolution:    { value: [1920, 1080] },
        velocityScale: { value: velocityScale },
        maxRadius:     { value: maxRadius },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float velocityScale;
        uniform float maxRadius;
        varying vec2 vUv;

        void main() {
          // Screen-space radial blur toward centre
          vec2 centre = vec2(0.5);
          vec2 vel    = (centre - vUv) * velocityScale;
          float len   = length(vel * resolution);
          if (len > maxRadius) vel = vel * (maxRadius / max(len, 0.001));

          vec4 acc = vec4(0.0);
          for (int i = 0; i < ${n}; i++) {
            float t  = float(i) / float(${n - 1});
            vec2  uv = clamp(vUv + vel * t / resolution, 0.0, 1.0);
            acc += texture2D(tDiffuse, uv);
          }
          gl_FragColor = acc / float(${n});
        }
      `,
    }

    return new ShaderPass(shader)
  }
}
