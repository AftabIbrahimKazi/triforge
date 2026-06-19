import { noise3 } from '../utils/noise.js'

/**
 * WindForce — directional wind with turbulence.
 * Blender: Force Field > Wind.
 *
 * Returns a per-step acceleration contribution for each cloth particle.
 * The turbulence adds spatial noise so the cloth billows naturally.
 */
export class WindForce {
  parameters: {
    /** Wind direction X component. */
    dirX: number
    /** Wind direction Y component. */
    dirY: number
    /** Wind direction Z component. */
    dirZ: number
    /** Wind strength (m/s²). Blender: Strength. */
    strength: number
    /** Turbulence amplitude [0, 1]. Blender: Noise. */
    turbulence: number
    /** Turbulence frequency — how fast the noise evolves over time. */
    frequency: number
  }

  private _time = 0

  constructor(opts: {
    direction?: [number, number, number]
    strength?:  number
    turbulence?: number
    frequency?: number
  } = {}) {
    const d = opts.direction ?? [1, 0, 0]
    this.parameters = {
      dirX: d[0], dirY: d[1], dirZ: d[2],
      strength:   opts.strength   ?? 5,
      turbulence: opts.turbulence ?? 0.3,
      frequency:  opts.frequency  ?? 1.0,
    }
  }

  /**
   * Get wind acceleration at position (px, py, pz) and current time.
   * Returns [ax, ay, az].
   */
  getAcceleration(px: number, py: number, pz: number, time: number): [number, number, number] {
    const { dirX, dirY, dirZ, strength, turbulence, frequency } = this.parameters

    // Normalize direction
    const len = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ) || 1
    const nx  = dirX/len, ny = dirY/len, nz = dirZ/len

    // Simple value-noise turbulence: hash position + time
    const t   = turbulence * noise3(px*0.3 + time*frequency, py*0.3, pz*0.3)
    const s   = strength * (1 + t)

    return [nx*s, ny*s, nz*s]
  }

  /** Advance internal time by dt (called by ClothSimulator). */
  advance(dt: number): void {
    this._time += dt
  }

  get time(): number { return this._time }
}

