import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface SharpenOptions {
  /** Sharpen intensity [0–1]. Default 0.5. Blender: Filter → Sharpen */
  intensity?: number
}

/** Sharpen — Blender Compositor: Filter node (Sharpen) */
export class Sharpen extends BasePass {
  readonly passType = 'Sharpen'
  parameters: { intensity: number }

  constructor(opts: SharpenOptions = {}) {
    super()
    this.parameters = { intensity: opts.intensity ?? 0.5 }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('Sharpen: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse:  { value: null },
        intensity: { value: this.parameters.intensity },
        texSize:   { value: [1 / _width, 1 / _height] },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float intensity;
        uniform vec2 texSize;
        varying vec2 vUv;
        void main() {
          vec4 center = texture2D(tDiffuse, vUv);
          vec4 n = texture2D(tDiffuse, vUv + vec2( 0.0,  texSize.y));
          vec4 s = texture2D(tDiffuse, vUv + vec2( 0.0, -texSize.y));
          vec4 e = texture2D(tDiffuse, vUv + vec2( texSize.x, 0.0));
          vec4 w = texture2D(tDiffuse, vUv + vec2(-texSize.x, 0.0));
          vec4 sharp = center * (1.0 + 4.0 * intensity) - (n + s + e + w) * intensity;
          gl_FragColor = vec4(clamp(sharp.rgb, 0.0, 1.0), center.a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
