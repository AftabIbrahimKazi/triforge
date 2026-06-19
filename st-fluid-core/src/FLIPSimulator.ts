import pcg from 'conjugate-gradient'
import { MACGrid } from './MACGrid.js'

export interface FLIPSimulatorOptions {
  /**
   * Grid resolution along each axis.
   * Higher = more detail, higher cost. Default 24.
   * Blender: Fluid > Resolution Divisions.
   */
  resolution?: number

  /**
   * World-space size of the fluid domain cube.
   * Default 2 (a 2×2×2 metre box).
   */
  domainSize?: number

  /**
   * World-space origin (bottom-left-front corner of the domain).
   * Default [−1, −1, −1].
   */
  origin?: [number, number, number]

  /**
   * Number of fluid particles. Default 2000.
   * Blender: Fluid > Particle Count.
   */
  particleCount?: number

  /**
   * FLIP blend factor [0–1].
   * 1 = pure FLIP (energetic, noisy), 0 = pure PIC (damped, stable).
   * 0.95 matches Blender's default. Blender: Fluid > FLIP Ratio.
   */
  flipRatio?: number

  /** Gravity vector [x,y,z]. Default [0,−9.8,0]. */
  gravity?: [number, number, number]

  /** Pressure solver maximum iterations. Default 80. */
  solverMaxIter?: number

  /** Pressure solver convergence tolerance. Default 1e-4. */
  solverTolerance?: number

  /** Simulation substeps per frame. Default 3. */
  substeps?: number
}

/** A single FLIP fluid particle. */
interface FlipParticle {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
}

/**
 * FLIPSimulator — full FLIP (Fluid-Implicit-Particle) fluid simulation.
 *
 * Implements the Zhu & Bridson 2005 FLIP algorithm:
 *   1. Transfer particle velocities → MAC grid (P2G, trilinear splat)
 *   2. Apply body forces (gravity) on grid
 *   3. Enforce solid boundary conditions
 *   4. Solve pressure Poisson equation (conjugate gradient)
 *   5. Subtract pressure gradient from grid velocity (projection)
 *   6. Transfer grid velocity change back to particles (G2P, FLIP blend)
 *   7. Advect particles through the corrected velocity field
 *
 * All parameters live in `parameters` for GSAP/st-keyframe animation.
 *
 * ```typescript
 * const sim = new FLIPSimulator({ resolution: 20, particleCount: 1500 })
 * sim.fillBox(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
 *
 * // Each frame:
 * sim.step(dt)
 * const pts = sim.getPositions()  // Float32Array  [x,y,z, x,y,z, ...]
 * ```
 */
export class FLIPSimulator {
  parameters: Record<string, number>

  readonly particleCount: number
  private readonly _grid: MACGrid
  private readonly _particles: FlipParticle[]

  // Pressure system — rebuilt each step
  private readonly _b:  Float64Array   // RHS divergence
  private readonly _x:  Float64Array   // pressure solution
  private readonly _nx: number
  private readonly _ny: number
  private readonly _nz: number

  constructor(opts: FLIPSimulatorOptions = {}) {
    const res        = opts.resolution    ?? 24
    const domainSize = opts.domainSize    ?? 2
    const origin     = opts.origin        ?? [-1, -1, -1]
    const h          = domainSize / res

    this._nx = res; this._ny = res; this._nz = res
    this._grid = new MACGrid(res, res, res, h, origin[0], origin[1], origin[2])

    this.particleCount = opts.particleCount ?? 2000
    this._particles    = []

    this._b = new Float64Array(res * res * res)
    this._x = new Float64Array(res * res * res)

    const g = opts.gravity ?? [0, -9.8, 0]

    this.parameters = {
      flipRatio:       opts.flipRatio       ?? 0.95,
      gravityX:        g[0],
      gravityY:        g[1],
      gravityZ:        g[2],
      substeps:        opts.substeps        ?? 3,
      solverMaxIter:   opts.solverMaxIter   ?? 80,
      solverTolerance: opts.solverTolerance ?? 1e-4,
    }
  }

  // ── Particle placement ────────────────────────────────────────────────────

  /**
   * Fill a world-space axis-aligned box with fluid particles.
   * Particles are distributed using a jittered grid to avoid clumping.
   * Multiple calls accumulate particles (capped at particleCount).
   */
  fillBox(x0: number, y0: number, z0: number,
          x1: number, y1: number, z1: number): void {
    this._particles.length = 0
    const h   = this._grid.h
    const pph = 2   // particles per cell per axis (2³ = 8 per cell, standard FLIP)
    const sp  = h / pph

    for (let z = z0; z < z1; z += sp)
    for (let y = y0; y < y1; y += sp)
    for (let x = x0; x < x1; x += sp) {
      if (this._particles.length >= this.particleCount) break
      this._particles.push({
        x: x + sp * Math.random(),
        y: y + sp * Math.random(),
        z: z + sp * Math.random(),
        vx: 0, vy: 0, vz: 0,
      })
    }
  }

  // ── Main step ─────────────────────────────────────────────────────────────

  /** Advance the simulation by `dt` seconds (call once per frame, e.g. dt=1/60). */
  step(dt: number): void {
    const substeps = Math.max(1, Math.round(this.parameters.substeps))
    const subDt    = dt / substeps
    for (let s = 0; s < substeps; s++) this._substep(subDt)
  }

  private _substep(dt: number): void {
    const grid = this._grid
    const { nx, ny, nz, h } = grid

    // 1. Mark cells as fluid / air based on particle positions
    const fluidSet = new Set<number>()
    for (const p of this._particles) {
      const i = Math.floor((p.x - grid.ox) / h)
      const j = Math.floor((p.y - grid.oy) / h)
      const k = Math.floor((p.z - grid.oz) / h)
      if (i >= 1 && i < nx-1 && j >= 1 && j < ny-1 && k >= 1 && k < nz-1)
        fluidSet.add(grid.idx(i, j, k))
    }
    grid.markCells((i, j, k) => fluidSet.has(grid.idx(i, j, k)))

    // 2. P2G — splat particle velocities to grid faces
    grid.clearVelocities()
    this._p2g()
    grid.normalizeWeights()
    grid.saveVelocities()

    // 3. Body forces + boundary
    grid.applyGravity(this.parameters.gravityX, this.parameters.gravityY, this.parameters.gravityZ, dt)
    grid.enforceBoundary()

    // 4. Pressure projection
    this._pressureSolve(dt)

    // 5. G2P — transfer corrected grid velocities back to particles (FLIP blend)
    this._g2p()

    // 6. Advect particles
    this._advect(dt)

    // 7. Clamp particles inside domain
    this._clampParticles()
  }

  // ── P2G (particle → grid) ─────────────────────────────────────────────────

  private _p2g(): void {
    const grid = this._grid
    const { nx, ny, nz, h, ox, oy, oz } = grid

    for (const p of this._particles) {
      // U faces (i-½, j, k) — offset by (0, h/2, h/2)
      this._splatToFace(grid.u, grid.uW, p.vx,
        p.x - ox,         p.y - oy - 0.5*h, p.z - oz - 0.5*h,
        nx+1, ny, nz, h)

      // V faces (i, j-½, k) — offset by (h/2, 0, h/2)
      this._splatToFace(grid.v, grid.vW, p.vy,
        p.x - ox - 0.5*h, p.y - oy,         p.z - oz - 0.5*h,
        nx, ny+1, nz, h)

      // W faces (i, j, k-½) — offset by (h/2, h/2, 0)
      this._splatToFace(grid.w, grid.wW, p.vz,
        p.x - ox - 0.5*h, p.y - oy - 0.5*h, p.z - oz,
        nx, ny, nz+1, h)
    }
  }

  private _splatToFace(arr: Float64Array, wArr: Float64Array, val: number,
                       lx: number, ly: number, lz: number,
                       Nx: number, Ny: number, Nz: number, h: number): void {
    let fi = lx / h, fj = ly / h, fk = lz / h
    fi = Math.max(0, Math.min(Nx - 1.0001, fi))
    fj = Math.max(0, Math.min(Ny - 1.0001, fj))
    fk = Math.max(0, Math.min(Nz - 1.0001, fk))

    const i0 = Math.floor(fi), i1 = i0 + 1
    const j0 = Math.floor(fj), j1 = j0 + 1
    const k0 = Math.floor(fk), k1 = k0 + 1
    const tx = fi - i0, ty = fj - j0, tz = fk - k0
    const idx = (i: number, j: number, k: number) => i + Nx * (j + Ny * k)

    const w000 = (1-tx)*(1-ty)*(1-tz); arr[idx(i0,j0,k0)] += w000*val; wArr[idx(i0,j0,k0)] += w000
    const w100 =    tx *(1-ty)*(1-tz); arr[idx(i1,j0,k0)] += w100*val; wArr[idx(i1,j0,k0)] += w100
    const w010 = (1-tx)*   ty *(1-tz); arr[idx(i0,j1,k0)] += w010*val; wArr[idx(i0,j1,k0)] += w010
    const w110 =    tx *   ty *(1-tz); arr[idx(i1,j1,k0)] += w110*val; wArr[idx(i1,j1,k0)] += w110
    const w001 = (1-tx)*(1-ty)*   tz ; arr[idx(i0,j0,k1)] += w001*val; wArr[idx(i0,j0,k1)] += w001
    const w101 =    tx *(1-ty)*   tz ; arr[idx(i1,j0,k1)] += w101*val; wArr[idx(i1,j0,k1)] += w101
    const w011 = (1-tx)*   ty *   tz ; arr[idx(i0,j1,k1)] += w011*val; wArr[idx(i0,j1,k1)] += w011
    const w111 =    tx *   ty *   tz ; arr[idx(i1,j1,k1)] += w111*val; wArr[idx(i1,j1,k1)] += w111
  }

  // ── Pressure projection ───────────────────────────────────────────────────

  private _pressureSolve(dt: number): void {
    const grid = this._grid
    const { nx, ny, nz, h } = grid
    const N    = nx * ny * nz
    const invH2 = 1.0 / (h * h)

    // Build RHS: b[i] = div(u)[i] / dt  (standard incompressible projection)
    this._b.fill(0)
    for (let k = 1; k < nz-1; k++)
    for (let j = 1; j < ny-1; j++)
    for (let i = 1; i < nx-1; i++) {
      const ci = grid.idx(i, j, k)
      if (grid.cellType[ci] !== 1) continue
      const div = (grid.u[grid.uIdx(i+1,j,k)] - grid.u[grid.uIdx(i,j,k)]) / h
                + (grid.v[grid.vIdx(i,j+1,k)] - grid.v[grid.vIdx(i,j,k)]) / h
                + (grid.w[grid.wIdx(i,j,k+1)] - grid.w[grid.wIdx(i,j,k)]) / h
      this._b[ci] = div / dt
    }

    this._x.fill(0)

    const cellType = grid.cellType
    const idxFn    = (i: number, j: number, k: number) => grid.idx(i, j, k)

    // A = discrete positive-definite Laplacian  (1/h² per neighbour pair)
    const A = {
      rowCount: N,
      get: (row: number, _col: number): number => {
        if (cellType[row] !== 1) return 1
        const kk = Math.floor(row / (nx * ny))
        const rem = row - kk * nx * ny
        const jj  = Math.floor(rem / nx)
        const ii  = rem - jj * nx
        let d = 0
        if (ii > 0    && cellType[idxFn(ii-1,jj,kk)] !== 2) d += invH2
        if (ii < nx-1 && cellType[idxFn(ii+1,jj,kk)] !== 2) d += invH2
        if (jj > 0    && cellType[idxFn(ii,jj-1,kk)] !== 2) d += invH2
        if (jj < ny-1 && cellType[idxFn(ii,jj+1,kk)] !== 2) d += invH2
        if (kk > 0    && cellType[idxFn(ii,jj,kk-1)] !== 2) d += invH2
        if (kk < nz-1 && cellType[idxFn(ii,jj,kk+1)] !== 2) d += invH2
        return d > 0 ? d : 1
      },
      apply: (xVec: Float64Array, out: Float64Array): void => {
        out.fill(0)
        for (let k2 = 0; k2 < nz; k2++)
        for (let j2 = 0; j2 < ny; j2++)
        for (let i2 = 0; i2 < nx; i2++) {
          const ci = idxFn(i2, j2, k2)
          if (cellType[ci] !== 1) { out[ci] = xVec[ci]; continue }
          let sum = 0, cnt = 0
          if (i2 > 0    && cellType[idxFn(i2-1,j2,k2)] !== 2) { sum += xVec[idxFn(i2-1,j2,k2)]; cnt++ }
          if (i2 < nx-1 && cellType[idxFn(i2+1,j2,k2)] !== 2) { sum += xVec[idxFn(i2+1,j2,k2)]; cnt++ }
          if (j2 > 0    && cellType[idxFn(i2,j2-1,k2)] !== 2) { sum += xVec[idxFn(i2,j2-1,k2)]; cnt++ }
          if (j2 < ny-1 && cellType[idxFn(i2,j2+1,k2)] !== 2) { sum += xVec[idxFn(i2,j2+1,k2)]; cnt++ }
          if (k2 > 0    && cellType[idxFn(i2,j2,k2-1)] !== 2) { sum += xVec[idxFn(i2,j2,k2-1)]; cnt++ }
          if (k2 < nz-1 && cellType[idxFn(i2,j2,k2+1)] !== 2) { sum += xVec[idxFn(i2,j2,k2+1)]; cnt++ }
          out[ci] = invH2 * (cnt * xVec[ci] - sum)
        }
      },
    }

    try {
      pcg(A, this._b, this._x, this.parameters.solverTolerance, Math.round(this.parameters.solverMaxIter))
    } catch (_) { /* degenerate — keep zero pressure */ }

    // Guard against NaN (degenerate geometry — no fluid cells, etc.)
    for (let i = 0; i < this._x.length; i++) {
      if (!isFinite(this._x[i])) { this._x.fill(0); break }
    }

    // Subtract pressure gradient — loop over faces (each face updated exactly once)
    // U-faces: (i, j, k) for i in [1, nx-1]
    for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
    for (let i = 1; i < nx; i++) {
      const cL = grid.idx(i-1, j, k)
      const cR = grid.idx(i,   j, k)
      if ((cellType[cL] === 1 || cellType[cR] === 1) &&
           cellType[cL] !== 2 && cellType[cR] !== 2) {
        grid.u[grid.uIdx(i,j,k)] -= dt * (this._x[cR] - this._x[cL]) / h
      }
    }

    // V-faces: (i, j, k) for j in [1, ny-1]
    for (let k = 0; k < nz; k++)
    for (let j = 1; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const cB = grid.idx(i, j-1, k)
      const cT = grid.idx(i, j,   k)
      if ((cellType[cB] === 1 || cellType[cT] === 1) &&
           cellType[cB] !== 2 && cellType[cT] !== 2) {
        grid.v[grid.vIdx(i,j,k)] -= dt * (this._x[cT] - this._x[cB]) / h
      }
    }

    // W-faces: (i, j, k) for k in [1, nz-1]
    for (let k = 1; k < nz; k++)
    for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const cN = grid.idx(i, j, k-1)
      const cF = grid.idx(i, j, k  )
      if ((cellType[cN] === 1 || cellType[cF] === 1) &&
           cellType[cN] !== 2 && cellType[cF] !== 2) {
        grid.w[grid.wIdx(i,j,k)] -= dt * (this._x[cF] - this._x[cN]) / h
      }
    }

    grid.enforceBoundary()
  }

  // ── G2P (grid → particle) ─────────────────────────────────────────────────

  private _g2p(): void {
    const grid  = this._grid
    const ratio = this.parameters.flipRatio

    for (const p of this._particles) {
      // New grid velocity at particle position
      const nu = grid.interpU(p.x, p.y, p.z)
      const nv = grid.interpV(p.x, p.y, p.z)
      const nw = grid.interpW(p.x, p.y, p.z)

      // Old grid velocity at particle position (before pressure solve)
      const ou = this._interpOld(grid.uOld, p.x - grid.ox,         p.y - grid.oy - 0.5*grid.h, p.z - grid.oz - 0.5*grid.h, grid.nx+1, grid.ny, grid.nz)
      const ov = this._interpOld(grid.vOld, p.x - grid.ox - 0.5*grid.h, p.y - grid.oy,         p.z - grid.oz - 0.5*grid.h, grid.nx, grid.ny+1, grid.nz)
      const ow = this._interpOld(grid.wOld, p.x - grid.ox - 0.5*grid.h, p.y - grid.oy - 0.5*grid.h, p.z - grid.oz,         grid.nx, grid.ny, grid.nz+1)

      // FLIP: particle velocity += (new - old) grid velocity
      // PIC:  particle velocity  = new grid velocity
      // Blend
      p.vx = ratio * (p.vx + nu - ou) + (1 - ratio) * nu
      p.vy = ratio * (p.vy + nv - ov) + (1 - ratio) * nv
      p.vz = ratio * (p.vz + nw - ow) + (1 - ratio) * nw
    }
  }

  private _interpOld(arr: Float64Array, lx: number, ly: number, lz: number,
                     Nx: number, Ny: number, Nz: number): number {
    const h = this._grid.h
    let fi = lx / h, fj = ly / h, fk = lz / h
    fi = Math.max(0, Math.min(Nx - 1.0001, fi))
    fj = Math.max(0, Math.min(Ny - 1.0001, fj))
    fk = Math.max(0, Math.min(Nz - 1.0001, fk))
    const i0 = Math.floor(fi), i1 = i0 + 1
    const j0 = Math.floor(fj), j1 = j0 + 1
    const k0 = Math.floor(fk), k1 = k0 + 1
    const tx = fi - i0, ty = fj - j0, tz = fk - k0
    const idx = (i: number, j: number, k: number) => i + Nx * (j + Ny * k)
    return (1-tz)*((1-ty)*((1-tx)*arr[idx(i0,j0,k0)] + tx*arr[idx(i1,j0,k0)]) +
                      ty *((1-tx)*arr[idx(i0,j1,k0)] + tx*arr[idx(i1,j1,k0)])) +
               tz*((1-ty)*((1-tx)*arr[idx(i0,j0,k1)] + tx*arr[idx(i1,j0,k1)]) +
                      ty *((1-tx)*arr[idx(i0,j1,k1)] + tx*arr[idx(i1,j1,k1)]))
  }

  // ── Advection ─────────────────────────────────────────────────────────────

  private _advect(dt: number): void {
    for (const p of this._particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
    }
  }

  private _clampParticles(): void {
    const { ox, oy, oz, nx, ny, nz, h } = this._grid
    const margin = h * 0.5
    const xMin = ox + margin, xMax = ox + nx * h - margin
    const yMin = oy + margin, yMax = oy + ny * h - margin
    const zMin = oz + margin, zMax = oz + nz * h - margin

    for (const p of this._particles) {
      if (p.x < xMin) { p.x = xMin; if (p.vx < 0) p.vx = 0 }
      if (p.x > xMax) { p.x = xMax; if (p.vx > 0) p.vx = 0 }
      if (p.y < yMin) { p.y = yMin; if (p.vy < 0) p.vy = 0 }
      if (p.y > yMax) { p.y = yMax; if (p.vy > 0) p.vy = 0 }
      if (p.z < zMin) { p.z = zMin; if (p.vz < 0) p.vz = 0 }
      if (p.z > zMax) { p.z = zMax; if (p.vz > 0) p.vz = 0 }
    }
  }

  // ── Output ────────────────────────────────────────────────────────────────

  /** Returns particle positions as a flat Float32Array [x,y,z, x,y,z, ...]. */
  getPositions(): Float32Array {
    const out = new Float32Array(this._particles.length * 3)
    for (let i = 0; i < this._particles.length; i++) {
      out[i*3]   = this._particles[i].x
      out[i*3+1] = this._particles[i].y
      out[i*3+2] = this._particles[i].z
    }
    return out
  }

  /** Returns particle velocities as a flat Float32Array [vx,vy,vz, ...]. */
  getVelocities(): Float32Array {
    const out = new Float32Array(this._particles.length * 3)
    for (let i = 0; i < this._particles.length; i++) {
      out[i*3]   = this._particles[i].vx
      out[i*3+1] = this._particles[i].vy
      out[i*3+2] = this._particles[i].vz
    }
    return out
  }

  /** Number of live particles. */
  get liveCount(): number { return this._particles.length }

  /** The underlying MAC grid (for advanced use / surface reconstruction). */
  get grid(): MACGrid { return this._grid }
}
