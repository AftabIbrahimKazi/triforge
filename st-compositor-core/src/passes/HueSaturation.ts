import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface HueSaturationOptions {
  /** Hue rotation [0–1] where 0.5 = no change. Default 0.5. Blender: Hue/Sat → Hue */
  hue?: number
  /** Saturation multiplier. Default 1. Blender: Hue/Sat → Saturation */
  saturation?: number
  /** Value (brightness) multiplier. Default 1. Blender: Hue/Sat → Value */
  value?: number
  /** Blend factor [0–1]. Default 1. */
  fac?: number
}

/** HueSaturation — Blender Compositor: Hue Saturation Value node */
export class HueSaturation extends BasePass {
  readonly passType = 'HueSaturation'
  parameters: { hue: number; saturation: number; value: number; fac: number }

  constructor(opts: HueSaturationOptions = {}) {
    super()
    this.parameters = {
      hue:        opts.hue        ?? 0.5,
      saturation: opts.saturation ?? 1.0,
      value:      opts.value      ?? 1.0,
      fac:        opts.fac        ?? 1.0,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_width: number, _height: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass']
    if (!ShaderPass) throw new Error('HueSaturation: ShaderPass not found in three/addons.')

    const shader = {
      uniforms: {
        tDiffuse:   { value: null },
        hue:        { value: this.parameters.hue },
        saturation: { value: this.parameters.saturation },
        value:      { value: this.parameters.value },
        fac:        { value: this.parameters.fac },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float hue;
        uniform float saturation;
        uniform float value;
        uniform float fac;
        varying vec2 vUv;

        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
          vec4 p = mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g));
          vec4 q = mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r));
          float d = q.x - min(q.w, q.y);
          return vec3(abs(q.z + (q.w - q.y) / (6.0*d+1e-10)), d/(q.x+1e-10), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0,2.0/3.0,1.0/3.0,3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          vec4 tex = texture2D(tDiffuse, vUv);
          vec3 hsv = rgb2hsv(tex.rgb);
          hsv.x = fract(hsv.x + hue - 0.5);
          hsv.y = clamp(hsv.y * saturation, 0.0, 1.0);
          hsv.z = hsv.z * value;
          gl_FragColor = vec4(mix(tex.rgb, hsv2rgb(hsv), fac), tex.a);
        }
      `,
    }
    return new (ShaderPass as new (s: unknown) => unknown)(shader)
  }
}
