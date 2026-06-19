import { Vector3 }       from 'three'
import { BaseForce }     from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

export interface BoidObstacle {
  position: Vector3
  radius:   number
}

/**
 * Boids flocking AI — implements the classic separation / alignment / cohesion
 * rules plus Blender Boids panel extras (stubbed as numeric params for GSAP).
 *
 * Inject the live pool reference so the force can read neighbour state each tick.
 * Use ParticleSystem.pool as the source:
 *
 *   const boid = new BoidForce(sys.pool)
 *   sys.addForce(boid)
 *
 * Blender parallel: Boids physics type.
 */
export class BoidForce extends BaseForce {
  parameters: Record<string, number>

  private readonly _pool: Particle[]

  /** Live obstacle list — can be mutated at runtime. */
  obstacles: BoidObstacle[] = []

  constructor(pool: Particle[], opts: {
    separationRadius?:   number
    separationStrength?: number
    alignmentRadius?:    number
    alignmentStrength?:  number
    cohesionRadius?:     number
    cohesionStrength?:   number
    maxSpeed?:           number
    maxForce?:           number
    separationWeight?:   number
    alignmentWeight?:    number
    cohesionWeight?:     number
    avoidWeight?:        number
    avoidRadius?:        number
    flightHeight?:       number
    bankingAngle?:       number
    pitchAngle?:         number
    obstacles?:          BoidObstacle[]
    // Leader following (Blender: Boids → Follow Leader)
    leaderIndex?:        number
    leaderWeight?:       number
    leaderRadius?:       number
    // Ground walking mode (Blender: Boids → Land)
    groundMode?:         number
    groundLevel?:        number
    groundStrength?:     number
    // Collision stiffness (Blender: Boids → Stiffness)
    collisionRadius?:    number
    collisionStiffness?: number
  } = {}) {
    super()
    this._pool = pool
    if (opts.obstacles) this.obstacles = opts.obstacles
    this.parameters = {
      separationRadius:   opts.separationRadius   ?? 0.5,
      separationStrength: opts.separationStrength ?? 2.0,
      alignmentRadius:    opts.alignmentRadius    ?? 1.5,
      alignmentStrength:  opts.alignmentStrength  ?? 1.0,
      cohesionRadius:     opts.cohesionRadius     ?? 2.0,
      cohesionStrength:   opts.cohesionStrength   ?? 0.8,
      maxSpeed:           opts.maxSpeed           ?? 5.0,
      maxForce:           opts.maxForce           ?? 3.0,
      separationWeight:   opts.separationWeight   ?? 0,
      alignmentWeight:    opts.alignmentWeight    ?? 0,
      cohesionWeight:     opts.cohesionWeight     ?? 0,
      avoidWeight:        opts.avoidWeight        ?? 1.0,
      avoidRadius:        opts.avoidRadius        ?? 2.0,
      flightHeight:       opts.flightHeight       ?? 0,
      bankingAngle:       opts.bankingAngle       ?? 0,
      pitchAngle:         opts.pitchAngle         ?? 0,
      // Leader following
      leaderIndex:        opts.leaderIndex        ?? -1,
      leaderWeight:       opts.leaderWeight       ?? 1.0,
      leaderRadius:       opts.leaderRadius       ?? 5.0,
      // Ground walking
      groundMode:         opts.groundMode         ?? 0,
      groundLevel:        opts.groundLevel        ?? 0,
      groundStrength:     opts.groundStrength     ?? 3.0,
      // Collision stiffness
      collisionRadius:    opts.collisionRadius    ?? 0,
      collisionStiffness: opts.collisionStiffness ?? 5.0,
    }
  }

  apply(particle: Particle, dt: number): void {
    const p = this.parameters
    if (!particle.alive) return

    // Accumulators for each rule — three passes in one loop
    let sepX = 0, sepY = 0, sepZ = 0, sepN = 0
    let aliX = 0, aliY = 0, aliZ = 0, aliN = 0
    let cohX = 0, cohY = 0, cohZ = 0, cohN = 0

    const px = particle.position.x
    const py = particle.position.y
    const pz = particle.position.z

    const sepR2 = p.separationRadius * p.separationRadius
    const aliR2 = p.alignmentRadius  * p.alignmentRadius
    const cohR2 = p.cohesionRadius   * p.cohesionRadius

    for (let i = 0; i < this._pool.length; i++) {
      const n = this._pool[i]
      if (!n.alive || n === particle) continue

      const dx = n.position.x - px
      const dy = n.position.y - py
      const dz = n.position.z - pz
      const r2 = dx * dx + dy * dy + dz * dz

      // Separation — repel when inside separationRadius
      if (r2 < sepR2 && r2 > 1e-8) {
        const r   = Math.sqrt(r2)
        const inv = 1 / r
        // Push away (negate direction toward neighbour)
        sepX -= dx * inv
        sepY -= dy * inv
        sepZ -= dz * inv
        sepN++
      }

      // Alignment — average neighbour velocity
      if (r2 < aliR2) {
        aliX += n.velocity.x
        aliY += n.velocity.y
        aliZ += n.velocity.z
        aliN++
      }

      // Cohesion — average neighbour position
      if (r2 < cohR2) {
        cohX += n.position.x
        cohY += n.position.y
        cohZ += n.position.z
        cohN++
      }
    }

    // Accumulate force contributions
    let fx = 0, fy = 0, fz = 0

    if (sepN > 0) {
      const inv = 1 / sepN
      fx += sepX * inv * p.separationStrength
      fy += sepY * inv * p.separationStrength
      fz += sepZ * inv * p.separationStrength
    }

    if (aliN > 0) {
      const inv = 1 / aliN
      fx += (aliX * inv - particle.velocity.x) * p.alignmentStrength
      fy += (aliY * inv - particle.velocity.y) * p.alignmentStrength
      fz += (aliZ * inv - particle.velocity.z) * p.alignmentStrength
    }

    if (cohN > 0) {
      const inv = 1 / cohN
      fx += (cohX * inv - px) * p.cohesionStrength
      fy += (cohY * inv - py) * p.cohesionStrength
      fz += (cohZ * inv - pz) * p.cohesionStrength
    }

    // ── Leader following ────────────────────────────────────────────────────
    const leaderIdx = Math.round(p.leaderIndex)
    if (leaderIdx >= 0 && leaderIdx < this._pool.length && p.leaderWeight > 0) {
      const leader = this._pool[leaderIdx]
      if (leader.alive && leader !== particle) {
        const ldx = leader.position.x - px
        const ldy = leader.position.y - py
        const ldz = leader.position.z - pz
        const lDist2 = ldx * ldx + ldy * ldy + ldz * ldz
        const lR2    = p.leaderRadius * p.leaderRadius
        if (lDist2 < lR2) {
          // Steer toward leader — cohesion-like pull weighted by proximity
          const proximity = 1 - Math.sqrt(lDist2) / p.leaderRadius
          fx += ldx * p.leaderWeight * proximity
          fy += ldy * p.leaderWeight * proximity
          fz += ldz * p.leaderWeight * proximity
        }
      }
    }

    // ── Boid-boid collision stiffness ────────────────────────────────────────
    if (p.collisionRadius > 0 && p.collisionStiffness > 0) {
      const cr2 = p.collisionRadius * p.collisionRadius
      for (let i = 0; i < this._pool.length; i++) {
        const n = this._pool[i]
        if (!n.alive || n === particle) continue
        const cdx = px - n.position.x
        const cdy = py - n.position.y
        const cdz = pz - n.position.z
        const cr2d = cdx * cdx + cdy * cdy + cdz * cdz
        if (cr2d < cr2 && cr2d > 1e-10) {
          const dist      = Math.sqrt(cr2d)
          const overlap   = p.collisionRadius - dist
          const stiffness = p.collisionStiffness * overlap / dist
          fx += cdx * stiffness
          fy += cdy * stiffness
          fz += cdz * stiffness
        }
      }
    }

    // ── Obstacle avoidance ──────────────────────────────────────────────────
    if (this.obstacles.length > 0 && p.avoidWeight > 0) {
      const avoidR = p.avoidRadius
      const avoidW = p.avoidWeight
      for (let o = 0; o < this.obstacles.length; o++) {
        const obs  = this.obstacles[o]
        const totalR = avoidR + obs.radius
        const odx = px - obs.position.x
        const ody = py - obs.position.y
        const odz = pz - obs.position.z
        const odist2 = odx * odx + ody * ody + odz * odz
        if (odist2 < totalR * totalR && odist2 > 1e-10) {
          const odist = Math.sqrt(odist2)
          // Scale force by how close the particle is to the obstacle surface
          const proximity = 1 - odist / totalR
          const steer = avoidW * proximity / odist
          fx += odx * steer
          fy += ody * steer
          fz += odz * steer
        }
      }
    }

    // ── Flight height restoring force ───────────────────────────────────────
    if (p.flightHeight !== 0) {
      fy += (p.flightHeight - py) * 0.5
    }

    // Clamp force magnitude
    const fMag2 = fx * fx + fy * fy + fz * fz
    const maxF2 = p.maxForce * p.maxForce
    if (fMag2 > maxF2 && fMag2 > 1e-12) {
      const scale = p.maxForce / Math.sqrt(fMag2)
      fx *= scale
      fy *= scale
      fz *= scale
    }

    // Apply force: dv = F * dt
    particle.velocity.x += fx * dt
    particle.velocity.y += fy * dt
    particle.velocity.z += fz * dt

    // Clamp speed
    const vMag2 = particle.velocity.x ** 2 + particle.velocity.y ** 2 + particle.velocity.z ** 2
    const maxV2 = p.maxSpeed * p.maxSpeed
    if (vMag2 > maxV2 && vMag2 > 1e-12) {
      const scale = p.maxSpeed / Math.sqrt(vMag2)
      particle.velocity.x *= scale
      particle.velocity.y *= scale
      particle.velocity.z *= scale
    }

    // ── Banking / pitch (cosmetic rotation only) ────────────────────────────
    if (p.bankingAngle !== 0) {
      // Lateral acceleration ≈ change in horizontal velocity direction
      // Proxy: cross product of current horizontal velocity with world-up gives lateral
      const vx = particle.velocity.x, vz = particle.velocity.z
      const speed2d = Math.sqrt(vx * vx + vz * vz)
      if (speed2d > 0.01) {
        // Signed lateral tilt: use fx (left/right force) scaled by bankingAngle
        particle.rotation.z = -Math.atan2(fx, p.maxForce) * p.bankingAngle
      }
    }

    if (p.pitchAngle !== 0) {
      const vy = particle.velocity.y
      particle.rotation.x = Math.atan2(vy, Math.max(0.01, p.maxSpeed)) * p.pitchAngle
    }

    // ── Ground walking mode ──────────────────────────────────────────────────
    if (p.groundMode >= 0.5) {
      // Restoring force pushes particle toward groundLevel
      particle.velocity.y += (p.groundLevel - particle.position.y) * p.groundStrength * dt
      // Suppress strong vertical velocity so boids stay near the ground
      particle.velocity.y *= Math.max(0, 1 - 0.8 * dt)
      // Align rotation.x to zero (flat ground orientation)
      particle.rotation.x *= Math.max(0, 1 - 5 * dt)
    }
  }
}
