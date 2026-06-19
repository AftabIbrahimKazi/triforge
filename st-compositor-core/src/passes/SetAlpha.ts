import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface SetAlphaOptions {
  /** Alpha value to set [0–1]. Default 1.0. Blender: Set Alpha → Alpha */
  alpha?: number
}

/**
 * SetAlpha — Blender Compositor: Set Alpha node.
 * Sets the alpha channel of the render to a constant value.
 * Useful for compositing transparent elements.
 */
export class SetAlpha extends BasePass {
  readonly passType = 'SetAlpha'
  parameters: { alpha: number }

  constructor(opts: SetAlphaOptions = {}) {
    super()
    this.parameters = { alpha: opts.alpha ?? 1.0 }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('SetAlpha: ShaderPass not found.')
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        alpha:    { value: this.parameters.alpha },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float alpha;
        varying vec2 vUv;
        void main(){
          vec4 col = texture2D(tDiffuse, vUv);
          gl_FragColor = vec4(col.rgb, alpha);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
