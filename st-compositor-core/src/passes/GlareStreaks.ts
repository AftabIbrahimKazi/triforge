import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface GlareStreaksOptions {
  /** Luminance threshold — pixels below this don't streak. Blender: Glare → Threshold. Default 0.8. */
  threshold?: number
  /** Streak intensity. Blender: Glare → Strength. Default 1.0. */
  strength?: number
  /** Number of streak directions (2=cross, 4=star, 6=asterisk). Blender: Streaks. Default 4. */
  streaks?: number
  /** Length of each streak in passes. Default 6. */
  length?: number
  /** Angle offset for streak directions in radians. Default 0. */
  angle?: number
  /** Colour fade per pass (attenuation). Default 0.9. */
  fade?: number
}

/**
 * GlareStreaks — anamorphic lens streak effect on bright areas.
 * Blender Compositor: Glare node (Streaks type).
 *
 * Builds bright streaks along N evenly-spaced directions by iterative
 * texture sampling passes in each direction.
 */
export class GlareStreaks extends BasePass {
  readonly passType = 'GlareStreaks'
  parameters: { threshold: number; strength: number; streaks: number; length: number; angle: number; fade: number }

  constructor(opts: GlareStreaksOptions = {}) {
    super()
    this.parameters = {
      threshold: opts.threshold ?? 0.8,
      strength:  opts.strength  ?? 1.0,
      streaks:   opts.streaks   ?? 4,
      length:    opts.length    ?? 6,
      angle:     opts.angle     ?? 0,
      fade:      opts.fade      ?? 0.9,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass'] as (new (s: unknown) => unknown) | undefined
    if (!ShaderPass) throw new Error('GlareStreaks: ShaderPass not found.')

    const { threshold, strength, streaks, length, angle, fade } = this.parameters

    // Build direction vectors for each streak
    const dirs: string[] = []
    for (let i = 0; i < streaks; i++) {
      const a = angle + (i / streaks) * Math.PI
      dirs.push(`vec2(${Math.cos(a).toFixed(6)}, ${Math.sin(a).toFixed(6)})`)
    }

    const shader = {
      uniforms: {
        tDiffuse:   { value: null },
        resolution: { value: [1920, 1080] },
        threshold:  { value: threshold },
        strength:   { value: strength },
        fade:       { value: fade },
        length:     { value: length },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float threshold;
        uniform float strength;
        uniform float fade;
        uniform float length;
        varying vec2 vUv;

        float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        vec4 sampleStreak(vec2 dir) {
          vec4 acc  = vec4(0.0);
          float att = 1.0;
          vec2 step = dir / resolution;
          for (int i = 1; i <= ${Math.max(1, Math.round(length))}; i++) {
            vec2 uv   = vUv + step * float(i) * strength;
            vec4 samp = texture2D(tDiffuse, clamp(uv, 0.0, 1.0));
            float lum = luminance(samp.rgb);
            if (lum > threshold) acc += samp * att;
            att *= fade;
          }
          return acc;
        }

        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec4 glare = vec4(0.0);
          ${dirs.map(d => `glare += sampleStreak(${d});`).join('\n          ')}
          gl_FragColor = base + glare * (1.0 / ${Math.max(1, streaks)}.0);
        }
      `,
    }

    return new ShaderPass(shader)
  }
}
