import { BufferGeometry, BufferAttribute } from 'three'
import type { BaseCollider } from '../collision/BaseCollider.js'
import type { WindForce } from '../forces/WindForce.js'

export interface ClothSimulatorOptions {
  /** Width vertex count (columns). Default 20. Blender: Quality > Steps U. */
  segmentsX?: number
  /** Height vertex count (rows). Default 20. Blender: Quality > Steps V. */
  segmentsY?: number
  /** Gravity acceleration (m/s²). Blender: Field Weights > Gravity. Default 9.8. */
  gravity?: number
  /** Spring stiffness [0, 1]. Blender: Cloth > Stiffness > Tension. Default 0.8. */
  stiffness?: number
  /** Bending stiffness [0, 1]. Blender: Cloth > Stiffness > Bending. Default 0.2. */
  bending?: number
  /** Velocity damping [0, 1]. Blender: Cloth > Damping > Spring. Default 0.01. */
  damping?: number
  /** Constraint solver iterations per step. Blender: Quality > Steps. Default 8. */
  iterations?: number
  /** Simulation substeps per frame. Higher = more stable. Default 4. */
  substeps?: number
  /** Particle mass. Blender: Cloth > Mass. Default 0.3. */
  mass?: number
  /** Enable self-collision. Blender: Cloth > Self Collision. Default false. */
  selfCollision?: boolean
  /** Minimum distance for self-collision. Default 0.05. */
  selfCollisionDist?: number
  /** Enable pressure/inflation. Blender: Cloth > Pressure. Default false. */
  pressure?: boolean
  /** Pressure factor (outward force along normal). Blender: Cloth > Pressure > Factor. Default 1.0. */
  pressureFactor?: number
}

/**
 * ClothSimulator — Blender-matched cloth physics using Verlet integration.
 * Blender: Cloth modifier.
 *
 * Workflow:
 *   1. Create with segmentsX × segmentsY resolution
 *   2. Pin vertices with `pin(index)` or `pinRow(0)` for a hanging flag
 *   3. Add colliders and wind forces
 *   4. Call `step(dt)` every frame
 *   5. Call `apply()` to write simulated positions to the geometry
 *
 * All simulation parameters live in `parameters` for st-keyframe / GSAP:
 *   new KeyframeTrack(cloth.parameters, 'stiffness', [...])
 */
export class ClothSimulator {
  /** All scalar simulation parameters — GSAP/st-keyframe compatible. */
  parameters: {
    gravity:           number
    stiffness:         number
    bending:           number
    damping:           number
    iterations:        number
    substeps:          number
    mass:              number
    selfCollision:     boolean
    selfCollisionDist: number
    pressure:          boolean
    pressureFactor:    number
  }

  readonly segmentsX: number
  readonly segmentsY: number

  /** Vertex count = (segmentsX+1) × (segmentsY+1). */
  readonly vertexCount: number

  /** Current positions [x0,y0,z0, x1,y1,z1, ...] */
  private _pos: Float64Array
  /** Previous positions (Verlet). */
  private _prev: Float64Array
  /** Pinned vertices do not move. */
  private _pinned: Uint8Array

  /** Spring constraints: [i, j, restLength] */
  private _springs!: Float64Array  // packed: i*3 index, j*3 index, restLen
  /** Triangle index list for pressure, [i0, i1, i2, ...] */
  private _triangles!: Uint32Array

  /** Accumulated wind force pointer (optional). */
  private _wind: WindForce | null = null
  private _colliders: BaseCollider[] = []

  /** Current simulation time. */
  time = 0

  constructor(segmentsX: number, segmentsY: number, opts: ClothSimulatorOptions = {}) {
    this.segmentsX   = segmentsX
    this.segmentsY   = segmentsY
    this.vertexCount = (segmentsX + 1) * (segmentsY + 1)

    this.parameters = {
      gravity:           opts.gravity           ?? 9.8,
      stiffness:         opts.stiffness         ?? 0.8,
      bending:           opts.bending           ?? 0.2,
      damping:           opts.damping           ?? 0.01,
      iterations:        opts.iterations        ?? 8,
      substeps:          opts.substeps          ?? 4,
      mass:              opts.mass              ?? 0.3,
      selfCollision:     opts.selfCollision     ?? false,
      selfCollisionDist: opts.selfCollisionDist ?? 0.05,
      pressure:          opts.pressure          ?? false,
      pressureFactor:    opts.pressureFactor    ?? 1.0,
    }

    // Triangle index list for pressure computation (built from grid quads)
    this._triangles = this._buildTriangles()

    this._pos    = new Float64Array(this.vertexCount * 3)
    this._prev   = new Float64Array(this.vertexCount * 3)
    this._pinned = new Uint8Array(this.vertexCount)

    this._buildSprings()
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * Seed particle positions from a BufferGeometry.
   * Call this once after construction to place the cloth in 3D space.
   */
  setFromGeometry(geometry: BufferGeometry): void {
    const pos = geometry.getAttribute('position') as BufferAttribute
    const n   = Math.min(pos.count, this.vertexCount)
    for (let i = 0; i < n; i++) {
      this._pos[i*3]   = pos.getX(i)
      this._pos[i*3+1] = pos.getY(i)
      this._pos[i*3+2] = pos.getZ(i)
    }
    this._prev.set(this._pos)
    this._rebuildRestLengths()
  }

  /**
   * Seed positions from a flat array [x0,y0,z0, x1,y1,z1, ...].
   */
  setFromArray(positions: ArrayLike<number>): void {
    const n = Math.min(positions.length, this._pos.length)
    for (let i = 0; i < n; i++) this._pos[i] = positions[i]
    this._prev.set(this._pos)
    this._rebuildRestLengths()
  }

  // ── Pinning ───────────────────────────────────────────────────────────────

  /** Pin a single vertex by index. Pinned vertices don't move. */
  pin(index: number): void {
    if (index >= 0 && index < this.vertexCount) this._pinned[index] = 1
  }

  /** Unpin a vertex. */
  unpin(index: number): void {
    if (index >= 0 && index < this.vertexCount) this._pinned[index] = 0
  }

  /** Pin an entire row (0 = bottom row in grid, segmentsY = top row). */
  pinRow(row: number): void {
    for (let x = 0; x <= this.segmentsX; x++) {
      this.pin(row * (this.segmentsX + 1) + x)
    }
  }

  /** Pin an entire column. */
  pinColumn(col: number): void {
    for (let y = 0; y <= this.segmentsY; y++) {
      this.pin(y * (this.segmentsX + 1) + col)
    }
  }

  isPinned(index: number): boolean { return this._pinned[index] === 1 }

  // ── Forces & Colliders ────────────────────────────────────────────────────

  setWind(wind: WindForce | null): void { this._wind = wind }
  addCollider(c: BaseCollider): void    { this._colliders.push(c) }
  removeCollider(c: BaseCollider): void { this._colliders = this._colliders.filter(x => x !== c) }
  clearColliders(): void                { this._colliders = [] }

  // ── Simulation ────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by `dt` seconds.
   * Blender runs at 1/24 s per frame with multiple substeps.
   * Recommended: pass `clock.getDelta()` clamped to 0.05 s max.
   */
  step(dt: number): void {
    const { substeps } = this.parameters
    const subDt = dt / substeps
    for (let s = 0; s < substeps; s++) {
      this._integrate(subDt)
      this._solveConstraints()
      this._resolveCollisions()
      if (this.parameters.selfCollision) this._resolveSelfCollision()
      if (this.parameters.pressure)      this._applyPressure(subDt)
    }
    this.time += dt
    this._wind?.advance(dt)
  }

  /**
   * Write current particle positions to a BufferGeometry's position attribute.
   * Call after step() each frame.
   */
  apply(geometry: BufferGeometry): void {
    const attr = geometry.getAttribute('position') as BufferAttribute
    const n    = Math.min(attr.count, this.vertexCount)
    for (let i = 0; i < n; i++) {
      attr.setXYZ(i, this._pos[i*3], this._pos[i*3+1], this._pos[i*3+2])
    }
    attr.needsUpdate = true
    geometry.computeVertexNormals()
  }

  /** Read-only access to current positions (flat Float64Array). */
  getPositions(): Readonly<Float64Array> { return this._pos }

  /** Teleport a single particle. Use to move pinned vertices. */
  setPosition(index: number, x: number, y: number, z: number): void {
    this._pos[index*3]   = x
    this._pos[index*3+1] = y
    this._pos[index*3+2] = z
    this._prev[index*3]  = x
    this._prev[index*3+1]= y
    this._prev[index*3+2]= z
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _integrate(dt: number): void {
    const { gravity, damping } = this.parameters
    const dt2 = dt * dt

    for (let i = 0; i < this.vertexCount; i++) {
      if (this._pinned[i]) continue

      const base = i * 3
      const px = this._pos[base], py = this._pos[base+1], pz = this._pos[base+2]
      const ox = this._prev[base], oy = this._prev[base+1], oz = this._prev[base+2]

      // Velocity estimate (Verlet: v ≈ pos - prev)
      const vx = (px - ox) * (1 - damping)
      const vy = (py - oy) * (1 - damping)
      const vz = (pz - oz) * (1 - damping)

      // External acceleration
      let ax = 0, ay = -gravity, az = 0
      if (this._wind) {
        const [wx, wy, wz] = this._wind.getAcceleration(px, py, pz, this.time)
        ax += wx; ay += wy; az += wz
      }

      // Save current as previous
      this._prev[base]   = px
      this._prev[base+1] = py
      this._prev[base+2] = pz

      // Verlet step
      this._pos[base]   = px + vx + ax * dt2
      this._pos[base+1] = py + vy + ay * dt2
      this._pos[base+2] = pz + vz + az * dt2
    }
  }

  private _solveConstraints(): void {
    const { iterations, stiffness, bending } = this.parameters
    const springs = this._springs

    for (let iter = 0; iter < iterations; iter++) {
      // Process springs in pairs of 4 floats: [i_base, j_base, restLen, isBend]
      for (let s = 0; s < springs.length; s += 4) {
        const ib = springs[s] | 0
        const jb = springs[s+1] | 0
        const restLen = springs[s+2]
        const isBend  = springs[s+3] > 0.5

        const k = isBend ? stiffness * bending : stiffness

        const px = this._pos[ib],   py = this._pos[ib+1], pz = this._pos[ib+2]
        const qx = this._pos[jb],   qy = this._pos[jb+1], qz = this._pos[jb+2]

        const dx = qx - px, dy = qy - py, dz = qz - pz
        const d2 = dx*dx + dy*dy + dz*dz
        if (d2 < 1e-12) continue

        const d     = Math.sqrt(d2)
        const delta = (d - restLen) / d * 0.5 * k

        const cx = dx * delta, cy = dy * delta, cz = dz * delta

        const pinnedI = this._pinned[ib / 3 | 0]
        const pinnedJ = this._pinned[jb / 3 | 0]

        if (!pinnedI && !pinnedJ) {
          this._pos[ib]   += cx;  this._pos[ib+1] += cy;  this._pos[ib+2] += cz
          this._pos[jb]   -= cx;  this._pos[jb+1] -= cy;  this._pos[jb+2] -= cz
        } else if (!pinnedI) {
          this._pos[ib]   += cx * 2;  this._pos[ib+1] += cy * 2;  this._pos[ib+2] += cz * 2
        } else if (!pinnedJ) {
          this._pos[jb]   -= cx * 2;  this._pos[jb+1] -= cy * 2;  this._pos[jb+2] -= cz * 2
        }
      }
    }
  }

  private _resolveCollisions(): void {
    for (const collider of this._colliders) {
      if (!collider.enabled) continue
      for (let i = 0; i < this.vertexCount; i++) {
        if (this._pinned[i]) continue
        const b   = i * 3
        const res = collider.resolve(this._pos[b], this._pos[b+1], this._pos[b+2])
        if (res) {
          this._pos[b]   = res[0]
          this._pos[b+1] = res[1]
          this._pos[b+2] = res[2]
        }
      }
    }
  }

  private _buildSprings(): void {
    const W = this.segmentsX + 1
    const H = this.segmentsY + 1
    const springs: number[] = []

    const addSpring = (i: number, j: number, bend: boolean) => {
      // Rest length will be filled in after positions are set
      springs.push(i*3, j*3, 0, bend ? 1 : 0)
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x

        // Structural: right and up
        if (x + 1 < W) addSpring(idx, idx + 1,      false)
        if (y + 1 < H) addSpring(idx, idx + W,      false)

        // Shear: diagonal
        if (x + 1 < W && y + 1 < H) {
          addSpring(idx, idx + W + 1, false)
          addSpring(idx + 1, idx + W, false)
        }

        // Bend: skip-one (prevents folding)
        if (x + 2 < W) addSpring(idx, idx + 2,      true)
        if (y + 2 < H) addSpring(idx, idx + W * 2,  true)
      }
    }

    this._springs = new Float64Array(springs)
  }

  private _resolveSelfCollision(): void {
    const minDist = this.parameters.selfCollisionDist
    const minDist2 = minDist * minDist
    // O(n²) — acceptable for cloth meshes (≤ ~600 verts at default resolution)
    for (let i = 0; i < this.vertexCount - 1; i++) {
      if (this._pinned[i]) continue
      const ib = i * 3
      for (let j = i + 1; j < this.vertexCount; j++) {
        if (this._pinned[j]) continue
        const jb = j * 3
        const dx = this._pos[jb]   - this._pos[ib]
        const dy = this._pos[jb+1] - this._pos[ib+1]
        const dz = this._pos[jb+2] - this._pos[ib+2]
        const d2 = dx*dx + dy*dy + dz*dz
        if (d2 < minDist2 && d2 > 1e-12) {
          const d    = Math.sqrt(d2)
          const corr = (minDist - d) * 0.5 / d
          const cx = dx * corr, cy = dy * corr, cz = dz * corr
          this._pos[ib]   -= cx;  this._pos[ib+1] -= cy;  this._pos[ib+2] -= cz
          this._pos[jb]   += cx;  this._pos[jb+1] += cy;  this._pos[jb+2] += cz
        }
      }
    }
  }

  private _applyPressure(dt: number): void {
    const pf = this.parameters.pressureFactor
    // Compute enclosed volume estimate; apply outward force to each triangle
    const tris = this._triangles
    for (let t = 0; t < tris.length; t += 3) {
      const ai = tris[t]*3, bi = tris[t+1]*3, ci = tris[t+2]*3
      // Face normal (unnormalized) — cross product gives 2× area
      const abx = this._pos[bi]   - this._pos[ai]
      const aby = this._pos[bi+1] - this._pos[ai+1]
      const abz = this._pos[bi+2] - this._pos[ai+2]
      const acx = this._pos[ci]   - this._pos[ai]
      const acy = this._pos[ci+1] - this._pos[ai+1]
      const acz = this._pos[ci+2] - this._pos[ai+2]
      const nx = aby*acz - abz*acy
      const ny = abz*acx - abx*acz
      const nz = abx*acy - aby*acx
      // Impulse = pressure * face area * dt / 3 verts
      const frac = pf * dt / 3
      if (!this._pinned[tris[t]])   { this._pos[ai]   += nx*frac; this._pos[ai+1] += ny*frac; this._pos[ai+2] += nz*frac }
      if (!this._pinned[tris[t+1]]) { this._pos[bi]   += nx*frac; this._pos[bi+1] += ny*frac; this._pos[bi+2] += nz*frac }
      if (!this._pinned[tris[t+2]]) { this._pos[ci]   += nx*frac; this._pos[ci+1] += ny*frac; this._pos[ci+2] += nz*frac }
    }
  }

  private _buildTriangles(): Uint32Array {
    const W = this.segmentsX + 1
    const H = this.segmentsY + 1
    const tris: number[] = []
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = y * W + x
        tris.push(i, i+1, i+W,  i+1, i+W+1, i+W)
      }
    }
    return new Uint32Array(tris)
  }

  private _rebuildRestLengths(): void {
    for (let s = 0; s < this._springs.length; s += 4) {
      const ib = this._springs[s]   | 0
      const jb = this._springs[s+1] | 0
      const dx = this._pos[jb]   - this._pos[ib]
      const dy = this._pos[jb+1] - this._pos[ib+1]
      const dz = this._pos[jb+2] - this._pos[ib+2]
      this._springs[s+2] = Math.sqrt(dx*dx + dy*dy + dz*dz)
    }
  }
}
