import { BufferGeometry, BufferAttribute } from 'three'

export interface SPHSimulatorOptions {
  /** Number of fluid particles. Default 500. */
  particleCount?: number
  /** Smoothing radius (h) — neighbourhood size. Blender: Fluid > Resolution. Default 0.3. */
  smoothingRadius?: number
  /** Target rest density (ρ₀). Default 1000. */
  restDensity?: number
  /** Pressure stiffness constant k. Higher = stiffer fluid. Default 200. */
  pressureK?: number
  /** Viscosity coefficient μ. Blender: Fluid > Viscosity. Default 0.1. */
  viscosity?: number
  /**
   * Viscosity model.
   * - `'standard'` — Müller 2003 viscosity Laplacian kernel (default)
   * - `'xsph'`     — XSPH correction (Schechter & Bridson 2012): blends each
   *                  particle's velocity toward its neighbours. More stable,
   *                  less physically accurate. Good for thick fluids.
   * - `'stiff'`    — Position-based viscosity: applies an extra velocity
   *                  correction proportional to velocity divergence. Very stiff,
   *                  best for near-incompressible high-viscosity fluids.
   * Blender: Fluid > Viscosity Preset (thin/medium/thick water / honey / oil).
   */
  viscosityType?: 'standard' | 'xsph' | 'stiff'
  /** Gravity [x,y,z]. Default [0,-9.8,0]. */
  gravity?: [number, number, number]
  /** Simulation substeps per frame. Default 4. */
  substeps?: number
  /** Surface tension coefficient. Default 0.0728 (water). */
  surfaceTension?: number
}

/**
 * SPHSimulator — Smoothed Particle Hydrodynamics fluid simulation.
 * Blender: Fluid modifier (FLIP/SPH domain).
 *
 * Implements the Müller et al. 2003 SPH formulation:
 *   - Poly6 kernel for density
 *   - Spiky kernel gradient for pressure
 *   - Viscosity kernel Laplacian for viscosity
 *
 * Workflow:
 *   1. Construct with particle count + physics parameters
 *   2. Call `setPositions(array)` to place particles in a volume
 *   3. Call `step(dt)` each frame (dt ≈ 1/60)
 *   4. Call `getGeometry()` to read back a THREE.BufferGeometry for rendering
 *
 * All physics parameters live in `parameters` for GSAP/st-keyframe:
 *   gsap.to(sim.parameters, { viscosity: 0.5, duration: 1 })
 */
export class SPHSimulator {
  /** All scalar simulation parameters — GSAP/st-keyframe compatible. */
  parameters: {
    smoothingRadius: number
    restDensity:     number
    pressureK:       number
    viscosity:       number
    /** XSPH blend factor [0–1]. Only used when viscosityType='xsph'. Default 0.5. */
    xsphFactor:      number
    /** Stiff viscosity strength. Only used when viscosityType='stiff'. Default 0.5. */
    stiffFactor:     number
    gravityX:        number
    gravityY:        number
    gravityZ:        number
    substeps:        number
    surfaceTension:  number
  }

  /** Active viscosity model. Can be changed at runtime. */
  viscosityType: 'standard' | 'xsph' | 'stiff'

  readonly particleCount: number

  // Particle data (flat arrays for cache performance)
  private _px: Float32Array
  private _py: Float32Array
  private _pz: Float32Array
  private _vx: Float32Array
  private _vy: Float32Array
  private _vz: Float32Array
  private _density: Float32Array
  private _pressure: Float32Array

  // Spatial grid for O(n) neighbour search
  private _grid: Map<number, number[]> = new Map()

  /** Simulation clock. */
  time = 0

  // Domain bounds (AABB collider)
  private _domainMin: [number,number,number] = [-2, -2, -2]
  private _domainMax: [number,number,number] = [ 2,  2,  2]

  constructor(opts: SPHSimulatorOptions = {}) {
    this.particleCount = Math.max(1, Math.round(opts.particleCount ?? 500))

    const h = opts.smoothingRadius ?? 0.3
    const g = opts.gravity ?? [0, -9.8, 0]

    this.viscosityType = opts.viscosityType ?? 'standard'

    this.parameters = {
      smoothingRadius: h,
      restDensity:     opts.restDensity    ?? 1000,
      pressureK:       opts.pressureK      ?? 200,
      viscosity:       opts.viscosity      ?? 0.1,
      xsphFactor:      0.5,
      stiffFactor:     0.5,
      gravityX:        g[0],
      gravityY:        g[1],
      gravityZ:        g[2],
      substeps:        opts.substeps       ?? 4,
      surfaceTension:  opts.surfaceTension ?? 0.0728,
    }

    this._px       = new Float32Array(this.particleCount)
    this._py       = new Float32Array(this.particleCount)
    this._pz       = new Float32Array(this.particleCount)
    this._vx       = new Float32Array(this.particleCount)
    this._vy       = new Float32Array(this.particleCount)
    this._vz       = new Float32Array(this.particleCount)
    this._density  = new Float32Array(this.particleCount)
    this._pressure = new Float32Array(this.particleCount)

    // Default: arrange in a 3D grid block
    this._initGrid()
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  private _initGrid(): void {
    const n   = this.particleCount
    const cbrt = Math.ceil(Math.cbrt(n))
    const spacing = this.parameters.smoothingRadius * 0.9
    let i = 0
    outer: for (let z = 0; z < cbrt; z++) {
      for (let y = 0; y < cbrt; y++) {
        for (let x = 0; x < cbrt; x++) {
          if (i >= n) break outer
          this._px[i] = (x - cbrt/2) * spacing
          this._py[i] = (y - cbrt/2) * spacing
          this._pz[i] = (z - cbrt/2) * spacing
          i++
        }
      }
    }
  }

  /**
   * Set particle positions from a flat array [x0,y0,z0, x1,y1,z1, ...].
   */
  setPositions(arr: ArrayLike<number>): void {
    const n = Math.min(this.particleCount, Math.floor(arr.length / 3))
    for (let i = 0; i < n; i++) {
      this._px[i] = arr[i*3]
      this._py[i] = arr[i*3+1]
      this._pz[i] = arr[i*3+2]
    }
    this._vx.fill(0); this._vy.fill(0); this._vz.fill(0)
  }

  /**
   * Set simulation domain (AABB boundary collider).
   * Particles bounce off the domain walls.
   */
  setDomain(
    min: [number,number,number],
    max: [number,number,number],
  ): void {
    this._domainMin = [...min] as [number,number,number]
    this._domainMax = [...max] as [number,number,number]
  }

  // ── Simulation ────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by dt seconds.
   * Recommended: pass clock.getDelta() clamped to 0.05 s.
   */
  step(dt: number): void {
    const sub = Math.max(1, Math.round(this.parameters.substeps))
    const subDt = dt / sub
    for (let s = 0; s < sub; s++) this._substep(subDt)
    this.time += dt
  }

  /**
   * Build and return a BufferGeometry with a 'position' attribute.
   * Suitable for THREE.Points rendering.
   */
  getGeometry(): BufferGeometry {
    const positions = new Float32Array(this.particleCount * 3)
    for (let i = 0; i < this.particleCount; i++) {
      positions[i*3]   = this._px[i]
      positions[i*3+1] = this._py[i]
      positions[i*3+2] = this._pz[i]
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    return geo
  }

  /**
   * Copy current particle positions into an existing BufferGeometry.
   * More efficient than getGeometry() in the render loop.
   */
  updateGeometry(geo: BufferGeometry): void {
    const attr = geo.getAttribute('position') as BufferAttribute
    const n    = Math.min(attr.count, this.particleCount)
    for (let i = 0; i < n; i++) {
      attr.setXYZ(i, this._px[i], this._py[i], this._pz[i])
    }
    attr.needsUpdate = true
  }

  /** Per-particle density (read-only, updated after each step). */
  getDensity(i: number): number { return this._density[i] }

  /** Per-particle pressure (read-only). */
  getPressure(i: number): number { return this._pressure[i] }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _substep(dt: number): void {
    this._buildSpatialGrid()
    this._computeDensityPressure()
    this._integrate(dt)
    if (this.viscosityType === 'xsph')  this._applyXSPH()
    if (this.viscosityType === 'stiff') this._applyStiffViscosity(dt)
    this._enforceDomain()
  }

  // Uniform spatial grid: maps cell key → particle indices
  private _buildSpatialGrid(): void {
    const h = this.parameters.smoothingRadius
    this._grid.clear()
    for (let i = 0; i < this.particleCount; i++) {
      const key = this._cellKey(
        Math.floor(this._px[i] / h),
        Math.floor(this._py[i] / h),
        Math.floor(this._pz[i] / h),
      )
      let cell = this._grid.get(key)
      if (!cell) { cell = []; this._grid.set(key, cell) }
      cell.push(i)
    }
  }

  private _cellKey(cx: number, cy: number, cz: number): number {
    // Simple hash: large primes, bit-truncated to 32-bit int range
    return ((cx * 92837111) ^ (cy * 689287499) ^ (cz * 283923481)) | 0
  }

  private _neighbours(i: number, callback: (j: number, r2: number) => void): void {
    const h  = this.parameters.smoothingRadius
    const h2 = h * h
    const cx = Math.floor(this._px[i] / h)
    const cy = Math.floor(this._py[i] / h)
    const cz = Math.floor(this._pz[i] / h)

    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = this._grid.get(this._cellKey(cx+dx, cy+dy, cz+dz))
          if (!cell) continue
          for (const j of cell) {
            if (j === i) continue
            const rx = this._px[j] - this._px[i]
            const ry = this._py[j] - this._py[i]
            const rz = this._pz[j] - this._pz[i]
            const r2 = rx*rx + ry*ry + rz*rz
            if (r2 < h2) callback(j, r2)
          }
        }
      }
    }
  }

  // Müller 2003 Poly6 kernel
  private _poly6(r2: number): number {
    const h  = this.parameters.smoothingRadius
    const h2 = h * h
    if (r2 > h2) return 0
    const diff = h2 - r2
    return (315 / (64 * Math.PI * Math.pow(h, 9))) * diff * diff * diff
  }

  // Spiky kernel gradient magnitude ∂W/∂r (scalar, apply direction separately)
  private _spikyGrad(r: number): number {
    const h = this.parameters.smoothingRadius
    if (r > h || r < 1e-6) return 0
    const diff = h - r
    return -(45 / (Math.PI * Math.pow(h, 6))) * diff * diff
  }

  // Viscosity kernel Laplacian
  private _viscLaplacian(r: number): number {
    const h = this.parameters.smoothingRadius
    if (r > h) return 0
    return (45 / (Math.PI * Math.pow(h, 6))) * (h - r)
  }

  private _computeDensityPressure(): void {
    const { restDensity, pressureK } = this.parameters
    const particleMass = restDensity * Math.pow(this.parameters.smoothingRadius, 3) * 0.02

    for (let i = 0; i < this.particleCount; i++) {
      let rho = this._poly6(0) * particleMass  // self contribution
      this._neighbours(i, (_j, r2) => {
        rho += particleMass * this._poly6(r2)
      })
      this._density[i]  = Math.max(rho, restDensity * 0.001)
      // Tait equation of state (water)
      this._pressure[i] = Math.max(0, pressureK * (this._density[i] / restDensity - 1))
    }
  }

  private _integrate(dt: number): void {
    const { gravityX, gravityY, gravityZ, viscosity } = this.parameters
    const particleMass = this.parameters.restDensity *
      Math.pow(this.parameters.smoothingRadius, 3) * 0.02

    for (let i = 0; i < this.particleCount; i++) {
      let fx = 0, fy = 0, fz = 0

      const pi   = this._pressure[i]
      const rhoi = this._density[i]

      this._neighbours(i, (j, r2) => {
        const rx = this._px[j] - this._px[i]
        const ry = this._py[j] - this._py[i]
        const rz = this._pz[j] - this._pz[i]
        const r  = Math.sqrt(r2)
        if (r < 1e-6) return

        const nx = rx/r, ny = ry/r, nz = rz/r
        const rhoj = this._density[j]
        const pj   = this._pressure[j]
        const m    = particleMass

        // Pressure force (symmetric formulation)
        const spg = this._spikyGrad(r)
        const pf  = -m * (pi + pj) / (2 * rhoj) * spg
        fx += pf * nx;  fy += pf * ny;  fz += pf * nz

        // Standard viscosity (Müller 2003) — skipped for xsph/stiff modes
        if (this.viscosityType === 'standard') {
          const visc = viscosity * m / rhoj * this._viscLaplacian(r)
          fx += visc * (this._vx[j] - this._vx[i])
          fy += visc * (this._vy[j] - this._vy[i])
          fz += visc * (this._vz[j] - this._vz[i])
        }
      })

      // Gravity
      fx += gravityX * rhoi
      fy += gravityY * rhoi
      fz += gravityZ * rhoi

      // Euler integration
      const invRho = 1 / rhoi
      this._vx[i] += (fx * invRho) * dt
      this._vy[i] += (fy * invRho) * dt
      this._vz[i] += (fz * invRho) * dt
      this._px[i] += this._vx[i] * dt
      this._py[i] += this._vy[i] * dt
      this._pz[i] += this._vz[i] * dt
    }
  }

  /**
   * XSPH viscosity (Schechter & Bridson 2012).
   * Blends each particle's velocity toward a weighted average of its neighbours.
   * More stable than Müller viscosity, good for thick/honey-like fluids.
   * Controlled by parameters.xsphFactor [0–1].
   */
  private _applyXSPH(): void {
    const h      = this.parameters.smoothingRadius
    const h2     = h * h
    const factor = this.parameters.xsphFactor
    const particleMass = this.parameters.restDensity * Math.pow(h, 3) * 0.02

    // Temporary correction arrays
    const cx = new Float32Array(this.particleCount)
    const cy = new Float32Array(this.particleCount)
    const cz = new Float32Array(this.particleCount)

    for (let i = 0; i < this.particleCount; i++) {
      this._neighbours(i, (j, r2) => {
        const w      = this._poly6(r2)
        const avgRho = (this._density[i] + this._density[j]) * 0.5
        const wm     = w * particleMass / avgRho
        cx[i] += wm * (this._vx[j] - this._vx[i])
        cy[i] += wm * (this._vy[j] - this._vy[i])
        cz[i] += wm * (this._vz[j] - this._vz[i])
      })
    }

    for (let i = 0; i < this.particleCount; i++) {
      this._vx[i] += factor * cx[i]
      this._vy[i] += factor * cy[i]
      this._vz[i] += factor * cz[i]
    }
  }

  /**
   * Stiff viscosity (position-based / divergence damping).
   * Applies a velocity correction proportional to the local velocity divergence,
   * strongly suppressing compressible motion.
   * Best for near-incompressible high-viscosity simulations.
   * Controlled by parameters.stiffFactor.
   */
  private _applyStiffViscosity(dt: number): void {
    const h          = this.parameters.smoothingRadius
    const stiff      = this.parameters.stiffFactor
    const particleMass = this.parameters.restDensity * Math.pow(h, 3) * 0.02

    const cx = new Float32Array(this.particleCount)
    const cy = new Float32Array(this.particleCount)
    const cz = new Float32Array(this.particleCount)

    for (let i = 0; i < this.particleCount; i++) {
      let divV = 0
      this._neighbours(i, (j, r2) => {
        const r = Math.sqrt(r2)
        if (r < 1e-6) return
        const rx = this._px[j] - this._px[i]
        const ry = this._py[j] - this._py[i]
        const rz = this._pz[j] - this._pz[i]
        const dvx = this._vx[j] - this._vx[i]
        const dvy = this._vy[j] - this._vy[i]
        const dvz = this._vz[j] - this._vz[i]
        // Divergence contribution: (v_ij · r_ij) / |r_ij|²
        const dot  = dvx*rx + dvy*ry + dvz*rz
        const spg  = this._spikyGrad(r)
        const coef = particleMass / this._density[j] * spg / r
        divV += dot / r2 * coef * (-1)
        // Velocity correction: push toward incompressibility
        cx[i] += coef * dot / r2 * rx
        cy[i] += coef * dot / r2 * ry
        cz[i] += coef * dot / r2 * rz
      })
      void divV
    }

    for (let i = 0; i < this.particleCount; i++) {
      this._vx[i] -= stiff * dt * cx[i]
      this._vy[i] -= stiff * dt * cy[i]
      this._vz[i] -= stiff * dt * cz[i]
    }
  }

  private _enforceDomain(): void {
    const restitution = 0.3
    const [minX, minY, minZ] = this._domainMin
    const [maxX, maxY, maxZ] = this._domainMax

    for (let i = 0; i < this.particleCount; i++) {
      if (this._px[i] < minX) { this._px[i] = minX; if (this._vx[i] < 0) this._vx[i] *= -restitution }
      if (this._px[i] > maxX) { this._px[i] = maxX; if (this._vx[i] > 0) this._vx[i] *= -restitution }
      if (this._py[i] < minY) { this._py[i] = minY; if (this._vy[i] < 0) this._vy[i] *= -restitution }
      if (this._py[i] > maxY) { this._py[i] = maxY; if (this._vy[i] > 0) this._vy[i] *= -restitution }
      if (this._pz[i] < minZ) { this._pz[i] = minZ; if (this._vz[i] < 0) this._vz[i] *= -restitution }
      if (this._pz[i] > maxZ) { this._pz[i] = maxZ; if (this._vz[i] > 0) this._vz[i] *= -restitution }
    }
  }
}
