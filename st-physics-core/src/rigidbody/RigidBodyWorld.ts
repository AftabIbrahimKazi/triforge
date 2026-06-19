import { Vector3, Quaternion } from 'three'
import type { AnyConstraint } from './RigidBodyConstraints.js'

export type RigidBodyShape = 'sphere' | 'box' | 'capsule'

export interface RigidBodyOptions {
  /** Collision shape. Default 'sphere'. */
  shape?: RigidBodyShape
  /** Mass in kg. 0 = static/kinematic. Blender: Physics > Mass. Default 1. */
  mass?: number
  /** Shape half-extents [hx,hy,hz] for 'box'; radius for 'sphere'/'capsule'. Default 0.5. */
  size?: number | [number, number, number]
  /** Capsule half-height (along Y) for 'capsule' shape. Default 1.0. */
  halfHeight?: number
  /** Linear velocity damping [0–1]. Blender: Physics > Damping > Translation. Default 0.01. */
  linearDamping?: number
  /** Angular velocity damping [0–1]. Blender: Physics > Damping > Rotation. Default 0.05. */
  angularDamping?: number
  /** Bounciness [0–1]. Blender: Physics > Restitution. Default 0.3. */
  restitution?: number
  /** Initial position [x,y,z]. */
  position?: [number, number, number]
  /** Initial velocity [x,y,z]. */
  velocity?: [number, number, number]
}

/**
 * RigidBody — a single rigid-body object managed by RigidBodyWorld.
 *
 * All scalar physics parameters live in `parameters` for GSAP/st-keyframe:
 *   gsap.to(body.parameters, { restitution: 1, duration: 0.5 })
 */
export class RigidBody {
  readonly shape: RigidBodyShape

  /** Scalar parameters — GSAP/st-keyframe compatible. */
  parameters: {
    mass:           number
    linearDamping:  number
    angularDamping: number
    restitution:    number
    sizeX:          number
    sizeY:          number
    sizeZ:          number
    halfHeight:     number
  }

  position:    Vector3
  velocity:    Vector3
  orientation: Quaternion
  angularVel:  Vector3

  /** Accumulated force for this step. */
  private _force: Vector3 = new Vector3()
  /** Accumulated torque for this step. */
  private _torque: Vector3 = new Vector3()

  /** Set to true to prevent the body from moving (kinematic/static). */
  isStatic: boolean

  constructor(opts: RigidBodyOptions = {}) {
    this.shape = opts.shape ?? 'sphere'
    const mass = opts.mass ?? 1

    let sx: number, sy: number, sz: number
    if (Array.isArray(opts.size)) {
      ;[sx, sy, sz] = opts.size as [number,number,number]
    } else {
      sx = sy = sz = (opts.size as number | undefined) ?? 0.5
    }

    this.parameters = {
      mass:           mass,
      linearDamping:  opts.linearDamping  ?? 0.01,
      angularDamping: opts.angularDamping ?? 0.05,
      restitution:    opts.restitution    ?? 0.3,
      sizeX:          sx,
      sizeY:          sy,
      sizeZ:          sz,
      halfHeight:     opts.halfHeight ?? 1.0,
    }

    const p = opts.position ?? [0, 0, 0]
    const v = opts.velocity ?? [0, 0, 0]

    this.position    = new Vector3(p[0], p[1], p[2])
    this.velocity    = new Vector3(v[0], v[1], v[2])
    this.orientation = new Quaternion()
    this.angularVel  = new Vector3()
    this.isStatic    = mass === 0
  }

  /** Apply a force (N) at the body's centre of mass. */
  applyForce(fx: number, fy: number, fz: number): void {
    if (this.isStatic) return
    this._force.x += fx; this._force.y += fy; this._force.z += fz
  }

  /** Apply an instantaneous impulse (kg·m/s). */
  applyImpulse(ix: number, iy: number, iz: number): void {
    if (this.isStatic) return
    const invMass = 1 / Math.max(0.0001, this.parameters.mass)
    this.velocity.x += ix * invMass
    this.velocity.y += iy * invMass
    this.velocity.z += iz * invMass
  }

  /** Apply a torque impulse (kg·m²/s). */
  applyTorqueImpulse(tx: number, ty: number, tz: number): void {
    if (this.isStatic) return
    this.angularVel.x += tx
    this.angularVel.y += ty
    this.angularVel.z += tz
  }

  /** Consume and reset accumulated forces. Returns force vector. */
  _consumeForce(): Vector3 {
    const f = this._force.clone()
    this._force.set(0, 0, 0)
    return f
  }

  _consumeTorque(): Vector3 {
    const t = this._torque.clone()
    this._torque.set(0, 0, 0)
    return t
  }

  /**
   * Approximate bounding radius (for broad-phase).
   */
  get boundingRadius(): number {
    const { sizeX, sizeY, sizeZ, halfHeight } = this.parameters
    if (this.shape === 'sphere') return sizeX
    if (this.shape === 'capsule') return sizeX + halfHeight
    return Math.sqrt(sizeX*sizeX + sizeY*sizeY + sizeZ*sizeZ)
  }
}

export interface RigidBodyWorldOptions {
  /** Gravity [x,y,z]. Blender: Scene > Gravity. Default [0,-9.8,0]. */
  gravity?: [number, number, number]
  /** Substeps per frame. Higher = more stable. Default 4. */
  substeps?: number
}

/**
 * RigidBodyWorld — Blender-matched rigid body simulation.
 * Blender: Rigid Body World (Scene Properties).
 *
 * Impulse-based solver with sphere/box/capsule collision shapes.
 * Supports plane floor, body–body overlap resolution, gravity.
 *
 * Usage:
 * ```typescript
 * const world = new RigidBodyWorld({ gravity: [0,-9.8,0] })
 * const ball  = world.createBody({ shape: 'sphere', mass: 1, position: [0,5,0] })
 * const floor = world.createBody({ shape: 'box', mass: 0, size: [10,0.1,10] })
 *
 * // In animation loop:
 * world.step(dt)
 * mesh.position.copy(ball.position)
 * mesh.quaternion.copy(ball.orientation)
 * ```
 */
export class RigidBodyWorld {
  /** World gravity vector. GSAP-driveable via `parameters`. */
  parameters: {
    gravityX: number
    gravityY: number
    gravityZ: number
    substeps:  number
  }

  private _bodies: RigidBody[] = []
  private _constraints: AnyConstraint[] = []

  /** Simulation clock. */
  time = 0

  constructor(opts: RigidBodyWorldOptions = {}) {
    const g = opts.gravity ?? [0, -9.8, 0]
    this.parameters = {
      gravityX: g[0],
      gravityY: g[1],
      gravityZ: g[2],
      substeps:  opts.substeps ?? 4,
    }
  }

  /**
   * Create a new rigid body and add it to the world.
   */
  createBody(opts: RigidBodyOptions = {}): RigidBody {
    const body = new RigidBody(opts)
    this._bodies.push(body)
    return body
  }

  /**
   * Remove a body from the world.
   */
  removeBody(body: RigidBody): void {
    const i = this._bodies.indexOf(body)
    if (i !== -1) this._bodies.splice(i, 1)
  }

  /** All active bodies. */
  get bodies(): readonly RigidBody[] { return this._bodies }

  /** Add a constraint to the world. */
  addConstraint(c: AnyConstraint): void { this._constraints.push(c) }

  /** Remove a constraint. */
  removeConstraint(c: AnyConstraint): void {
    const i = this._constraints.indexOf(c)
    if (i !== -1) this._constraints.splice(i, 1)
  }

  /** All active constraints. */
  get constraints(): readonly AnyConstraint[] { return this._constraints }

  /**
   * Advance the simulation by dt seconds.
   * Call once per animation frame (dt ≈ 1/60).
   */
  step(dt: number): void {
    this.time += dt
    const sub = Math.max(1, Math.round(this.parameters.substeps))
    const subDt = dt / sub
    for (let s = 0; s < sub; s++) this._substep(subDt)
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _substep(dt: number): void {
    const gx = this.parameters.gravityX
    const gy = this.parameters.gravityY
    const gz = this.parameters.gravityZ

    // Integrate velocities + positions
    for (const b of this._bodies) {
      if (b.isStatic) continue

      const invMass = 1 / Math.max(0.0001, b.parameters.mass)
      const ld = 1 - b.parameters.linearDamping
      const ad = 1 - b.parameters.angularDamping

      // Gravity + user forces
      const f = b._consumeForce()
      b.velocity.x = (b.velocity.x + (gx + f.x * invMass) * dt) * ld
      b.velocity.y = (b.velocity.y + (gy + f.y * invMass) * dt) * ld
      b.velocity.z = (b.velocity.z + (gz + f.z * invMass) * dt) * ld

      // Angular velocity
      const tq = b._consumeTorque()
      b.angularVel.x = (b.angularVel.x + tq.x * invMass * dt) * ad
      b.angularVel.y = (b.angularVel.y + tq.y * invMass * dt) * ad
      b.angularVel.z = (b.angularVel.z + tq.z * invMass * dt) * ad

      // Integrate position
      b.position.x += b.velocity.x * dt
      b.position.y += b.velocity.y * dt
      b.position.z += b.velocity.z * dt

      // Integrate orientation using angular velocity
      if (b.angularVel.lengthSq() > 1e-10) {
        const angle = b.angularVel.length() * dt
        const axis  = b.angularVel.clone().normalize()
        const dq    = new Quaternion().setFromAxisAngle(axis, angle)
        b.orientation.premultiply(dq).normalize()
      }
    }

    // Collision resolution (narrow phase)
    this._resolveCollisions()

    // Constraint solving
    for (const c of this._constraints) c.solve()
  }

  private _resolveCollisions(): void {
    // Body–body collisions (O(n²) broad+narrow phase)
    for (let i = 0; i < this._bodies.length; i++) {
      for (let j = i + 1; j < this._bodies.length; j++) {
        this._resolveBodyPair(this._bodies[i], this._bodies[j])
      }
    }
  }

  private _resolveBodyPair(a: RigidBody, b: RigidBody): void {
    if (a.isStatic && b.isStatic) return

    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const dz = b.position.z - a.position.z
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)

    // Approximate collision using bounding spheres first
    const sumR = a.boundingRadius + b.boundingRadius
    if (dist >= sumR) return

    // Narrow phase by shape pair
    const pen = this._penetrationDepth(a, b, dist)
    if (pen <= 0) return

    const nx = dist > 1e-8 ? dx / dist : 0
    const ny = dist > 1e-8 ? dy / dist : 1
    const nz = dist > 1e-8 ? dz / dist : 0

    // Positional correction
    const totalMass = (a.isStatic ? 0 : a.parameters.mass) + (b.isStatic ? 0 : b.parameters.mass)
    if (totalMass <= 0) return

    const wa = a.isStatic ? 0 : b.parameters.mass / totalMass
    const wb = b.isStatic ? 0 : a.parameters.mass / totalMass
    const slop = 0.001  // penetration allowance

    const corr = Math.max(pen - slop, 0) * 0.8
    if (!a.isStatic) {
      a.position.x -= nx * corr * wa
      a.position.y -= ny * corr * wa
      a.position.z -= nz * corr * wa
    }
    if (!b.isStatic) {
      b.position.x += nx * corr * wb
      b.position.y += ny * corr * wb
      b.position.z += nz * corr * wb
    }

    // Velocity resolution (impulse)
    const relVx = b.velocity.x - a.velocity.x
    const relVy = b.velocity.y - a.velocity.y
    const relVz = b.velocity.z - a.velocity.z
    const relVn = relVx*nx + relVy*ny + relVz*nz

    if (relVn >= 0) return  // already separating

    const e = Math.min(a.parameters.restitution, b.parameters.restitution)
    const mA = a.isStatic ? 0 : 1 / a.parameters.mass
    const mB = b.isStatic ? 0 : 1 / b.parameters.mass
    const j  = -(1 + e) * relVn / (mA + mB)

    if (!a.isStatic) {
      a.velocity.x -= j * nx * mA
      a.velocity.y -= j * ny * mA
      a.velocity.z -= j * nz * mA
    }
    if (!b.isStatic) {
      b.velocity.x += j * nx * mB
      b.velocity.y += j * ny * mB
      b.velocity.z += j * nz * mB
    }
  }

  /** Returns penetration depth (> 0 means penetrating) for shape pair. */
  private _penetrationDepth(a: RigidBody, b: RigidBody, dist: number): number {
    // Sphere–sphere
    if (a.shape === 'sphere' && b.shape === 'sphere') {
      return a.parameters.sizeX + b.parameters.sizeX - dist
    }
    // Sphere–box (AABB in world-space, unrotated approximation)
    if (a.shape === 'sphere' && b.shape === 'box') return this._sphereBoxPen(a, b)
    if (a.shape === 'box' && b.shape === 'sphere') return this._sphereBoxPen(b, a)
    // Box–box (AABB)
    if (a.shape === 'box' && b.shape === 'box') return this._boxBoxPen(a, b)
    // Capsule–sphere
    if (a.shape === 'capsule' && b.shape === 'sphere') return this._capsuleSpherePen(a, b)
    if (a.shape === 'sphere' && b.shape === 'capsule') return this._capsuleSpherePen(b, a)
    // Fallback: bounding sphere
    return a.boundingRadius + b.boundingRadius - dist
  }

  private _sphereBoxPen(sphere: RigidBody, box: RigidBody): number {
    const r  = sphere.parameters.sizeX
    const hx = box.parameters.sizeX
    const hy = box.parameters.sizeY
    const hz = box.parameters.sizeZ
    const dx = Math.max(0, Math.abs(sphere.position.x - box.position.x) - hx)
    const dy = Math.max(0, Math.abs(sphere.position.y - box.position.y) - hy)
    const dz = Math.max(0, Math.abs(sphere.position.z - box.position.z) - hz)
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
    return r - dist
  }

  private _boxBoxPen(a: RigidBody, b: RigidBody): number {
    const ox = Math.abs(a.position.x - b.position.x) - (a.parameters.sizeX + b.parameters.sizeX)
    const oy = Math.abs(a.position.y - b.position.y) - (a.parameters.sizeY + b.parameters.sizeY)
    const oz = Math.abs(a.position.z - b.position.z) - (a.parameters.sizeZ + b.parameters.sizeZ)
    return -Math.max(ox, oy, oz)
  }

  private _capsuleSpherePen(capsule: RigidBody, sphere: RigidBody): number {
    const r  = capsule.parameters.sizeX + sphere.parameters.sizeX
    const hh = capsule.parameters.halfHeight
    // Closest point on capsule segment (vertical, unrotated) to sphere centre
    const localY = Math.max(-hh, Math.min(hh, sphere.position.y - capsule.position.y))
    const dx = sphere.position.x - capsule.position.x
    const dy = sphere.position.y - (capsule.position.y + localY)
    const dz = sphere.position.z - capsule.position.z
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
    return r - dist
  }
}
