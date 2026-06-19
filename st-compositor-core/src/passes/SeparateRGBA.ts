import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export type RGBAChannel = 0 | 1 | 2 | 3

export interface SeparateRGBAOptions {
  /**
   * Which channel to extract and display as greyscale.
   * 0 = R, 1 = G, 2 = B, 3 = A. Default 0. Blender: Separate RGBA → R/G/B/A socket.
   */
  channel?: RGBAChannel
}

/**
 * SeparateRGBA — Blender Compositor: Separate RGBA node.
 *
 * Extracts a single channel (R, G, B, or A) and displays it as
 * a greyscale image. Use to inspect individual channels of the render.
 *
 * Changing `parameters.channel` at runtime swaps the extracted channel
 * without recompiling — channel 0=R 1=G 2=B 3=A.
 */
export class SeparateRGBA extends BasePass {
  readonly passType = 'SeparateRGBA'
  parameters: { channel: number }

  constructor(opts: SeparateRGBAOptions = {}) {
    super()
    this.parameters = { channel: opts.channel ?? 0 }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('SeparateRGBA: ShaderPass not found.')
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        channel:  { value: this.parameters.channel },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float channel;
        varying vec2 vUv;
        void main(){
          vec4 col = texture2D(tDiffuse, vUv);
          float v;
          if      (channel < 0.5) v = col.r;
          else if (channel < 1.5) v = col.g;
          else if (channel < 2.5) v = col.b;
          else                    v = col.a;
          gl_FragColor = vec4(v, v, v, 1.0);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
