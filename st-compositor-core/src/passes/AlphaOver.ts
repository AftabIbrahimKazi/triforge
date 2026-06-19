import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface AlphaOverOptions {
  /** Background colour as hex string. Default '#000000'. Blender: Alpha Over → Background */
  background?: string
  /** Blend premultiplied alpha. Default false. Blender: Alpha Over → Convert Premul */
  premul?: boolean
  /** Overall mix factor [0–1]. Default 1.0. */
  fac?: number
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ]
}

/**
 * AlphaOver — Blender Compositor: Alpha Over node.
 *
 * Composites the current render over a solid background colour using
 * the render's alpha channel (standard over operation).
 * A = current render (foreground), B = background colour.
 * Result = A.rgb * A.a + B.rgb * (1 - A.a)
 */
export class AlphaOver extends BasePass {
  readonly passType = 'AlphaOver'
  parameters: { fac: number; bgR: number; bgG: number; bgB: number; premul: number }

  constructor(opts: AlphaOverOptions = {}) {
    super()
    const [bgR, bgG, bgB] = hexToRgb(opts.background ?? '#000000')
    this.parameters = {
      fac:   opts.fac    ?? 1.0,
      bgR,   bgG,   bgB,
      premul: opts.premul ? 1 : 0,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('AlphaOver: ShaderPass not found.')
    const { fac, bgR, bgG, bgB, premul } = this.parameters
    const shader = {
      uniforms: {
        tDiffuse:  { value: null },
        fac:       { value: fac },
        bgColor:   { value: [bgR, bgG, bgB] },
        premul:    { value: premul },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float fac;
        uniform vec3 bgColor;
        uniform float premul;
        varying vec2 vUv;
        void main(){
          vec4 fg = texture2D(tDiffuse, vUv);
          vec3 fgRgb = premul > 0.5 ? fg.rgb : fg.rgb * fg.a;
          vec3 result = mix(bgColor, fgRgb + bgColor*(1.0-fg.a), fac);
          gl_FragColor = vec4(result, 1.0);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
