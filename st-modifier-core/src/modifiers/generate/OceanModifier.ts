import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'
import { noise3 as valueNoise3 } from '../../utils/noise.js'

interface WaveComponent {
  amp:   number
  dx:    number
  dz:    number
  k:     number
  omega: number
  phase: number
}

// Raw evaluation result — foam computed in pass 2 after height range is known
interface EvalResult {
  x: number; y: number; z: number
  nx: number; ny: number; nz: number
  dispY: number   // raw vertical displacement, used for crest detection
  steep: number   // steepness from Jacobian, used for foam streak width
}

export interface OceanModifierOptions {
  /** Animation time in seconds. Increment each frame for animated ocean. */
  time?:         number
  /** Dominant wave wavelength in Three.js units. Scale=3 → waves 3 units long. */
  scale?:        number
  /** Gerstner horizontal displacement. 0 = pure sine, 1 = choppy, >1.5 = folding. */
  choppiness?:   number
  /** Wind speed — scales wave amplitude. Higher = bigger waves. */
  windSpeed?:    number
  /** Wind direction in degrees. 0 = along +X axis. */
  windAngle?:    number
  /** Grid vertices per side. Default: 32. Higher = more detail but slower. */
  resolution?:   number
  /** World-space grid size in Three.js units. */
  size?:         number
  /** Water depth — shallower values slow short waves (tanh dispersion). Default: 200. */
  depth?:        number
  /** Foam coverage — how aggressively crests produce foam [0-1]. Default: 0.2. */
  foamCoverage?: number
  /** Random seed — same seed always produces the same wave pattern. */
  seed?:         number
  /** Wave direction spreading [0-1]. 0 = all waves aligned with wind. */
  damping?:      number
  /** Number of Gerstner wave components. More = richer surface. Default: 24. */
  waveCount?:    number
  /**
   * Turbulence — adds value-noise perturbation on top of Gerstner waves.
   * Breaks up the repeating sine pattern, especially visible when scale changes.
   * 0 = disabled (pure Gerstner), 0.3 = moderate, 1.0 = heavy chaos.
   */
  turbulence?:   number
}

/**
 * Ocean Modifier — Blender "Ocean" modifier equivalent.
 *
 * Generates a flat grid displaced by physically-based Gerstner wave simulation
 * with a Phillips-inspired spectral distribution.
 * Ignores the input geometry — always generates its own grid.
 *
 * Two-pass foam computation:
 *   Pass 1: evaluate all Gerstner displacements, record height range
 *   Pass 2: foam = crest fraction × steepness — produces thin streaks at
 *           wave tips rather than broad blobs from the Jacobian alone.
 *
 * Turbulence parameter adds seeded value-noise on top of Gerstner waves,
 * breaking up the regular periodic pattern at any scale setting.
 *
 * Writes a `foam` Float32BufferAttribute. Use OceanAttribute node to read it.
 */
export class OceanModifier extends BaseModifier {
  get name() { return 'Ocean' }

  parameters: Record<string, number>

  private _waves:    WaveComponent[] = []
  private _waveHash: number          = NaN

  constructor(options: OceanModifierOptions = {}) {
    super()
    this.parameters = {
      time:         options.time         ?? 0.0,
      scale:        options.scale        ?? 3.0,
      choppiness:   options.choppiness   ?? 1.2,
      windSpeed:    options.windSpeed    ?? 30.0,
      windAngle:    options.windAngle    ?? 20.0,
      resolution:   options.resolution   ?? 32,
      size:         options.size         ?? 1.0,
      depth:        options.depth        ?? 200.0,
      foamCoverage: options.foamCoverage ?? 0.2,
      seed:         options.seed         ?? 55,
      damping:      options.damping      ?? 0.5,
      waveCount:    options.waveCount    ?? 24,
      turbulence:   options.turbulence   ?? 0.15,
    }
  }

  apply(_geometry: BufferGeometry): BufferGeometry {
    const res  = Math.max(2, Math.min(256, Math.round(this.parameters.resolution)))
    const size = this.parameters.size

    this._ensureWaves()

    const vCount = res * res

    // ── Pass 1: evaluate all displacements, track height range ─────────────
    const evals = new Array<EvalResult>(vCount)
    let yMin =  Infinity
    let yMax = -Infinity

    for (let zi = 0; zi < res; zi++) {
      for (let xi = 0; xi < res; xi++) {
        const vi = zi * res + xi
        const u  = xi / (res - 1)
        const v  = zi / (res - 1)
        const r  = this._evaluate((u - 0.5) * size, (v - 0.5) * size)
        evals[vi] = r
        if (r.dispY < yMin) yMin = r.dispY
        if (r.dispY > yMax) yMax = r.dispY
      }
    }

    // ── Pass 2: fill buffers + compute crest-based foam ─────────────────────
    const yRange   = Math.max(0.001, yMax - yMin)
    const coverage = Math.max(0, Math.min(1, this.parameters.foamCoverage))

    const pos    = new Float32Array(vCount * 3)
    const norm   = new Float32Array(vCount * 3)
    const uv     = new Float32Array(vCount * 2)
    const foam   = new Float32Array(vCount)

    for (let zi = 0; zi < res; zi++) {
      for (let xi = 0; xi < res; xi++) {
        const vi = zi * res + xi
        const r  = evals[vi]
        const u  = xi / (res - 1)
        const v  = zi / (res - 1)

        pos[vi*3]   = r.x;  pos[vi*3+1] = r.y;  pos[vi*3+2] = r.z
        norm[vi*3]  = r.nx; norm[vi*3+1] = r.ny; norm[vi*3+2] = r.nz
        uv[vi*2]    = u;    uv[vi*2+1]  = v

        // ── Crest-based foam ────────────────────────────────────────────────
        const height      = (r.dispY - yMin) / yRange
        const threshold   = 1.0 - coverage
        const crestFrac   = Math.max(0, (height - threshold) / Math.max(0.001, coverage))
        const smoothCrest = crestFrac * crestFrac * (3 - 2 * crestFrac)
        const steep       = Math.min(1, r.steep * 1.5)

        foam[vi] = Math.min(1, smoothCrest * Math.sqrt(steep))
      }
    }

    // ── Index buffer (quads → triangles) ────────────────────────────────────
    const tCount  = (res - 1) * (res - 1) * 6
    const indices = vCount < 65536
      ? new Uint16Array(tCount)
      : new Uint32Array(tCount)
    let ii = 0
    for (let zi = 0; zi < res - 1; zi++) {
      for (let xi = 0; xi < res - 1; xi++) {
        const a = zi * res + xi,     b = zi * res + xi + 1
        const c = (zi+1) * res + xi, d = (zi+1) * res + xi + 1
        indices[ii++] = a; indices[ii++] = c; indices[ii++] = b
        indices[ii++] = b; indices[ii++] = c; indices[ii++] = d
      }
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(pos,  3))
    result.setAttribute('normal',   new BufferAttribute(norm, 3))
    result.setAttribute('uv',       new BufferAttribute(uv,   2))
    result.setAttribute('foam',     new BufferAttribute(foam, 1))
    result.setIndex(new BufferAttribute(indices, 1))
    return result
  }

  // ── Wave cache ──────────────────────────────────────────────────────────────

  private _ensureWaves(): void {
    const h = this.parameters.seed        * 1e6
            + this.parameters.scale       * 1e4
            + this.parameters.windSpeed   * 1e2
            + this.parameters.windAngle   * 10
            + this.parameters.damping     * 1e3
            + this.parameters.depth       * 0.1
            + this.parameters.waveCount
            + this.parameters.size        * 1e2   // size affects quantised wave vectors
    if (h === this._waveHash) return
    this._waveHash = h
    this._waves = this._buildWaves()
  }

  private _buildWaves(): WaveComponent[] {
    const scale     = Math.max(0.01, this.parameters.scale)
    const V         = Math.max(0.1,  this.parameters.windSpeed)
    const windRad   = this.parameters.windAngle * Math.PI / 180
    const damping   = Math.max(0, Math.min(1, this.parameters.damping))
    const waveCount = Math.max(4, Math.min(64, Math.round(this.parameters.waveCount)))
    const L         = Math.max(0.01, this.parameters.size)
    const rng       = new SeededRandom(Math.round(this.parameters.seed))

    const TWO_PI_L  = (2 * Math.PI) / L   // one grid step in wave-number space
    const k0        = (2 * Math.PI) / scale
    const kMin      = k0 / 8
    const kMax      = k0 * 8
    const g_eff     = 0.4
    const depth_n   = Math.max(0.01, this.parameters.depth / scale)

    const waves: WaveComponent[] = []
    const seen = new Set<string>()

    // Try up to 4× waveCount candidates so deduplication doesn't leave us short.
    for (let attempt = 0; attempt < waveCount * 4 && waves.length < waveCount; attempt++) {
      const t = (attempt + 0.5) / waveCount

      // Sample continuous spectral range (same log-spaced sweep as before)
      const k_cont = kMin * Math.pow(kMax / kMin, t % 1.0)

      // Direction with spread (same formula as before — rng call preserved for seed parity)
      const swellFactor = Math.max(0, Math.log(k0 / k_cont) / Math.log(8) + 0.5)
      const baseSpread  = Math.PI * (1 - damping * 0.8)
      const spread      = Math.min(Math.PI * 1.8, baseSpread * (1 + swellFactor * 0.5))
      const angle       = windRad + (rng.next() - 0.5) * spread

      // ── TILING FIX ─────────────────────────────────────────────────────────
      // Project the continuous wave vector onto the integer lattice
      //   k_vec = (2π/L) * (mx, mz)   →   k·dx·L = 2π·mx  (periodic over tile)
      // This guarantees the Gerstner displacement field repeats exactly with
      // period L in both X and Z, so adjacent tiles seam perfectly.
      const mx = Math.round(k_cont * Math.cos(angle) / TWO_PI_L)
      const mz = Math.round(k_cont * Math.sin(angle) / TWO_PI_L)
      if (mx === 0 && mz === 0) continue

      // Skip duplicate wave vectors (same direction + frequency)
      const key = `${mx},${mz}`
      if (seen.has(key)) continue
      seen.add(key)

      const len = Math.sqrt(mx * mx + mz * mz)
      const dx  = mx / len
      const dz  = mz / len
      const kq  = TWO_PI_L * len   // exact quantised wave number

      // Accept only waves that fall within the spectral range
      if (kq < kMin * 0.5 || kq > kMax * 2.0) continue

      const lnRatio       = Math.log(kq / k0)
      const spectralShape = Math.exp(-lnRatio * lnRatio * 0.4)
      const baseAmp       = spectralShape * scale * 0.08 * Math.pow(V / 30, 1.5)
      if (baseAmp < 1e-8) continue

      const dotWind = dx * Math.cos(windRad) + dz * Math.sin(windRad)
      const dirW    = 0.3 + 0.7 * Math.max(0, dotWind)
      const omega   = Math.sqrt(g_eff * kq * Math.tanh(kq * depth_n))

      waves.push({ amp: baseAmp * dirW, dx, dz, k: kq, omega, phase: rng.next() * Math.PI * 2 })
    }

    return waves
  }

  // ── Tileable noise ──────────────────────────────────────────────────────────
  //
  // Maps (x0, z0) onto a 4D torus with periods L in both axes, then projects
  // to two overlapping 3D noise samples that are averaged.
  //
  // Why this works:
  //   cos(2π(x0+L)/L) = cos(2πx0/L + 2π) = cos(2πx0/L)   — x0 and x0+L
  //   sin(2π(x0+L)/L) = sin(2πx0/L + 2π) = sin(2πx0/L)     map to the
  //                                                            SAME point
  // So the noise value is identical at both tile edges — no seam possible.
  //
  // Noise frequency: R = L·noiseScale/(2π) keeps the apparent spatial
  // frequency identical to a flat noiseScale sample over a tile of size L.
  private _tiledNoise(x0: number, z0: number, t: number, L: number, noiseScale: number): number {
    const TWO_PI_L = (2 * Math.PI) / L
    const R  = L * noiseScale / (2 * Math.PI)
    const cx = R * Math.cos(TWO_PI_L * x0)
    const sx = R * Math.sin(TWO_PI_L * x0)
    const cz = R * Math.cos(TWO_PI_L * z0)
    const sz = R * Math.sin(TWO_PI_L * z0)
    // Two 3D projections of the (cx,sx,cz,sz) 4D torus, averaged to reduce
    // the directional bias that any single 3D projection introduces.
    return 0.5 * (valueNoise3(cx + 0.3, sx + 7.1, cz + t * 0.15)
                + valueNoise3(sx + 3.7, cz + 1.4, sz + t * 0.15))
  }

  // ── Per-vertex evaluation ───────────────────────────────────────────────────

  private _evaluate(x0: number, z0: number): EvalResult {
    const t   = this.parameters.time
    const Q   = this.parameters.choppiness * 0.8
    const turb = this.parameters.turbulence

    let dispX = 0, dispY = 0, dispZ = 0
    let Jxx = 0, Jzz = 0, Jxz = 0
    let dydx = 0, dydz = 0

    for (const w of this._waves) {
      const phase = w.k * (w.dx * x0 + w.dz * z0) - w.omega * t + w.phase
      const sinP  = Math.sin(phase)
      const cosP  = Math.cos(phase)

      dispY += w.amp * sinP
      dispX += Q * w.amp * w.dx * cosP
      dispZ += Q * w.amp * w.dz * cosP

      Jxx += Q * w.k * w.amp * w.dx * w.dx * sinP
      Jzz += Q * w.k * w.amp * w.dz * w.dz * sinP
      Jxz += Q * w.k * w.amp * w.dx * w.dz * sinP

      dydx += w.k * w.amp * w.dx * cosP
      dydz += w.k * w.amp * w.dz * cosP
    }

    // ── Turbulence ──────────────────────────────────────────────────────────
    // Y-height perturbation only (no X/Z — those break tiling).
    // Uses _tiledNoise which maps (x0,z0) to a 4D torus so the function is
    // exactly periodic with the tile size in both axes → zero seam at any edge.
    if (turb > 0) {
      const L          = this.parameters.size
      const noiseScale = 1.5 / Math.max(0.1, this.parameters.scale)
      const ns         = turb * this.parameters.scale * 0.12
      dispY += ns * this._tiledNoise(x0, z0, t, L, noiseScale)
      const e = 0.02
      dydx += ns * (this._tiledNoise(x0 + e, z0,     t, L, noiseScale)
                  - this._tiledNoise(x0 - e, z0,     t, L, noiseScale)) / (2 * e)
      dydz += ns * (this._tiledNoise(x0,     z0 + e, t, L, noiseScale)
                  - this._tiledNoise(x0,     z0 - e, t, L, noiseScale)) / (2 * e)
    }

    // Jacobian: 1 = flat, <1 = steepening, <0 = breaking
    const J     = (1 - Jxx) * (1 - Jzz) - Jxz * Jxz
    // Steepness: 0 on flat water, 1 where waves are breaking
    const steep = Math.max(0, 1 - J)

    // Normal from gradient
    const nx_ = -dydx, ny_ = 1.0, nz_ = -dydz
    const nl  = Math.sqrt(nx_*nx_ + ny_*ny_ + nz_*nz_) || 1

    return {
      x: x0 + dispX, y: dispY, z: z0 + dispZ,
      nx: nx_/nl, ny: ny_/nl, nz: nz_/nl,
      dispY,
      steep,
    }
  }
}

// ── Seeded LCG random ─────────────────────────────────────────────────────────

class SeededRandom {
  private s: number
  constructor(seed: number) { this.s = seed >>> 0 }
  next(): number {
    this.s = (Math.imul(1664525, this.s) + 1013904223) >>> 0
    return this.s / 4294967296
  }
}

