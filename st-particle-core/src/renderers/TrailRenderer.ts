import {
  LineSegments, BufferGeometry, Float32BufferAttribute,
  LineBasicMaterial, Color,
} from 'three'
import { BaseRenderer }      from '../core/BaseRenderer.js'
import type { ParticleLike } from '../core/BaseRenderer.js'
import type { SeededRandom } from '../core/SeededRandom.js'

export interface TrailRendererOptions {
  /**
   * Maximum number of particles supported. Default 1000.
   * Must match or exceed ParticleSystem.count.
   */
  maxCount?:    number
  /**
   * Number of trail segments per particle (2–64). Default 8.
   * (Blender: Render → Path → B-Spline / Steps)
   */
  trailLength?: number
  /**
   * Fade trail opacity from head to tail. Default true.
   * (Blender: Render → Path → Fade)
   */
  fadeOut?:     boolean
  /** Trail colour. Default white. */
  colour?:      [number, number, number]
}

/**
 * TrailRenderer — each alive particle leaves a visible history trail.
 * (Blender: Render → Path)
 *
 * Maintains a circular position buffer per particle.
 * Renders as a single THREE.LineSegments object — no allocations inside update().
 */
export class TrailRenderer extends BaseRenderer {
  readonly object3D: LineSegments

  /**
   * Scalar inputs — GSAP / keyframe compatible.
   * trailLength: segment count per particle (2–64).
   * fadeOut:     1 = fade head→tail, 0 = uniform opacity.
   * colourR/G/B: trail colour components.
   */
  parameters: Record<string, number>

  private readonly _geo:      BufferGeometry
  private readonly _positions: Float32Array
  private readonly _colors:    Float32Array

  // Circular position history buffer: [particleIdx][segmentIdx] → { x, y, z }
  private readonly _history:  Float32Array   // maxCount × maxSeg × 3
  private readonly _head:     Int32Array     // per-particle write cursor
  private readonly _filled:   Uint8Array     // per-particle fill flag (0|1)

  private _maxCount: number
  private _maxSeg:   number

  constructor(opts: TrailRendererOptions = {}) {
    super()
    const max    = opts.maxCount    ?? 1000
    const seg    = Math.max(2, Math.min(64, opts.trailLength ?? 8))
    const colour = opts.colour ?? [1, 1, 1]

    this._maxCount = max
    this._maxSeg   = seg

    this.parameters = {
      trailLength: seg,
      fadeOut:     (opts.fadeOut ?? true) ? 1 : 0,
      colourR:     colour[0],
      colourG:     colour[1],
      colourB:     colour[2],
    }

    // Each trail segment is a line: 2 verts × 3 floats
    // Worst case: maxCount particles × (seg-1) segments × 2 verts
    const maxLines = max * (seg - 1)
    this._positions = new Float32Array(maxLines * 2 * 3)
    this._colors    = new Float32Array(maxLines * 2 * 3)

    this._geo = new BufferGeometry()
    this._geo.setAttribute('position', new Float32BufferAttribute(this._positions, 3).setUsage(35048)) // DYNAMIC_DRAW
    this._geo.setAttribute('color',    new Float32BufferAttribute(this._colors,    3).setUsage(35048))
    this._geo.setDrawRange(0, 0)

    const mat = new LineBasicMaterial({ vertexColors: true })
    this.object3D = new LineSegments(this._geo, mat)
    this.object3D.frustumCulled = false

    this._history = new Float32Array(max * seg * 3)
    this._head    = new Int32Array(max)
    this._filled  = new Uint8Array(max)

    this._allocDrawBuf(max)
  }

  update(
    particles: ParticleLike[],
    _aliveCount: number,
    _params?:   Record<string, number>,
    _childRng?: SeededRandom,
  ): void {
    const seg     = Math.max(2, Math.min(64, Math.round(this.parameters.trailLength)))
    const fadeOut = this.parameters.fadeOut >= 0.5
    const cr      = this.parameters.colourR
    const cg      = this.parameters.colourG
    const cb      = this.parameters.colourB

    let lineVert = 0  // write cursor into _positions/_colors

    for (let pi = 0; pi < particles.length && pi < this._maxCount; pi++) {
      const p = particles[pi]

      if (!p.alive) {
        // Always clear history when dead so the trail doesn't linger after revival
        this._filled[pi] = 0
        this._head[pi]   = 0
        continue
      }

      // Push current position into circular history buffer
      const head    = this._head[pi]
      const base    = pi * this._maxSeg * 3
      const hBase   = head * 3
      this._history[base + hBase]     = p.position.x
      this._history[base + hBase + 1] = p.position.y
      this._history[base + hBase + 2] = p.position.z

      this._head[pi]   = (head + 1) % seg
      if (this._filled[pi] === 0 && this._head[pi] === 0) this._filled[pi] = 1

      // Determine how many history slots are actually valid
      const validSlots = this._filled[pi] ? seg : head + 1
      if (validSlots < 2) continue
      if (lineVert + (validSlots - 1) * 6 > this._positions.length) break

      // Write (validSlots-1) line segments from oldest to newest
      // Oldest slot: if filled, it's _head[pi] (the slot we just overwrote next)
      const startSlot = this._filled[pi] ? this._head[pi] : 0

      for (let si = 0; si < validSlots - 1; si++) {
        const s0 = (startSlot + si)     % seg
        const s1 = (startSlot + si + 1) % seg
        const b0 = base + s0 * 3
        const b1 = base + s1 * 3

        this._positions[lineVert]     = this._history[b0]
        this._positions[lineVert + 1] = this._history[b0 + 1]
        this._positions[lineVert + 2] = this._history[b0 + 2]

        this._positions[lineVert + 3] = this._history[b1]
        this._positions[lineVert + 4] = this._history[b1 + 1]
        this._positions[lineVert + 5] = this._history[b1 + 2]

        // Fade: t=0 at tail (oldest), t=1 at head (newest)
        const t0 = fadeOut ? si / (validSlots - 1)       : 1
        const t1 = fadeOut ? (si + 1) / (validSlots - 1) : 1

        this._colors[lineVert]     = cr * t0
        this._colors[lineVert + 1] = cg * t0
        this._colors[lineVert + 2] = cb * t0
        this._colors[lineVert + 3] = cr * t1
        this._colors[lineVert + 4] = cg * t1
        this._colors[lineVert + 5] = cb * t1

        lineVert += 6
      }
    }

    this._geo.setDrawRange(0, lineVert / 3)
    this._geo.attributes['position'].needsUpdate = true
    this._geo.attributes['color'].needsUpdate    = true
  }

  /** Clear all trail history — call when resetting the simulation. */
  clearHistory(): void {
    this._history.fill(0)
    this._head.fill(0)
    this._filled.fill(0)
  }

  dispose(): void {
    this._geo.dispose()
    ;(this.object3D.material as LineBasicMaterial).dispose()
  }
}
