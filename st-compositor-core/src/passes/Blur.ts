import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface BlurOptions {
  /** Blur radius in pixels. Default 4. Blender: Blur node → Size */
  radius?: number
  /** Horizontal blur amount multiplier [0–1]. Default 1. */
  x?: number
  /** Vertical blur amount multiplier [0–1]. Default 1. */
  y?: number
}

/** Blur — Blender Compositor: Blur node */
export class Blur extends BasePass {
  readonly passType = 'Blur'
  parameters: { radius: number; x: number; y: number }

  constructor(opts: BlurOptions = {}) {
    super()
    this.parameters = {
      radius: opts.radius ?? 4,
      x:      opts.x      ?? 1,
      y:      opts.y      ?? 1,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('Blur: ShaderPass not found in three/addons.')

    const r  = this.parameters.radius
    const px = (1 / 1920) * r * this.parameters.x
    const py = (1 / 1080) * r * this.parameters.y

    const BlurShader = {
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: [1920, 1080] },
        blurX: { value: px },
        blurY: { value: py },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float blurX;
        uniform float blurY;
        varying vec2 vUv;
        void main() {
          vec4 sum = vec4(0.0);
          sum += texture2D(tDiffuse, vec2(vUv.x - 4.0*blurX, vUv.y - 4.0*blurY)) * 0.051;
          sum += texture2D(tDiffuse, vec2(vUv.x - 3.0*blurX, vUv.y - 3.0*blurY)) * 0.0918;
          sum += texture2D(tDiffuse, vec2(vUv.x - 2.0*blurX, vUv.y - 2.0*blurY)) * 0.12245;
          sum += texture2D(tDiffuse, vec2(vUv.x - 1.0*blurX, vUv.y - 1.0*blurY)) * 0.1531;
          sum += texture2D(tDiffuse, vUv)                                          * 0.1633;
          sum += texture2D(tDiffuse, vec2(vUv.x + 1.0*blurX, vUv.y + 1.0*blurY)) * 0.1531;
          sum += texture2D(tDiffuse, vec2(vUv.x + 2.0*blurX, vUv.y + 2.0*blurY)) * 0.12245;
          sum += texture2D(tDiffuse, vec2(vUv.x + 3.0*blurX, vUv.y + 3.0*blurY)) * 0.0918;
          sum += texture2D(tDiffuse, vec2(vUv.x + 4.0*blurX, vUv.y + 4.0*blurY)) * 0.051;
          gl_FragColor = sum;
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(BlurShader)
  }
}
