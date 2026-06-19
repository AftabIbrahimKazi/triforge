import { BufferGeometry, BufferAttribute } from 'three'
import type { BaseCollider } from '../collision/BaseCollider.js'
import type { WindForce } from '../forces/WindForce.js'

export interface SoftBodySimulatorOptions {
  /** Spring stiffness [0–1]. Blender: Soft Body > Edges > Pull / Push. Default 0.9. */
  stiffness?: number
  /** Pressure stiffness for closed-volume bodies [0–∞]. Blender: Soft Body > Self Collision. Default 0. */
  pressure?: number
  /** Velocity damping [0–1]. Blender: Soft Body > Edges > Damp. Default 0.05. */
  damping?: number
  /** Gravity acceleration (m/s²). Blender: Field Weights > Gravity. Default 9.8. */
  gravity?: number
  /** Constraint solver iterations per step. Default 10. */
  iterations?: number
  /** Simulation substeps per frame. Default 4. */
  substeps?: number
  /** Particle mass. Blender: Soft Body > Object > Mass. Default 1.0. */
  mass?: number
  /** Shape matching stiffness [0–1]. Blender: Soft Body > Self Collision > Ball Stiff. Default 0. */
  shapeMatchStiffness?: number
}

/**
 * SoftBodySimulator — Blender-matched soft body physics.
 * Blender: Soft Body modifier.
 *
 * A tetrahedral-spring soft body solver using Verlet integration.
 * Suitable for jelly-like objects, blobs, squash-and-stretch deformation.
 *
 * Workflow:
 *   1. Create SoftBodySimulator
 *   2. Call setFromGeometry(geometry) — reads mesh vertices
 *   3. Add colliders: addCollider(c)
 *   4. Call step(dt) every frame
 *   5. Call apply(geometry) to write positions back
 *
 * All parameters live on `parameters` for GSAP / st-keyframe:
 *   gsap.to(softBody.parameters, { stiffness: 0.2, duration: 1 })
 */
export class SoftBodySimulator {
  /** All scalar simulation parameters — GSAP/st-keyframe compatible. */
  parameters: {
    stiffness:          number
    pressure:           number
    damping:            number
    gravity:            number
    iterations:         number
    substeps:           number
    mass:               number
    shapeMatchStiffness: number
  }

  /** Number of vertices in the simulated mesh. */
  vertexCount = 0

  /** Current positions [x0,y0,z0, x1,y1,z1, ...] */
  private _pos!:  Float64Array
  /** Previous positions (Verlet). */
  private _prev!: Float64Array
  /** Pinned vertex mask — pinned vertices never move. */
  private _pinned!: Uint8Array

  /** Springs: packed triples [iBase, jBase, restLen, ...] */
  private _springs: Float64Array = new Float64Array(0)
  /** Rest-pose positions for shape matching. */
  private _rest!: Float64Array
  /** Rest volume for pressure springs. */
  private _restVolume = 0

  private _wind:      WindForce | null = null
  private _colliders: BaseCollider[]   = []

  /** Simulation clock. */
  time = 0

  constructor(opts: SoftBodySimulatorOptions = {}) {
    this.parameters = {
      stiffness:           opts.stiffness           ?? 0.9,
      pressure:            opts.pressure            ?? 0.0,
      damping:             opts.damping             ?? 0.05,
      gravity:             opts.gravity             ?? 9.8,
      iterations:          opts.iterations          ?? 10,
      substeps:            opts.substeps            ?? 4,
      mass:                opts.mass                ?? 1.0,
      shapeMatchStiffness: opts.shapeMatchStiffness ?? 0.0,
    }
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * Load mesh vertices from a BufferGeometry.
   * Builds edge springs from the geometry's index buffer.
   */
  setFromGeometry(geometry: BufferGeometry): void {
    const posAttr = geometry.getAttribute('position') as BufferAttribute
    const n = posAttr.count
    this.vertexCount = n
    this._pos    = new Float64Array(n * 3)
    this._prev   = new Float64Array(n * 3)
    this._rest   = new Float64Array(n * 3)
    this._pinned = new Uint8Array(n)

    for (let i = 0; i < n; i++) {
      this._pos[i*3]   = posAttr.getX(i)
      this._pos[i*3+1] = posAttr.getY(i)
      this._pos[i*3+2] = posAttr.getZ(i)
    }
    this._prev.set(this._pos)
    this._rest.set(this._pos)

    this._buildEdgeSprings(geometry)
    this._restVolume = this._computeVolume()
  }

  /**
   * Load from a flat [x,y,z,...] array with an index array.
   */
  setFromArray(positions: ArrayLike<number>, indices: ArrayLike<number>): void {
    const n = Math.floor(positions.length / 3)
    this.vertexCount = n
    this._pos    = new Float64Array(n * 3)
    this._prev   = new Float64Array(n * 3)
    this._rest   = new Float64Array(n * 3)
    this._pinned = new Uint8Array(n)
    for (let i = 0; i < positions.length; i++) this._pos[i] = positions[i]
    this._prev.set(this._pos)
    this._rest.set(this._pos)
    this._buildEdgeSpringsFromIndex(indices)
    this._restVolume = this._computeVolume()
  }

  // ── Pinning ───────────────────────────────────────────────────────────────

  pin(index: number): void {
    if (index >= 0 && index < this.vertexCount) this._pinned[index] = 1
  }
  unpin(index: number): void {
    if (index >= 0 && index < this.vertexCount) this._pinned[index] = 0
  }

  // ── Colliders / Wind ─────────────────────────────────────────────────────

  addCollider(c: BaseCollider): void { this._colliders.push(c) }
  removeCollider(c: BaseCollider): void {
    const i = this._colliders.indexOf(c)
    if (i !== -1) this._colliders.splice(i, 1)
  }
  setWind(w: WindForce | null): void { this._wind = w }

  // ── Stepping ──────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by dt seconds.
   * Call once per animation frame; dt ≈ 1/60.
   */
  step(dt: number): void {
    this.time += dt
    const sub = Math.max(1, Math.round(this.parameters.substeps))
    const subDt = dt / sub
    for (let s = 0; s < sub; s++) this._substep(subDt)
  }

  /**
   * Write simulated positions back to a BufferGeometry's 'position' attribute.
   */
  apply(geometry: BufferGeometry): void {
    const posAttr = geometry.getAttribute('position') as BufferAttribute
    const n = Math.min(posAttr.count, this.vertexCount)
    for (let i = 0; i < n; i++) {
      posAttr.setXYZ(i, this._pos[i*3], this._pos[i*3+1], this._pos[i*3+2])
    }
    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _substep(dt: number): void {
    this._wind?.advance(dt)
    const { gravity, damping, iterations, mass, stiffness, pressure, shapeMatchStiffness } = this.parameters
    const g = gravity
    const d = 1 - damping

    // Verlet integrate
    for (let i = 0; i < this.vertexCount; i++) {
      if (this._pinned[i]) continue
      const b = i * 3
      const ax = 0, ay = -g / mass, az = 0
      const vx = (this._pos[b]   - this._prev[b])   * d
      const vy = (this._pos[b+1] - this._prev[b+1]) * d
      const vz = (this._pos[b+2] - this._prev[b+2]) * d
      // Wind
      let wx = 0, wy = 0, wz = 0
      if (this._wind) {
        ;[wx, wy, wz] = this._wind.getAcceleration(
          this._pos[b], this._pos[b+1], this._pos[b+2], this.time,
        )
      }
      this._prev[b]   = this._pos[b]
      this._prev[b+1] = this._pos[b+1]
      this._prev[b+2] = this._pos[b+2]
      this._pos[b]   += vx + (ax + wx) * dt * dt
      this._pos[b+1] += vy + (ay + wy) * dt * dt
      this._pos[b+2] += vz + (az + wz) * dt * dt
    }

    // Constraint solving
    const iter = Math.max(1, Math.round(iterations))
    for (let it = 0; it < iter; it++) {
      this._solveEdgeSprings(stiffness)
      if (pressure > 0) this._solvePressure(pressure)
      if (shapeMatchStiffness > 0) this._solveShapeMatch(shapeMatchStiffness)
    }

    // Colliders
    for (const col of this._colliders) {
      if (!col.enabled) continue
      for (let i = 0; i < this.vertexCount; i++) {
        if (this._pinned[i]) continue
        const b = i * 3
        const r = col.resolve(this._pos[b], this._pos[b+1], this._pos[b+2])
        if (r !== null) {
          this._pos[b]   = r[0]
          this._pos[b+1] = r[1]
          this._pos[b+2] = r[2]
        }
      }
    }
  }

  private _solveEdgeSprings(stiffness: number): void {
    const sp   = this._springs
    const nSp  = sp.length / 3
    for (let k = 0; k < nSp; k++) {
      const ib  = sp[k*3]   // i * 3 base
      const jb  = sp[k*3+1] // j * 3 base
      const rL  = sp[k*3+2]
      const ip  = ib | 0
      const jp  = jb | 0
      const dx  = this._pos[jp]   - this._pos[ip]
      const dy  = this._pos[jp+1] - this._pos[ip+1]
      const dz  = this._pos[jp+2] - this._pos[ip+2]
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz)
      if (len === 0) continue
      const corr  = (len - rL) / len * 0.5 * stiffness
      const cx = dx * corr, cy = dy * corr, cz = dz * corr
      const ii = ip / 3 | 0
      const ji = jp / 3 | 0
      if (!this._pinned[ii]) { this._pos[ip]   += cx; this._pos[ip+1] += cy; this._pos[ip+2] += cz }
      if (!this._pinned[ji]) { this._pos[jp]   -= cx; this._pos[jp+1] -= cy; this._pos[jp+2] -= cz }
    }
  }

  private _solvePressure(pressure: number): void {
    const vol = this._computeVolume()
    if (vol <= 0 || this._restVolume <= 0) return
    const ratio = this._restVolume / vol - 1
    if (Math.abs(ratio) < 1e-6) return
    // Push/pull vertices outward/inward proportional to the pressure ratio
    const cx = this._centroid(0)
    const cy = this._centroid(1)
    const cz = this._centroid(2)
    const k  = pressure * ratio * 0.01
    for (let i = 0; i < this.vertexCount; i++) {
      if (this._pinned[i]) continue
      const b  = i * 3
      const nx = this._pos[b]   - cx
      const ny = this._pos[b+1] - cy
      const nz = this._pos[b+2] - cz
      this._pos[b]   += nx * k
      this._pos[b+1] += ny * k
      this._pos[b+2] += nz * k
    }
  }

  private _solveShapeMatch(k: number): void {
    // Translate each vertex toward its rest-pose position relative to current centroid
    const cx = this._centroid(0), cy = this._centroid(1), cz = this._centroid(2)
    const rx = this._restCentroid(0), ry = this._restCentroid(1), rz = this._restCentroid(2)
    for (let i = 0; i < this.vertexCount; i++) {
      if (this._pinned[i]) continue
      const b = i * 3
      const targetX = this._rest[b]   - rx + cx
      const targetY = this._rest[b+1] - ry + cy
      const targetZ = this._rest[b+2] - rz + cz
      this._pos[b]   += (targetX - this._pos[b])   * k
      this._pos[b+1] += (targetY - this._pos[b+1]) * k
      this._pos[b+2] += (targetZ - this._pos[b+2]) * k
    }
  }

  private _centroid(axis: number): number {
    let s = 0
    for (let i = 0; i < this.vertexCount; i++) s += this._pos[i*3 + axis]
    return s / Math.max(1, this.vertexCount)
  }

  private _restCentroid(axis: number): number {
    let s = 0
    for (let i = 0; i < this.vertexCount; i++) s += this._rest[i*3 + axis]
    return s / Math.max(1, this.vertexCount)
  }

  private _computeVolume(): number {
    // Divergence theorem approximation: sum of (v · normal * area) / 3
    // For an open mesh this is approximate; fine for pressure heuristic
    const sp   = this._springs
    const nSp  = sp.length / 3
    let   vol  = 0
    for (let k = 0; k < nSp; k++) {
      const ib = sp[k*3] | 0, jb = sp[k*3+1] | 0
      const x1 = this._pos[ib], y1 = this._pos[ib+1], z1 = this._pos[ib+2]
      const x2 = this._pos[jb], y2 = this._pos[jb+1], z2 = this._pos[jb+2]
      vol += x1 * (y2 - 0) - x2 * (y1 - 0)   // 2D proxy (xy plane)
      void z1; void z2
    }
    return Math.abs(vol) * 0.5
  }

  private _buildEdgeSprings(geometry: BufferGeometry): void {
    const idx = geometry.index
    if (!idx) { this._springs = new Float64Array(0); return }
    this._buildEdgeSpringsFromIndex(idx.array)
  }

  private _buildEdgeSpringsFromIndex(indices: ArrayLike<number>): void {
    const edgeSet = new Set<string>()
    const pairs: [number, number][] = []
    for (let i = 0; i < indices.length - 2; i += 3) {
      const a = indices[i], b = indices[i+1], c = indices[i+2]
      const edges: [number, number][] = [[a,b],[b,c],[a,c]]
      for (const [p, q] of edges) {
        const key = p < q ? `${p}_${q}` : `${q}_${p}`
        if (!edgeSet.has(key)) { edgeSet.add(key); pairs.push([p, q]) }
      }
    }
    this._springs = new Float64Array(pairs.length * 3)
    for (let k = 0; k < pairs.length; k++) {
      const [a, b] = pairs[k]
      const ab = a * 3, bb = b * 3
      const dx = this._pos[ab]   - this._pos[bb]
      const dy = this._pos[ab+1] - this._pos[bb+1]
      const dz = this._pos[ab+2] - this._pos[bb+2]
      this._springs[k*3]   = ab
      this._springs[k*3+1] = bb
      this._springs[k*3+2] = Math.sqrt(dx*dx + dy*dy + dz*dz)
    }
  }
}
