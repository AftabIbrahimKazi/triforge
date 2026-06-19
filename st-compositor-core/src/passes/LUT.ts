import { BasePass } from '../core/BasePass.js'
import type { PassRegistry } from '../core/BasePass.js'

export interface LUTOptions {
  /** Blend intensity — 0 = original, 1 = full LUT. Default 1. */
  intensity?: number
  /**
   * LUT size N (must match the texture supplied later).
   * Neutral LUT for an N³ cube: `LUT.createNeutral(N)`.
   * Default 32.
   */
  lutSize?: number
}

/**
 * LUT — 3-D Look-Up Table colour grading pass.
 * Blender Compositor: Color Balance node (via a baked LUT).
 *
 * Usage:
 * ```typescript
 * const lut = new LUT({ intensity: 1 })
 * comp.add(lut)
 * await comp.compile()
 *
 * // Apply a custom grade — warm highlights + cool shadows
 * lut.setLUT(LUT.createFromFn(32, (r, g, b) => [
 *   r * 1.1 + b * 0.05,
 *   g,
 *   b * 1.1 + r * 0.02,
 * ]))
 * ```
 *
 * The LUT texture is a Data3DTexture (Three.js r137+).
 * Use `LUT.createNeutral(N)` for a passthrough LUT, then modify the data.
 * Use `LUT.createFromFn(N, fn)` to build from a mapping function.
 */
export class LUT extends BasePass {
  readonly passType = 'LUT'
  parameters: { intensity: number; lutSize: number }

  /** The Three.js Data3DTexture (or null until setLUT() is called). */
  lutTexture: unknown = null

  private _pass: unknown = null

  constructor(opts: LUTOptions = {}) {
    super()
    this.parameters = {
      intensity: opts.intensity ?? 1,
      lutSize:   opts.lutSize   ?? 32,
    }
  }

  _threePassDeps() { return ['ShaderPass'] }

  _buildThree(_w: number, _h: number, reg: PassRegistry): unknown {
    const ShaderPass = reg['ShaderPass'] as (new (s: unknown) => unknown) | undefined
    if (!ShaderPass) throw new Error('LUT: ShaderPass not found.')

    const shader = {
      uniforms: {
        tDiffuse:  { value: null },
        lut3d:     { value: this.lutTexture ?? null },
        intensity: { value: this.parameters.intensity },
        lutSize:   { value: this.parameters.lutSize },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        precision highp float;
        precision highp sampler3D;
        uniform sampler2D tDiffuse;
        uniform sampler3D lut3d;
        uniform float     intensity;
        uniform float     lutSize;
        varying vec2 vUv;

        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          if (intensity < 0.001 || lutSize < 2.0) { gl_FragColor = base; return; }
          // Scale to [0.5/N, 1-0.5/N] to hit texel centres
          float scale  = (lutSize - 1.0) / lutSize;
          float offset = 0.5 / lutSize;
          vec3  coord  = clamp(base.rgb, 0.0, 1.0) * scale + offset;
          vec4  graded = texture(lut3d, coord);
          gl_FragColor = vec4(mix(base.rgb, graded.rgb, intensity), base.a);
        }
      `,
    }

    this._pass = new ShaderPass(shader)
    return this._pass
  }

  /**
   * Replace the active LUT texture at runtime.
   * Pass a Three.js Data3DTexture — see `LUT.createNeutral` / `LUT.createFromFn`.
   */
  setLUT(tex: unknown): void {
    this.lutTexture = tex
    if (this._pass) {
      const uniforms = (this._pass as Record<string, unknown>)['uniforms'] as Record<string, { value: unknown }> | undefined
      if (uniforms?.['lut3d']) uniforms['lut3d'].value = tex
    }
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /**
   * Create a neutral (identity) N³ LUT Data3DTexture.
   * Requires a Three.js instance — pass in the THREE namespace.
   */
  static createNeutral(THREE: Record<string, unknown>, N = 32): unknown {
    const data = new Uint8Array(N * N * N * 4)
    for (let b = 0; b < N; b++) {
      for (let g = 0; g < N; g++) {
        for (let r = 0; r < N; r++) {
          const i = (b * N * N + g * N + r) * 4
          data[i]     = Math.round(r / (N - 1) * 255)
          data[i + 1] = Math.round(g / (N - 1) * 255)
          data[i + 2] = Math.round(b / (N - 1) * 255)
          data[i + 3] = 255
        }
      }
    }
    return LUT._makeData3DTexture(THREE, data, N)
  }

  /**
   * Create a Data3DTexture from a mapping function `(r,g,b) => [r,g,b]`
   * where all channels are in [0, 1].
   */
  static createFromFn(
    THREE: Record<string, unknown>,
    N: number,
    fn: (r: number, g: number, b: number) => [number, number, number],
  ): unknown {
    const data = new Uint8Array(N * N * N * 4)
    for (let b = 0; b < N; b++) {
      for (let g = 0; g < N; g++) {
        for (let r = 0; r < N; r++) {
          const [or, og, ob] = fn(r / (N - 1), g / (N - 1), b / (N - 1))
          const i = (b * N * N + g * N + r) * 4
          data[i]     = Math.round(Math.max(0, Math.min(1, or)) * 255)
          data[i + 1] = Math.round(Math.max(0, Math.min(1, og)) * 255)
          data[i + 2] = Math.round(Math.max(0, Math.min(1, ob)) * 255)
          data[i + 3] = 255
        }
      }
    }
    return LUT._makeData3DTexture(THREE, data, N)
  }

  private static _makeData3DTexture(THREE: Record<string, unknown>, data: Uint8Array, N: number): unknown {
    const Cls = THREE['Data3DTexture'] as (new (d: Uint8Array, w: number, h: number, d2: number) => unknown) | undefined
    if (!Cls) throw new Error('LUT: THREE.Data3DTexture not available (requires Three.js r137+).')
    const tex = new Cls(data, N, N, N)
    const texObj = tex as Record<string, unknown>
    texObj['minFilter'] = 1006   // LinearFilter
    texObj['magFilter'] = 1006
    texObj['unpackAlignment'] = 1
    texObj['needsUpdate'] = true
    return tex
  }
}
