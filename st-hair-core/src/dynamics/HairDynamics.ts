import type { Strand } from '../core/Strand.js'

export interface HairDynamicsOptions {
  gravity?: number
  stiffness?: number
  damping?: number
  wind?: [number, number, number]
  iterations?: number
  collisionSphere?: [number, number, number, number] | null
}

// Internal per-particle state
interface Particle {
  x: number; y: number; z: number       // current position
  px: number; py: number; pz: number    // previous position
  restDist: number                       // rest distance to next particle
}

export class HairDynamics {
  parameters: {
    gravity: number
    stiffness: number
    damping: number
    windX: number
    windY: number
    windZ: number
    iterations: number
  }

  private _chains: Particle[][]          // one chain per strand
  private _roots: [number, number, number][]   // pinned root positions
  private _collision: [number, number, number, number] | null = null

  constructor(strands: Strand[], opts: HairDynamicsOptions = {}) {
    const gravity    = opts.gravity    ?? -9.8
    const stiffness  = opts.stiffness  ?? 0.8
    const damping    = opts.damping    ?? 0.98
    const wind       = opts.wind       ?? [0, 0, 0]
    const iterations = opts.iterations ?? 3
    const col        = opts.collisionSphere ?? null

    this.parameters = {
      gravity,
      stiffness,
      damping,
      windX: wind[0],
      windY: wind[1],
      windZ: wind[2],
      iterations,
    }

    this._collision = col
    this._chains = []
    this._roots  = []

    for (const strand of strands) {
      const pts = strand.points
      this._roots.push([pts[0][0], pts[0][1], pts[0][2]])
      const chain: Particle[] = []
      for (let i = 0; i < pts.length; i++) {
        const [x, y, z] = pts[i]
        let restDist = 0
        if (i < pts.length - 1) {
          const [nx, ny, nz] = pts[i + 1]
          const dx = nx - x, dy = ny - y, dz = nz - z
          restDist = Math.sqrt(dx*dx + dy*dy + dz*dz)
        }
        chain.push({ x, y, z, px: x, py: y, pz: z, restDist })
      }
      this._chains.push(chain)
    }
  }

  update(dt: number): void {
    const { gravity, stiffness, damping, windX, windY, windZ, iterations } = this.parameters
    const dt2 = dt * dt
    const ax = windX
    const ay = gravity + windY
    const az = windZ

    for (let s = 0; s < this._chains.length; s++) {
      const chain = this._chains[s]
      const root  = this._roots[s]

      // Pin root
      chain[0].x  = root[0]
      chain[0].y  = root[1]
      chain[0].z  = root[2]
      chain[0].px = root[0]
      chain[0].py = root[1]
      chain[0].pz = root[2]

      // Verlet integrate free particles
      for (let i = 1; i < chain.length; i++) {
        const p = chain[i]
        // Damped Verlet: new_pos = pos + (pos - prev_pos)*damping + accel*dt²
        const vx = (p.x - p.px) * damping
        const vy = (p.y - p.py) * damping
        const vz = (p.z - p.pz) * damping
        p.px = p.x
        p.py = p.y
        p.pz = p.z
        p.x += vx + ax * dt2
        p.y += vy + ay * dt2
        p.z += vz + az * dt2
      }

      // Constraint solve
      for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < chain.length - 1; i++) {
          const a = chain[i]
          const b = chain[i + 1]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dz = b.z - a.z
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1e-8
          const diff = (dist - a.restDist) / dist * stiffness
          const cx = dx * diff * 0.5
          const cy = dy * diff * 0.5
          const cz = dz * diff * 0.5
          if (i > 0) {
            // a is free
            a.x += cx
            a.y += cy
            a.z += cz
          }
          b.x -= cx
          b.y -= cy
          b.z -= cz
        }
      }

      // Collision sphere
      if (this._collision !== null) {
        const [cx, cy, cz, radius] = this._collision
        for (let i = 1; i < chain.length; i++) {
          const p = chain[i]
          const dx = p.x - cx
          const dy = p.y - cy
          const dz = p.z - cz
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1e-8
          if (dist < radius) {
            const scale = radius / dist
            p.x = cx + dx * scale
            p.y = cy + dy * scale
            p.z = cz + dz * scale
          }
        }
      }
    }
  }

  getStrands(): Strand[] {
    return this._chains.map(chain => ({
      points: chain.map(p => [p.x, p.y, p.z] as [number, number, number]),
    }))
  }

  resetTo(strands: Strand[]): void {
    this._chains = []
    this._roots  = []
    for (const strand of strands) {
      const pts = strand.points
      this._roots.push([pts[0][0], pts[0][1], pts[0][2]])
      const chain: Particle[] = []
      for (let i = 0; i < pts.length; i++) {
        const [x, y, z] = pts[i]
        let restDist = 0
        if (i < pts.length - 1) {
          const [nx, ny, nz] = pts[i + 1]
          const dx = nx - x, dy = ny - y, dz = nz - z
          restDist = Math.sqrt(dx*dx + dy*dy + dz*dz)
        }
        chain.push({ x, y, z, px: x, py: y, pz: z, restDist })
      }
      this._chains.push(chain)
    }
  }

  setCollisionSphere(cx: number, cy: number, cz: number, radius: number): void {
    this._collision = [cx, cy, cz, radius]
  }
}
