import {
  Group, LineSegments, LineBasicMaterial,
  BufferGeometry, BufferAttribute,
  MeshBasicMaterial, Mesh, TubeGeometry, CatmullRomCurve3, Vector3,
} from 'three'
import { BaseRenderer }     from '../core/BaseRenderer.js'
import type { ParticleLike } from '../core/BaseRenderer.js'
import type { SeededRandom } from '../core/SeededRandom.js'

/** Source geometry with optional vertex-group float attributes. */
export interface StrandSourceGeometry {
  getAttribute(name: string): { getX(i: number): number } | undefined
}

export type StrandCurveFn = (
  particle: ParticleLike,
  t: number,           // 0 = root, 1 = tip
  index: number,       // particle pool index
) => { x: number; y: number; z: number }

export type StrandRenderMode = 'line' | 'tube'

export interface StrandRendererOptions {
  /**
   * Maximum number of live strands. Default 1000.
   * Set to the particle system's `count` for best results.
   */
  maxCount?: number

  /**
   * Number of segments per strand. Default 8.
   * More segments = smoother curves, higher GPU cost.
   */
  segments?: number

  /**
   * Strand cross-section radius for 'tube' mode. Default 0.02.
   * Blender: Hair Shape → Diameter Root
   */
  thickness?: number

  /**
   * Tip taper factor [0–1]. 1 = uniform, 0 = taper to point. Default 0.5.
   * Blender: Hair Shape → Taper
   */
  taper?: number

  /**
   * How strands are rendered.
   * 'line' (default) — fast LineSegments, thickness controlled by material.
   * 'tube'           — mesh tube, supports lighting. Heavier, best for hero strands.
   */
  mode?: StrandRenderMode

  /**
   * Function that returns a world-space point along the strand at normalised t ∈ [0,1].
   * t=0 = root (particle position), t=1 = tip.
   *
   * Default: straight strand drooping 1 world unit downward along gravity.
   *
   * To connect with st-hair-core:
   *   const gen = new StrandGenerator({ ... })
   *   renderer = new StrandRenderer({
   *     strandCurve: (p, t) => gen.evaluateAt(p.position, p.velocity, t)
   *   })
   */
  strandCurve?: StrandCurveFn

  /** Material for the strands. Default: white LineBasicMaterial or MeshBasicMaterial. */
  material?: LineBasicMaterial | MeshBasicMaterial

  /**
   * Source geometry to read vertex-group float attributes from.
   * The particle's `poolIdx` is used as the vertex index.
   * Blender: Vertex Groups → Strand panel.
   */
  sourceGeometry?: StrandSourceGeometry

  /**
   * Name of a float vertex attribute on `sourceGeometry` whose value [0–1]
   * scales each strand's length multiplier. 0 = no strand, 1 = full length.
   * Blender: Vertex Groups → Length.
   */
  lengthAttribute?: string

  /**
   * Name of a float vertex attribute on `sourceGeometry` whose value [0–1]
   * offsets the strand root toward the emitter surface centre (clumping).
   * Blender: Vertex Groups → Clump.
   */
  clumpAttribute?: string

  /**
   * Name of a float vertex attribute on `sourceGeometry` whose value [0–1]
   * scales the kink amplitude for this strand.
   * Blender: Vertex Groups → Roughness.
   */
  roughnessAttribute?: string

  /**
   * Viewport display fraction [0–1]. Default 1 (show all).
   * 0.5 shows 50% of strands in the viewport without affecting simulation.
   * Blender: Display panel → Display Amount.
   */
  displayAmount?: number

  /**
   * Optional callback that returns the world-space tangent direction at
   * a normalised position t along the strand.
   * Used to drive anisotropic shading in tube mode (e.g. PrincipledHair node).
   *
   * @example
   * // Connect with st-hair-core StrandGenerator
   * const gen = new StrandGenerator({ ... })
   * new StrandRenderer({
   *   tangentFn: (particle, t) => gen.tangentAt(particle.position, particle.velocity, t)
   * })
   */
  tangentFn?: (particle: ParticleLike, t: number) => { x: number; y: number; z: number }
}

/**
 * StrandRenderer — Blender: Hair / Path render type on a particle system.
 *
 * Renders each alive particle as a strand (hair, grass, fur).
 * The strand shape is defined by a `strandCurve` callback — this allows
 * integration with st-hair-core's StrandGenerator without a hard import.
 *
 * Usage:
 * ```typescript
 * const renderer = new StrandRenderer({
 *   maxCount: 500,
 *   segments: 8,
 *   strandCurve: (p, t) => ({
 *     x: p.position.x,
 *     y: p.position.y + t * 0.3,
 *     z: p.position.z,
 *   })
 * })
 * sys.setRenderer(renderer)
 * scene.add(renderer.object3D)
 * ```
 *
 * To use st-hair-core strand shapes, pass a generator callback:
 * ```typescript
 * // Outside st-particle-core — no import restriction applies here
 * import { StrandGenerator } from 'st-hair-core'
 * const gen = new StrandGenerator({ length: 0.4, gravity: 0.3 })
 * const renderer = new StrandRenderer({
 *   strandCurve: (p, t) => gen.samplePoint(p.position, p.velocity, t)
 * })
 * ```
 */
export class StrandRenderer extends BaseRenderer {
  parameters: Record<string, number>
  readonly object3D: Group

  private readonly _segments:           number
  private readonly _maxCount:           number
  private readonly _mode:               StrandRenderMode
  private readonly _strandCurve:        StrandCurveFn
  private readonly _material:           LineBasicMaterial | MeshBasicMaterial
  private readonly _sourceGeo:          StrandSourceGeometry | null
  private readonly _lengthAttrName:     string | null
  private readonly _clumpAttrName:      string | null
  private readonly _roughnessAttrName:  string | null
  private readonly _tangentFn:          StrandRendererOptions['tangentFn'] | null

  // Line mode geometry — one pre-allocated geometry updated in place
  private _lineGeo:  BufferGeometry | null = null
  private _lineSegs: LineSegments   | null = null
  private _linePosArr: Float32Array | null = null

  // Tube mode — one Mesh per strand, pooled
  private _tubeMeshes:  Mesh[]           = []
  private _tubeInScene: boolean[]        = []

  constructor(opts: StrandRendererOptions = {}) {
    super()
    this._maxCount          = opts.maxCount  ?? 1000
    this._segments          = opts.segments  ?? 8
    this._mode              = opts.mode      ?? 'line'
    this._strandCurve       = opts.strandCurve ?? StrandRenderer._defaultCurve
    this._sourceGeo         = opts.sourceGeometry ?? null
    this._lengthAttrName    = opts.lengthAttribute    ?? null
    this._clumpAttrName     = opts.clumpAttribute     ?? null
    this._roughnessAttrName = opts.roughnessAttribute ?? null
    this._tangentFn         = opts.tangentFn          ?? null
    this._material    = opts.material ?? (
      this._mode === 'tube'
        ? new MeshBasicMaterial({ color: 0xccaa77 })
        : new LineBasicMaterial({ color: 0xccaa77 })
    )

    this._allocDrawBuf(this._maxCount)
    this.object3D = new Group()

    this.parameters = {
      thickness:        opts.thickness        ?? 0.02,
      taper:            opts.taper            ?? 0.5,
      segments:         this._segments,
      kinkAmplitude:    0,    // wave displacement — Blender: Kink → Amplitude
      kinkFrequency:    1,    // waves per strand  — Blender: Kink → Frequency
      densityThreshold: 0,    // skip strands where particle.size < this value
      displayAmount:    opts.displayAmount ?? 1.0,  // fraction of strands shown [0–1]
    }

    if (this._mode === 'line') {
      this._initLineGeometry()
    } else {
      this._initTubePool()
    }
  }

  update(
    particles:  ParticleLike[],
    aliveCount: number,
    params?:    Record<string, number>,
    childRng?:  SeededRandom,
  ): void {
    const n = this.expandWithChildren(
      particles, aliveCount,
      params?.childCount  ?? 0,
      params?.childType   ?? 0,
      params?.childSpread ?? 0.5,
      childRng ?? null,
      this._maxCount,
    )

    if (this._mode === 'line') {
      this._updateLine(n)
    } else {
      this._updateTubes(n)
    }
  }

  dispose(): void {
    this._lineGeo?.dispose()
    this._material.dispose()
    for (const m of this._tubeMeshes) m.geometry.dispose()
  }

  // ── Line mode ─────────────────────────────────────────────────────────────

  private _initLineGeometry(): void {
    // Each strand = _segments segments = _segments+1 points = _segments*2 line endpoints
    const pointsPerStrand = this._segments + 1
    const totalPoints     = this._maxCount * pointsPerStrand
    this._linePosArr = new Float32Array(totalPoints * 3)
    this._lineGeo    = new BufferGeometry()
    this._lineGeo.setAttribute('position', new BufferAttribute(this._linePosArr, 3))
    // Build index: pairs of consecutive points per strand
    const indices: number[] = []
    for (let s = 0; s < this._maxCount; s++) {
      const base = s * pointsPerStrand
      for (let seg = 0; seg < this._segments; seg++) {
        indices.push(base + seg, base + seg + 1)
      }
    }
    this._lineGeo.setIndex(indices)
    this._lineSegs = new LineSegments(this._lineGeo, this._material as LineBasicMaterial)
    this.object3D.add(this._lineSegs)
  }

  private _updateLine(count: number): void {
    const arr         = this._linePosArr!
    const segs        = this._segments
    const pps         = segs + 1  // points per strand
    const threshold   = this.parameters.densityThreshold
    const displayMax  = Math.round(count * Math.max(0, Math.min(1, this.parameters.displayAmount)))

    for (let i = 0; i < count; i++) {
      const d    = this._drawBuf[i]
      const base = i * pps * 3

      // Skip beyond displayAmount or low-weight strands
      if (i >= displayMax || (threshold > 0 && d.size < threshold)) {
        for (let j = 0; j < pps * 3; j++) arr[base + j] = 0
        continue
      }

      const lengthScale    = this._attrVal(this._lengthAttrName,    d.poolIdx)
      const clumpScale     = this._attrVal(this._clumpAttrName,     d.poolIdx)
      const roughnessScale = this._attrVal(this._roughnessAttrName, d.poolIdx)
      const kinkAmp        = this.parameters.kinkAmplitude * roughnessScale
      const kinkFreq       = this.parameters.kinkFrequency

      for (let j = 0; j <= segs; j++) {
        const t      = (j / segs) * lengthScale
        const pt     = this._strandCurve(d, t, d.poolIdx)
        const kink   = kinkAmp > 0 ? Math.sin(t * kinkFreq * Math.PI * 2) * kinkAmp * t : 0
        const clumpX = (d.position.x - pt.x) * (1 - clumpScale)
        const clumpZ = (d.position.z - pt.z) * (1 - clumpScale)
        const off    = base + j * 3
        arr[off]     = pt.x + kink + clumpX
        arr[off + 1] = pt.y
        arr[off + 2] = pt.z + kink * 0.5 + clumpZ
      }
    }

    // Zero out unused strands
    for (let i = count; i < this._maxCount; i++) {
      const base = i * pps * 3
      for (let j = 0; j < pps * 3; j++) arr[base + j] = 0
    }

    this._lineGeo!.getAttribute('position').needsUpdate = true
    this._lineGeo!.computeBoundingSphere()
  }

  // ── Tube mode ─────────────────────────────────────────────────────────────

  private _initTubePool(): void {
    for (let i = 0; i < this._maxCount; i++) {
      // Placeholder geometry — replaced each update
      const geo  = new BufferGeometry()
      const mesh = new Mesh(geo, this._material as MeshBasicMaterial)
      mesh.visible = false
      this._tubeMeshes.push(mesh)
      this._tubeInScene.push(false)
      this.object3D.add(mesh)
    }
  }

  private _updateTubes(count: number): void {
    const segs       = this._segments
    const thickness  = this.parameters.thickness
    const taper      = this.parameters.taper
    const threshold  = this.parameters.densityThreshold
    const displayMax = Math.round(count * Math.max(0, Math.min(1, this.parameters.displayAmount)))

    for (let i = 0; i < count; i++) {
      const d    = this._drawBuf[i]
      const mesh = this._tubeMeshes[i]

      if (i >= displayMax || (threshold > 0 && d.size < threshold)) {
        mesh.visible = false
        continue
      }

      const lengthScale    = this._attrVal(this._lengthAttrName,    d.poolIdx)
      const clumpScale     = this._attrVal(this._clumpAttrName,     d.poolIdx)
      const roughnessScale = this._attrVal(this._roughnessAttrName, d.poolIdx)
      const kinkAmp        = this.parameters.kinkAmplitude * roughnessScale
      const kinkFreq       = this.parameters.kinkFrequency

      const pts: Vector3[] = []
      for (let j = 0; j <= segs; j++) {
        const t      = (j / segs) * lengthScale
        const pt     = this._strandCurve(d, t, d.poolIdx)
        const kink   = kinkAmp > 0 ? Math.sin(t * kinkFreq * Math.PI * 2) * kinkAmp * t : 0
        const clumpX = (d.position.x - pt.x) * (1 - clumpScale)
        const clumpZ = (d.position.z - pt.z) * (1 - clumpScale)
        pts.push(new Vector3(pt.x + kink + clumpX, pt.y, pt.z + kink * 0.5 + clumpZ))
      }

      // Build tube geometry along the curve
      const curve      = new CatmullRomCurve3(pts)
      const radiusFn   = (t: number) => thickness * (1 - t * (1 - taper))
      const tubeRadius = thickness  // TubeGeometry doesn't support per-point radius
      void radiusFn

      mesh.geometry.dispose()
      const geo = new TubeGeometry(curve, segs, tubeRadius * taper, 4, false)

      // Bake tangent attribute for anisotropic shading (PrincipledHair / HairInfo node)
      if (this._tangentFn) {
        const vtxCount = geo.attributes.position.count
        const tangents = new Float32Array(vtxCount * 3)
        for (let vi = 0; vi < vtxCount; vi++) {
          const t  = (vi / vtxCount)
          const tv = this._tangentFn(d, t)
          tangents[vi*3]   = tv.x
          tangents[vi*3+1] = tv.y
          tangents[vi*3+2] = tv.z
        }
        geo.setAttribute('strandTangent', new BufferAttribute(tangents, 3))
      }

      mesh.geometry = geo
      mesh.visible  = true
    }

    // Hide unused
    for (let i = count; i < this._maxCount; i++) {
      this._tubeMeshes[i].visible = false
    }
  }

  // ── Vertex group attribute helpers ───────────────────────────────────────

  /** Read a float attribute value at vertex index `vi`; returns 1 if unavailable. */
  private _attrVal(attrName: string | null, vi: number): number {
    if (!attrName || !this._sourceGeo) return 1
    const attr = this._sourceGeo.getAttribute(attrName)
    if (!attr) return 1
    return attr.getX(vi)
  }

  // ── Default strand curve ──────────────────────────────────────────────────

  private static _defaultCurve: StrandCurveFn = (p, t) => ({
    x: p.position.x,
    y: p.position.y + t * p.size * 5,   // strand grows upward from particle
    z: p.position.z,
  })
}
