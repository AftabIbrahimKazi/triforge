import { Vector3 } from 'three'
import type { Particle } from '../core/Particle.js'

/**
 * SPH fluid particle physics — Müller et al. 2003.
 * Poly6 density · Spiky pressure gradient · Viscosity Laplacian.
 * Self-contained: no dependency on st-fluid-core.
 *
 * Blender parallel: Fluid physics type on a particle system.
 */
export class SPHPhysics {
  /** All public scalar inputs — GSAP / keyframe compatible */
  parameters: Record<string, number>

  /** Smoothing radius (world units) */
  h: number

  /** Rest density (particles/volume) */
  restDensity: number

  constructor(opts: {
    stiffness?:      number
    viscosity?:      number
    buoyancy?:       number
    surfaceTension?: number
    repulsion?:      number
    h?:              number
    restDensity?:    number
  } = {}) {
    this.parameters = {
      stiffness:      opts.stiffness      ?? 1,
      viscosity:      opts.viscosity      ?? 0.1,
      buoyancy:       opts.buoyancy       ?? 0,
      surfaceTension: opts.surfaceTension ?? 0,
      repulsion:      opts.repulsion      ?? 1,
    }
    this.h           = opts.h           ?? 1.0
    this.restDensity = opts.restDensity ?? 1.0
  }

  apply(pool: Particle[], dt: number): void {
    const alive: Particle[] = []
    for (const p of pool) if (p.alive) alive.push(p)
    if (alive.length < 2) return

    const { stiffness, viscosity } = this.parameters
    const h  = this.h
    const h2 = h * h
    const h6 = h2 * h2 * h2
    const h9 = h6 * h2 * h

    // Poly6 density kernel coefficient: 315 / (64π h^9)
    const kPoly6 = 315.0 / (64.0 * Math.PI * h9)
    // Spiky gradient coefficient: -45 / (π h^6)
    const kSpiky = 45.0 / (Math.PI * h6)
    // Viscosity Laplacian coefficient: 45 / (π h^6)
    const kVisc  = 45.0 / (Math.PI * h6)

    const n = alive.length

    // ── Build spatial hash grid for O(n) neighbour queries ────────────────────
    const cellSize = h
    const grid = new Map<number, number[]>()

    const hashCell = (ix: number, iy: number, iz: number): number =>
      (ix * 73856093 ^ iy * 19349663 ^ iz * 83492791) >>> 0

    const cellOf = (p: Particle): [number, number, number] => [
      Math.floor(p.position.x / cellSize),
      Math.floor(p.position.y / cellSize),
      Math.floor(p.position.z / cellSize),
    ]

    for (let i = 0; i < n; i++) {
      const [ix, iy, iz] = cellOf(alive[i])
      const key = hashCell(ix, iy, iz)
      let bucket = grid.get(key)
      if (!bucket) { bucket = []; grid.set(key, bucket) }
      bucket.push(i)
    }

    const neighbours = (pi: Particle): number[] => {
      const [cx, cy, cz] = cellOf(pi)
      const result: number[] = []
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = grid.get(hashCell(cx + dx, cy + dy, cz + dz))
            if (bucket) for (const j of bucket) result.push(j)
          }
      return result
    }

    // ── Step 1: density ───────────────────────────────────────────────────────
    const density = new Float32Array(n)
    const _d = new Vector3()
    for (let i = 0; i < n; i++) {
      let rho = 0
      for (const j of neighbours(alive[i])) {
        _d.copy(alive[i].position).sub(alive[j].position)
        const r2 = _d.lengthSq()
        if (r2 < h2) {
          const diff = h2 - r2
          rho += kPoly6 * diff * diff * diff
        }
      }
      density[i] = Math.max(rho, 1e-6)
    }

    // ── Step 2: pressure (Tait) ──────────────────────────────────────────────
    const pressure = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pressure[i] = stiffness * (density[i] - this.restDensity)
    }

    // ── Step 3: forces → velocity ────────────────────────────────────────────
    const _r  = new Vector3()
    const _fv = new Vector3()
    for (let i = 0; i < n; i++) {
      const pi = alive[i]
      _fv.set(0, 0, 0)
      for (const j of neighbours(pi)) {
        if (i === j) continue
        const pj = alive[j]
        _r.copy(pi.position).sub(pj.position)
        const r = _r.length()
        if (r < 0.0001 || r >= h) continue

        // Pressure gradient (Spiky kernel)
        const spiky = kSpiky * (h - r) * (h - r) / r
        const pAvg  = (pressure[i] + pressure[j]) * 0.5
        _fv.addScaledVector(_r, -spiky * pAvg / density[j])

        // Viscosity Laplacian
        const laplac = kVisc * (h - r)
        _fv.addScaledVector(
          _r.copy(pj.velocity).sub(pi.velocity),
          viscosity * laplac / density[j],
        )
      }

      // f = F / rho_i
      pi.velocity.addScaledVector(_fv, dt / density[i])
    }
  }
}
