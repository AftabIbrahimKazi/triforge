import {
  Points, BufferGeometry, BufferAttribute,
  PointsMaterial, AdditiveBlending, NormalBlending, Texture, Color,
} from 'three'
import { BaseRenderer }  from '../core/BaseRenderer.js'
import type { ParticleLike } from '../core/BaseRenderer.js'
import type { SeededRandom } from '../core/SeededRandom.js'

export interface BillboardRendererOptions {
  /** Maximum visible particles — must match or exceed ParticleSystem.count */
  maxCount?:   number
  /** Base particle colour */
  color?:      string | number
  /** Sprite texture — if omitted renders as solid circle */
  map?:        Texture | null
  /** Opacity 0–1 */
  opacity?:    number
  /** Use additive blending (good for fire/sparks/foam glow) */
  additive?:   boolean
  /** Fade out over lifetime: multiply opacity by (1 - normalised) */
  fadeOut?:    boolean
  /** Scale size by distance (THREE.Points sizeAttenuation) */
  sizeAttenuation?: boolean
  /**
   * Show the point-sprite helper geometry on startup.
   * Mirrors Blender's viewport dot display — set false to hide placeholders
   * and show only the assigned render object. Default: true.
   */
  showHelpers?: boolean
  /** Colour mode: 0=flat, 1=by velocity, 2=by age (Blender: Display Colour) */
  colourMode?: number
  /** Low-speed / young colour RGB components [0–1] */
  colourLow?: [number, number, number]
  /** High-speed / old colour RGB components [0–1] */
  colourHigh?: [number, number, number]
  /** Velocity magnitude that maps to colourHigh in mode 1 */
  velocityMax?: number
}

/**
 * BillboardRenderer — renders particles as camera-facing point sprites.
 * Uses THREE.Points for GPU-efficient batched rendering.
 * (Blender: Render → Halo / Billboard)
 *
 * No allocations inside update() — all buffers are pre-allocated.
 */
export class BillboardRenderer extends BaseRenderer {
  readonly object3D: Points

  /**
   * Scalar inputs — safe to animate with GSAP or the keyframe system.
   * fadeOut: 1 = shrink+fade over lifetime, 0 = constant size.
   * opacity: overall alpha [0–1].
   * size: base world-space point size.
   * colourMode: 0=flat, 1=by velocity, 2=by age.
   */
  parameters: {
    fadeOut: number; opacity: number; size: number
    colourMode: number
    colourLowR: number; colourLowG: number; colourLowB: number
    colourHighR: number; colourHighG: number; colourHighB: number
    velocityMax: number
  }

  private _positions: Float32Array
  private _sizes:     Float32Array
  private _colors:    Float32Array
  private _posAttr:   BufferAttribute
  private _sizeAttr:  BufferAttribute
  private _colorAttr: BufferAttribute
  private _maxCount:  number

  constructor(opts: BillboardRendererOptions = {}) {
    super()
    const max = opts.maxCount ?? 10000
    this._maxCount = max

    const low  = opts.colourLow  ?? [1, 0, 0]
    const high = opts.colourHigh ?? [0, 0, 1]

    this.parameters = {
      fadeOut:  (opts.fadeOut ?? true) ? 1 : 0,
      opacity:  opts.opacity ?? 1,
      size:     0.5,
      colourMode:  opts.colourMode ?? 0,
      colourLowR:  low[0],  colourLowG:  low[1],  colourLowB:  low[2],
      colourHighR: high[0], colourHighG: high[1], colourHighB: high[2],
      velocityMax: opts.velocityMax ?? 10,
    }

    this._positions = new Float32Array(max * 3)
    this._sizes     = new Float32Array(max)
    this._colors    = new Float32Array(max * 3)

    const geo = new BufferGeometry()
    this._posAttr   = new BufferAttribute(this._positions, 3).setUsage(35048) // DYNAMIC_DRAW
    this._sizeAttr  = new BufferAttribute(this._sizes,     1).setUsage(35048)
    this._colorAttr = new BufferAttribute(this._colors,    3).setUsage(35048)
    geo.setAttribute('position', this._posAttr)
    geo.setAttribute('size',     this._sizeAttr)
    geo.setAttribute('color',    this._colorAttr)
    geo.setDrawRange(0, 0)

    const mat = new PointsMaterial({
      color:           new Color(opts.color ?? 0xffffff),
      map:             opts.map  ?? null,
      opacity:         this.parameters.opacity,
      transparent:     true,
      depthWrite:      false,
      blending:        opts.additive ? AdditiveBlending : NormalBlending,
      sizeAttenuation: opts.sizeAttenuation ?? true,
      size:            0.5,   // world-space size — updated each frame from particle pool
      alphaTest:       0.01,
    })

    this.object3D = new Points(geo, mat)
    this.object3D.frustumCulled = false
    this.object3D.visible = opts.showHelpers ?? true

    // Pre-allocate draw buffer for child expansion
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

    const pr      = this.parameters
    const fadeOut = pr.fadeOut >= 0.5
    const mode    = Math.round(pr.colourMode)
    let avgSize   = 0

    for (let i = 0; i < drawCount; i++) {
      const p  = this._drawBuf[i]
      const i3 = i * 3
      this._positions[i3]     = p.position.x
      this._positions[i3 + 1] = p.position.y
      this._positions[i3 + 2] = p.position.z
      const s = p.size * (fadeOut ? 1 - p.normalised : 1)
      this._sizes[i] = s
      avgSize += s

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
        this._colors[i3]     = pr.colourLowR + (pr.colourHighR - pr.colourLowR) * t
        this._colors[i3 + 1] = pr.colourLowG + (pr.colourHighG - pr.colourLowG) * t
        this._colors[i3 + 2] = pr.colourLowB + (pr.colourHighB - pr.colourLowB) * t
      }
    }

    const mat = this.object3D.material as PointsMaterial
    mat.opacity      = pr.opacity
    mat.vertexColors = mode > 0

    if (drawCount > 0) mat.size = avgSize / drawCount

    this._posAttr.needsUpdate   = true
    this._sizeAttr.needsUpdate  = true
    if (mode > 0) this._colorAttr.needsUpdate = true
    ;(this.object3D.geometry as BufferGeometry).setDrawRange(0, drawCount)
  }

  dispose(): void {
    this.object3D.geometry.dispose()
    ;(this.object3D.material as PointsMaterial).dispose()
  }
}
