import { BaseForce } from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

/**
 * Source-pool size above which BoidField partitions agents into a uniform
 * spatial grid instead of scanning every agent for every particle. Below
 * this size the brute-force scan is cheaper than grid upkeep.
 */
const GRID_THRESHOLD = 64

/**
 * A minimal interface for any particle pool that BoidField can read positions from.
 * Pass `otherSystem.pool` or any array of objects with a `position` and `alive` flag.
 */
export interface BoidFieldSource {
  readonly position: { x: number; y: number; z: number }
  readonly alive:    boolean
}

export interface BoidFieldOptions {
  /** Radius within which agents are repelled away from source particles. Default 1. */
  repelRadius?:   number
  /** Radius within which agents are attracted toward source particles. Default 0 (disabled). */
  attractRadius?: number
  /** Strength of the repulsion force. Default 3. */
  repelStrength?: number
  /** Strength of the attraction force. Default 1. */
  attractStrength?: number
  /** Maximum velocity magnitude a particle may reach. Default 8. */
  maxSpeed?: number
}

/**
 * BoidField — a scene-level force that steers one particle system
 * based on the positions of another (or an arbitrary point cloud).
 *
 * Blender equivalent: a Boid rules effector applied at scene level,
 * letting different systems interact (predator/prey, crowd avoidance,
 * swarming around attractors).
 *
 * @example
 * // System B avoids system A's particles
 * const field = new BoidField(systemA.pool, { repelRadius: 1.5, repelStrength: 5 })
 * systemB.addForce(field)
 *
 * // System B swarms toward system A
 * const field = new BoidField(systemA.pool, { attractRadius: 3, attractStrength: 2 })
 * systemB.addForce(field)
 */
export class BoidField extends BaseForce {
  parameters: {
    repelRadius:    number
    attractRadius:  number
    repelStrength:  number
    attractStrength: number
    maxSpeed:       number
  }

  private _source: BoidFieldSource[]

  // Uniform spatial grid over _source, rebuilt once per frame via beginFrame()
  // when the source pool is large enough to benefit (see GRID_THRESHOLD).
  private readonly _grid: Map<number, number[]> = new Map()
  private _cellSize = 0
  private _useGrid  = false

  constructor(source: BoidFieldSource[], opts: BoidFieldOptions = {}) {
    super()
    this._source = source
    this.parameters = {
      repelRadius:    opts.repelRadius     ?? 1.0,
      attractRadius:  opts.attractRadius   ?? 0.0,
      repelStrength:  opts.repelStrength   ?? 3.0,
      attractStrength: opts.attractStrength ?? 1.0,
      maxSpeed:       opts.maxSpeed        ?? 8.0,
    }
  }

  /** Swap the source pool at runtime — e.g. switch which system acts as the attractor. */
  setSource(source: BoidFieldSource[]): void {
    this._source = source
  }

  /**
   * Rebuilds the spatial grid for this frame when the source pool is large
   * enough to benefit. Called once per frame by the owning ParticleSystem,
   * before any apply() calls — never by application code directly.
   */
  beginFrame(): void {
    this._useGrid = this._source.length >= GRID_THRESHOLD
    if (!this._useGrid) return

    const { repelRadius, attractRadius } = this.parameters
    const searchRadius = Math.max(repelRadius, attractRadius)
    if (searchRadius <= 0) { this._useGrid = false; return }

    this._cellSize = searchRadius
    this._grid.clear()
    for (let i = 0; i < this._source.length; i++) {
      const agent = this._source[i]
      if (!agent.alive) continue
      const key = this._cellKey(
        Math.floor(agent.position.x / this._cellSize),
        Math.floor(agent.position.y / this._cellSize),
        Math.floor(agent.position.z / this._cellSize),
      )
      let cell = this._grid.get(key)
      if (!cell) { cell = []; this._grid.set(key, cell) }
      cell.push(i)
    }
  }

  private _cellKey(cx: number, cy: number, cz: number): number {
    return ((cx * 92837111) ^ (cy * 689287499) ^ (cz * 283923481)) | 0
  }

  apply(particle: Particle, dt: number): void {
    const { repelRadius, attractRadius, repelStrength, attractStrength, maxSpeed } = this.parameters
    const repR2  = repelRadius   * repelRadius
    const attR2  = attractRadius * attractRadius
    // Minimum distance to prevent force explosion at near-zero separation
    const minD   = 0.05

    let fx = 0, fy = 0, fz = 0

    const accumulate = (agent: BoidFieldSource): void => {
      if (!agent.alive) return
      const dx = particle.position.x - agent.position.x
      const dy = particle.position.y - agent.position.y
      const dz = particle.position.z - agent.position.z
      const d2 = dx*dx + dy*dy + dz*dz
      if (d2 < 1e-8) return
      const d = Math.max(Math.sqrt(d2), minD)

      // Repulsion — push away
      if (repR2 > 0 && d2 < repR2) {
        const fade = 1 - d / repelRadius
        const mag  = repelStrength * fade / d
        fx += dx * mag
        fy += dy * mag
        fz += dz * mag
      }

      // Attraction — pull toward
      if (attR2 > 0 && d2 < attR2) {
        const fade = 1 - d / attractRadius
        const mag  = -attractStrength * fade / d
        fx += dx * mag
        fy += dy * mag
        fz += dz * mag
      }
    }

    if (this._useGrid) {
      const cx = Math.floor(particle.position.x / this._cellSize)
      const cy = Math.floor(particle.position.y / this._cellSize)
      const cz = Math.floor(particle.position.z / this._cellSize)
      for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cell = this._grid.get(this._cellKey(cx+dx, cy+dy, cz+dz))
        if (!cell) continue
        for (const idx of cell) accumulate(this._source[idx])
      }
    } else {
      for (const agent of this._source) accumulate(agent)
    }

    particle.velocity.x += fx * dt
    particle.velocity.y += fy * dt
    particle.velocity.z += fz * dt

    // Clamp speed to prevent runaway / NaN
    const spd2 = particle.velocity.x**2 + particle.velocity.y**2 + particle.velocity.z**2
    if (spd2 > maxSpeed * maxSpeed) {
      const inv = maxSpeed / Math.sqrt(spd2)
      particle.velocity.x *= inv
      particle.velocity.y *= inv
      particle.velocity.z *= inv
    }
  }
}
