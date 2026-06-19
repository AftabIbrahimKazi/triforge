import {
  LineSegments, BufferGeometry, BufferAttribute,
  LineBasicMaterial, Color,
} from 'three'
import { BaseRenderer }       from '../core/BaseRenderer.js'
import type { ParticleLike }  from '../core/BaseRenderer.js'
import type { SeededRandom }  from '../core/SeededRandom.js'

export interface LineRendererOptions {
  maxCount?:    number
  color?:       string | number
  /** Length multiplier — line extends velocity.length × scale behind particle */
  lengthScale?: number
  /** Colour mode: 0=flat, 1=by velocity, 2=by age (Blender: Display Colour) */
  colourMode?:  number
  /** Low-speed / young colour RGB components [0–1] */
  colourLow?:   [number, number, number]
  /** High-speed / old colour RGB components [0–1] */
  colourHigh?:  [number, number, number]
  /** Velocity magnitude that maps to colourHigh in mode 1 */
  velocityMax?: number
}

/**
 * LineRenderer — renders each particle as a velocity-aligned line segment.
 * (Blender: Render → Line)
 */
export class LineRenderer extends BaseRenderer {
  readonly object3D: LineSegments

  /**
   * Scalar inputs — safe to animate with GSAP or the keyframe system.
   * lengthScale: line extends velocity × lengthScale behind the particle.
   * opacity: overall alpha [0–1].
   * colourMode: 0=flat, 1=by velocity, 2=by age.
   */
  parameters: {
    lengthScale: number; opacity: number
    colourMode: number
    colourLowR: number; colourLowG: number; colourLowB: number
    colourHighR: number; colourHighG: number; colourHighB: number
    velocityMax: number
  }

  private _positions: Float32Array
  private _colors:    Float32Array   // 2 vertices × 3 components per particle
  private _posAttr:   BufferAttribute
  private _colorAttr: BufferAttribute
  private _maxCount:  number

  constructor(opts: LineRendererOptions = {}) {
    super()
    const max = opts.maxCount ?? 10000
    this._maxCount = max

    const low  = opts.colourLow  ?? [1, 0, 0]
    const high = opts.colourHigh ?? [0, 0, 1]

    this.parameters = {
      lengthScale: opts.lengthScale ?? 0.1,
      opacity:     1,
      colourMode:  opts.colourMode ?? 0,
      colourLowR:  low[0],  colourLowG:  low[1],  colourLowB:  low[2],
      colourHighR: high[0], colourHighG: high[1], colourHighB: high[2],
      velocityMax: opts.velocityMax ?? 10,
    }

    // Each line = 2 vertices × 3 floats
    this._positions = new Float32Array(max * 6)
    this._colors    = new Float32Array(max * 6)   // 2 vertices × RGB
    const geo = new BufferGeometry()
    this._posAttr   = new BufferAttribute(this._positions, 3).setUsage(35048)
    this._colorAttr = new BufferAttribute(this._colors,    3).setUsage(35048)
    geo.setAttribute('position', this._posAttr)
    geo.setAttribute('color',    this._colorAttr)
    geo.setDrawRange(0, 0)

    const mat = new LineBasicMaterial({
      color:       new Color(opts.color ?? 0xffffff),
      transparent: true,
      depthWrite:  false,
    })

    this.object3D = new LineSegments(geo, mat)
    this.object3D.frustumCulled = false

    this._allocDrawBuf(max)
  }

  update(
    particles: ParticleLike[],
    aliveCount: number,
    params?:    Record<string, number>,
    childRng?:  SeededRandom,
  ): void {
    const childCount  = params ? Math.round(Math.max(0, params.childCount  ?? 0)) : 0
    const childType   = params ? Math.round(params.childType   ?? 0) : 0
    const childSpread = params ? (params.childSpread ?? 0.5) : 0.5

    const rawCount = this.expandWithChildren(
      particles, aliveCount, childCount, childType, childSpread,
      childRng ?? null, this._maxCount,
    )

    const displayAmount = params ? Math.min(1, Math.max(0, params.displayAmount ?? 1)) : 1
    const drawCount = displayAmount >= 1 ? rawCount : Math.round(rawCount * displayAmount)

    const pr   = this.parameters
    const ls   = pr.lengthScale
    const mode = Math.round(pr.colourMode)

    for (let i = 0; i < drawCount; i++) {
      const p  = this._drawBuf[i]
      const i6 = i * 6
      // Tail (velocity direction behind particle)
      this._positions[i6]     = p.position.x - p.velocity.x * ls
      this._positions[i6 + 1] = p.position.y - p.velocity.y * ls
      this._positions[i6 + 2] = p.position.z - p.velocity.z * ls
      // Head (current position)
      this._positions[i6 + 3] = p.position.x
      this._positions[i6 + 4] = p.position.y
      this._positions[i6 + 5] = p.position.z

      if (mode > 0) {
        let t: number
        if (mode === 1) {
          const spd = Math.sqrt(
            p.velocity.x * p.velocity.x +
            p.velocity.y * p.velocity.y +
            p.velocity.z * p.velocity.z,
          )
          t = Math.min(1, spd / Math.max(pr.velocityMax, 0.0001))
        } else {
          t = p.normalised
        }
        const r = pr.colourLowR + (pr.colourHighR - pr.colourLowR) * t
        const g = pr.colourLowG + (pr.colourHighG - pr.colourLowG) * t
        const b = pr.colourLowB + (pr.colourHighB - pr.colourLowB) * t
        // Both tail and head vertices get the same colour
        this._colors[i6]     = r; this._colors[i6 + 1] = g; this._colors[i6 + 2] = b
        this._colors[i6 + 3] = r; this._colors[i6 + 4] = g; this._colors[i6 + 5] = b
      }
    }

    const mat = this.object3D.material as LineBasicMaterial
    mat.vertexColors = mode > 0

    this._posAttr.needsUpdate = true
    if (mode > 0) this._colorAttr.needsUpdate = true
    ;(this.object3D.geometry as BufferGeometry).setDrawRange(0, drawCount * 2)
  }

  dispose(): void {
    this.object3D.geometry.dispose()
    ;(this.object3D.material as LineBasicMaterial).dispose()
  }
}
