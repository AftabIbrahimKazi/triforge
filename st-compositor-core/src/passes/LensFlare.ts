import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface LensFlareOptions {
  /** Number of flare ghosts. Default 6. */
  ghosts?: number
  /** Overall flare intensity. Default 0.5. */
  strength?: number
  /** Luminance threshold — only bright pixels generate flares. Default 0.9. */
  threshold?: number
  /** Halo size as fraction of screen width. Default 0.4. */
  haloWidth?: number
  /** Chromatic dispersion amount for ghost colouring [0–1]. Default 0.5. */
  chromatic?: number
}

/**
 * LensFlare — Blender Compositor: Lens Flare / Glare node (lens reflections type).
 *
 * Simulates camera lens flare: bright highlight ghosts reflected along the
 * screen diagonal and a halo ring around bright sources.
 */
export class LensFlare extends BasePass {
  readonly passType = 'LensFlare'
  parameters: { ghosts: number; strength: number; threshold: number; haloWidth: number; chromatic: number }

  constructor(opts: LensFlareOptions = {}) {
    super()
    this.parameters = {
      ghosts:    opts.ghosts    ?? 6,
      strength:  opts.strength  ?? 0.5,
      threshold: opts.threshold ?? 0.9,
      haloWidth: opts.haloWidth ?? 0.4,
      chromatic: opts.chromatic ?? 0.5,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass'] as (new (s: unknown) => unknown) | undefined
    if (!ShaderPass) throw new Error('LensFlare: ShaderPass not found.')

    const { ghosts, strength, threshold, haloWidth, chromatic } = this.parameters
    const n = Math.max(1, Math.round(ghosts))

    const shader = {
      uniforms: {
        tDiffuse:  { value: null },
        strength:  { value: strength },
        threshold: { value: threshold },
        haloWidth: { value: haloWidth },
        chromatic: { value: chromatic },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float strength;
        uniform float threshold;
        uniform float haloWidth;
        uniform float chromatic;
        varying vec2 vUv;

        float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        vec3 sampleChromatic(vec2 uv, vec2 offset) {
          vec2 r = clamp(uv + offset * (1.0 + chromatic * 0.1), 0.0, 1.0);
          vec2 b = clamp(uv + offset * (1.0 - chromatic * 0.1), 0.0, 1.0);
          return vec3(
            texture2D(tDiffuse, r).r,
            texture2D(tDiffuse, clamp(uv + offset, 0.0, 1.0)).g,
            texture2D(tDiffuse, b).b
          );
        }

        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 flare = vec3(0.0);
          vec2 ghost = vec2(0.5) - vUv;  // vector to screen centre

          // Ghost reflections along the screen diagonal
          for (int i = 1; i <= ${n}; i++) {
            float fi    = float(i);
            float disp  = 0.3 + fi * 0.25;
            vec2  guv   = vUv + ghost * disp;
            vec3  samp  = sampleChromatic(guv, ghost * 0.01 * fi);
            float lum   = luminance(samp);
            if (lum > threshold) {
              vec3 tint = mix(vec3(1.0, 0.8, 0.6), vec3(0.6, 0.8, 1.0), fract(fi * 0.37));
              flare += samp * tint * (lum - threshold) * strength / fi;
            }
          }

          // Halo ring
          float dist    = length(ghost);
          float haloBias = abs(dist - haloWidth);
          float halo    = smoothstep(0.05, 0.0, haloBias) * strength * 0.5;
          vec4  haloCentre = texture2D(tDiffuse, clamp(vec2(0.5) + normalize(-ghost) * haloWidth, 0.0, 1.0));
          if (luminance(haloCentre.rgb) > threshold) {
            flare += haloCentre.rgb * halo;
          }

          gl_FragColor = vec4(base.rgb + flare, base.a);
        }
      `,
    }

    return new ShaderPass(shader)
  }
}
