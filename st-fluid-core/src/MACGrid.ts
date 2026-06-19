/**
 * MACGrid — Marker-And-Cell staggered velocity grid.
 *
 * Velocity components are stored at face centres (staggered):
 *   u[i][j][k]  — X-velocity at face (i-½, j, k)
 *   v[i][j][k]  — Y-velocity at face (i, j-½, k)
 *   w[i][j][k]  — Z-velocity at face (i, j, k-½)
 * Pressure p[i][j][k] is at cell centres.
 *
 * Grid cell (i,j,k) covers world-space region:
 *   [ox + i*h, ox + (i+1)*h] × [oy + j*h, ...] × [oz + k*h, ...]
 */
export class MACGrid {
  readonly nx: number
  readonly ny: number
  readonly nz: number
  readonly h:  number   // cell size (world units)
  readonly ox: number   // world origin X
  readonly oy: number   // world origin Y
  readonly oz: number   // world origin Z

  // Velocity arrays — size (nx+1)*ny*nz, nx*(ny+1)*nz, nx*ny*(nz+1)
  u: Float64Array
  v: Float64Array
  w: Float64Array

  // Saved velocities for FLIP (old grid velocities before projection)
  uOld: Float64Array
  vOld: Float64Array
  wOld: Float64Array

  // Weight arrays for P2G splat normalization
  uW: Float64Array
  vW: Float64Array
  wW: Float64Array

  // Pressure
  pressure: Float64Array  // nx*ny*nz

  // Cell type: 0=air, 1=fluid, 2=solid
  cellType: Uint8Array    // nx*ny*nz

  constructor(nx: number, ny: number, nz: number, h: number, ox = 0, oy = 0, oz = 0) {
    this.nx = nx; this.ny = ny; this.nz = nz
    this.h  = h
    this.ox = ox; this.oy = oy; this.oz = oz

    this.u        = new Float64Array((nx + 1) * ny * nz)
    this.v        = new Float64Array(nx * (ny + 1) * nz)
    this.w        = new Float64Array(nx * ny * (nz + 1))
    this.uOld     = new Float64Array(this.u.length)
    this.vOld     = new Float64Array(this.v.length)
    this.wOld     = new Float64Array(this.w.length)
    this.uW       = new Float64Array(this.u.length)
    this.vW       = new Float64Array(this.v.length)
    this.wW       = new Float64Array(this.w.length)
    this.pressure = new Float64Array(nx * ny * nz)
    this.cellType = new Uint8Array(nx * ny * nz)
  }

  // ── Index helpers ─────────────────────────────────────────────────────────

  /** Flat index for cell (i,j,k). */
  idx(i: number, j: number, k: number): number {
    return i + this.nx * (j + this.ny * k)
  }

  /** Flat index for u-face (i,j,k) — grid is (nx+1)*ny*nz. */
  uIdx(i: number, j: number, k: number): number {
    return i + (this.nx + 1) * (j + this.ny * k)
  }

  /** Flat index for v-face (i,j,k) — grid is nx*(ny+1)*nz. */
  vIdx(i: number, j: number, k: number): number {
    return i + this.nx * (j + (this.ny + 1) * k)
  }

  /** Flat index for w-face (i,j,k) — grid is nx*ny*(nz+1). */
  wIdx(i: number, j: number, k: number): number {
    return i + this.nx * (j + this.ny * k)
  }

  // ── Interpolation ─────────────────────────────────────────────────────────

  /** Trilinear interpolation of u-velocity at world position (wx,wy,wz). */
  interpU(wx: number, wy: number, wz: number): number {
    return this._interp(this.u, wx - this.ox,       wy - this.oy - 0.5 * this.h, wz - this.oz - 0.5 * this.h,
                        this.nx + 1, this.ny, this.nz)
  }

  /** Trilinear interpolation of v-velocity at world position. */
  interpV(wx: number, wy: number, wz: number): number {
    return this._interp(this.v, wx - this.ox - 0.5 * this.h, wy - this.oy,       wz - this.oz - 0.5 * this.h,
                        this.nx, this.ny + 1, this.nz)
  }

  /** Trilinear interpolation of w-velocity at world position. */
  interpW(wx: number, wy: number, wz: number): number {
    return this._interp(this.w, wx - this.ox - 0.5 * this.h, wy - this.oy - 0.5 * this.h, wz - this.oz,
                        this.nx, this.ny, this.nz + 1)
  }

  private _interp(arr: Float64Array, lx: number, ly: number, lz: number,
                  Nx: number, Ny: number, Nz: number): number {
    const h = this.h
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

  // ── Utilities ─────────────────────────────────────────────────────────────

  clearVelocities(): void {
    this.u.fill(0); this.v.fill(0); this.w.fill(0)
    this.uW.fill(0); this.vW.fill(0); this.wW.fill(0)
  }

  saveVelocities(): void {
    this.uOld.set(this.u)
    this.vOld.set(this.v)
    this.wOld.set(this.w)
  }

  normalizeWeights(): void {
    for (let i = 0; i < this.u.length; i++) if (this.uW[i] > 0) this.u[i] /= this.uW[i]
    for (let i = 0; i < this.v.length; i++) if (this.vW[i] > 0) this.v[i] /= this.vW[i]
    for (let i = 0; i < this.w.length; i++) if (this.wW[i] > 0) this.w[i] /= this.wW[i]
  }

  /** Mark border cells as solid, fluid cells from a predicate. */
  markCells(isFluid: (i: number, j: number, k: number) => boolean): void {
    const { nx, ny, nz } = this
    for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const solid = i === 0 || i === nx-1 || j === 0 || j === ny-1 || k === 0 || k === nz-1
      this.cellType[this.idx(i,j,k)] = solid ? 2 : (isFluid(i,j,k) ? 1 : 0)
    }
  }

  /** Enforce solid (no-through) boundary: zero normal velocity at solid faces. */
  enforceBoundary(): void {
    const { nx, ny, nz } = this
    // Left/right walls (i=0 and i=nx)
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
      this.u[this.uIdx(0,  j, k)] = 0
      this.u[this.uIdx(nx, j, k)] = 0
    }
    // Bottom/top walls
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      this.v[this.vIdx(i, 0,  k)] = 0
      this.v[this.vIdx(i, ny, k)] = 0
    }
    // Front/back walls
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      this.w[this.wIdx(i, j, 0 )] = 0
      this.w[this.wIdx(i, j, nz)] = 0
    }
  }

  /** Apply gravity to grid v velocities over timestep dt. */
  applyGravity(gx: number, gy: number, gz: number, dt: number): void {
    const { nx, ny, nz } = this
    for (let k = 0; k < nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++)
      this.v[this.vIdx(i, j, k)] += gy * dt
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++)
      this.u[this.uIdx(i, j, k)] += gx * dt
    for (let k = 0; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
      this.w[this.wIdx(i, j, k)] += gz * dt
  }
}
