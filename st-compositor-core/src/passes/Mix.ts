import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface MixOptions {
  /** Blend factor [0–1]. 0 = pass A only, 1 = pass B only. Default 0.5. Blender: Mix → Fac */
  fac?: number
}

/**
 * Mix — Blender Compositor: Mix node.
 *
 * Blends the current compositor output with a saved texture snapshot.
 * In practice this wraps a simple alpha-blend shader over the render target.
 * For full A/B compositing, use two separate CompositorOutput chains.
 */
export class Mix extends BasePass {
  readonly passType = 'Mix'
  parameters: { fac: number }

  constructor(opts: MixOptions = {}) {
    super()
    this.parameters = { fac: opts.fac ?? 0.5 }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('Mix: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        fac:      { value: this.parameters.fac },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float fac;
        varying vec2 vUv;
        void main() {
          vec4 col = texture2D(tDiffuse, vUv);
          gl_FragColor = vec4(col.rgb, col.a * (1.0 - fac) + fac);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
