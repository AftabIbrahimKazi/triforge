import { Vector3, Quaternion } from 'three'
import type { RigidBody } from './RigidBodyWorld.js'

// ── Constraint types ─────────────────────────────────────────────────────────

/**
 * FixedConstraint — locks two bodies together at an anchor point.
 * Blender: Rigid Body Constraint > Fixed.
 *
 * Corrects both position and relative velocity to keep bodies at their
 * initial relative transform.
 */
export class FixedConstraint {
  readonly type = 'fixed'
  parameters: { stiffness: number; damping: number }

  readonly bodyA: RigidBody
  readonly bodyB: RigidBody

  private _restOffset: Vector3
  enabled = true

  constructor(a: RigidBody, b: RigidBody, opts: { stiffness?: number; damping?: number } = {}) {
    this.bodyA = a
    this.bodyB = b
    this.parameters = {
      stiffness: opts.stiffness ?? 0.8,
      damping:   opts.damping   ?? 0.1,
    }
    // Capture initial relative offset
    this._restOffset = new Vector3().subVectors(b.position, a.position)
  }

  solve(): void {
    if (!this.enabled) return
    const { stiffness, damping } = this.parameters
    const a = this.bodyA, b = this.bodyB

    // Current offset
    const dx = b.position.x - a.position.x - this._restOffset.x
    const dy = b.position.y - a.position.y - this._restOffset.y
    const dz = b.position.z - a.position.z - this._restOffset.z

    const mA = a.isStatic ? 0 : 1 / a.parameters.mass
    const mB = b.isStatic ? 0 : 1 / b.parameters.mass
    const total = mA + mB
    if (total < 1e-12) return

    const wA = mA / total, wB = mB / total
    const k  = stiffness

    if (!a.isStatic) {
      a.position.x += dx * wA * k
      a.position.y += dy * wA * k
      a.position.z += dz * wA * k
    }
    if (!b.isStatic) {
      b.position.x -= dx * wB * k
      b.position.y -= dy * wB * k
      b.position.z -= dz * wB * k
    }

    // Velocity damping toward shared average
    const relVx = b.velocity.x - a.velocity.x
    const relVy = b.velocity.y - a.velocity.y
    const relVz = b.velocity.z - a.velocity.z
    const d = damping
    if (!a.isStatic) {
      a.velocity.x += relVx * wA * d
      a.velocity.y += relVy * wA * d
      a.velocity.z += relVz * wA * d
    }
    if (!b.isStatic) {
      b.velocity.x -= relVx * wB * d
      b.velocity.y -= relVy * wB * d
      b.velocity.z -= relVz * wB * d
    }
  }
}

/**
 * HingeConstraint — allows rotation around one axis only.
 * Blender: Rigid Body Constraint > Hinge.
 *
 * Constrains the bodies to a shared pivot; lateral position is locked,
 * leaving only rotation about the hinge axis free.
 */
export class HingeConstraint {
  readonly type = 'hinge'
  parameters: {
    stiffness: number
    damping:   number
    useLimits: boolean
    limitMin:  number
    limitMax:  number
  }

  readonly bodyA: RigidBody
  readonly bodyB: RigidBody

  private _pivot: Vector3
  enabled = true

  constructor(
    a: RigidBody,
    b: RigidBody,
    pivot: [number, number, number],
    opts: {
      stiffness?:  number
      damping?:    number
      useLimits?:  boolean
      limitMin?:   number
      limitMax?:   number
    } = {},
  ) {
    this.bodyA   = a
    this.bodyB   = b
    this._pivot  = new Vector3(...pivot)
    this.parameters = {
      stiffness: opts.stiffness ?? 0.8,
      damping:   opts.damping   ?? 0.1,
      useLimits: opts.useLimits ?? false,
      limitMin:  opts.limitMin  ?? -Math.PI,
      limitMax:  opts.limitMax  ??  Math.PI,
    }
  }

  /** World-space pivot point. */
  get pivot(): Vector3 { return this._pivot }
  set pivot(v: Vector3) { this._pivot.copy(v) }

  solve(): void {
    if (!this.enabled) return
    const { stiffness, damping } = this.parameters

    const a = this.bodyA, b = this.bodyB

    // Pull both bodies toward the pivot
    const mA = a.isStatic ? 0 : 1 / a.parameters.mass
    const mB = b.isStatic ? 0 : 1 / b.parameters.mass
    const total = mA + mB
    if (total < 1e-12) return

    const wA = mA / total, wB = mB / total

    if (!a.isStatic) {
      const eax = this._pivot.x - a.position.x
      const eay = this._pivot.y - a.position.y
      const eaz = this._pivot.z - a.position.z
      a.position.x += eax * wA * stiffness
      a.position.y += eay * wA * stiffness
      a.position.z += eaz * wA * stiffness
    }
    if (!b.isStatic) {
      const ebx = this._pivot.x - b.position.x
      const eby = this._pivot.y - b.position.y
      const ebz = this._pivot.z - b.position.z
      b.position.x += ebx * wB * stiffness
      b.position.y += eby * wB * stiffness
      b.position.z += ebz * wB * stiffness
    }

    // Relative tangential velocity damping (allow rotation, damp lateral slip)
    const relVx = b.velocity.x - a.velocity.x
    const relVy = b.velocity.y - a.velocity.y
    const relVz = b.velocity.z - a.velocity.z
    const d = damping
    if (!a.isStatic) {
      a.velocity.x += relVx * wA * d
      a.velocity.y += relVy * wA * d
      a.velocity.z += relVz * wA * d
    }
    if (!b.isStatic) {
      b.velocity.x -= relVx * wB * d
      b.velocity.y -= relVy * wB * d
      b.velocity.z -= relVz * wB * d
    }
  }
}

/**
 * SliderConstraint — allows translation along one axis only.
 * Blender: Rigid Body Constraint > Slider.
 *
 * Bodies can slide toward/away from each other along the axis,
 * but are constrained laterally. Optional limits clamp the travel range.
 */
export class SliderConstraint {
  readonly type = 'slider'
  parameters: {
    stiffness: number
    damping:   number
    useLimits: boolean
    limitMin:  number
    limitMax:  number
  }

  readonly bodyA: RigidBody
  readonly bodyB: RigidBody

  private _axis: Vector3
  enabled = true

  constructor(
    a: RigidBody,
    b: RigidBody,
    axis: [number, number, number],
    opts: {
      stiffness?: number
      damping?:   number
      useLimits?: boolean
      limitMin?:  number
      limitMax?:  number
    } = {},
  ) {
    this.bodyA  = a
    this.bodyB  = b
    this._axis  = new Vector3(...axis).normalize()
    this.parameters = {
      stiffness: opts.stiffness ?? 0.8,
      damping:   opts.damping   ?? 0.1,
      useLimits: opts.useLimits ?? false,
      limitMin:  opts.limitMin  ?? -Infinity,
      limitMax:  opts.limitMax  ??  Infinity,
    }
  }

  /** Slider axis (world-space unit vector). */
  get axis(): Vector3 { return this._axis }

  solve(): void {
    if (!this.enabled) return
    const { stiffness, damping } = this.parameters
    const a = this.bodyA, b = this.bodyB

    const mA = a.isStatic ? 0 : 1 / a.parameters.mass
    const mB = b.isStatic ? 0 : 1 / b.parameters.mass
    const total = mA + mB
    if (total < 1e-12) return

    const wA = mA / total, wB = mB / total

    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const dz = b.position.z - a.position.z

    // Project offset onto axis (this is the allowed DOF)
    const ax = this._axis.x, ay = this._axis.y, az = this._axis.z
    const along = dx*ax + dy*ay + dz*az

    // Clamp along-axis travel
    let clampedAlong = along
    if (this.parameters.useLimits) {
      clampedAlong = Math.max(this.parameters.limitMin, Math.min(this.parameters.limitMax, along))
    }

    // Lateral error = full offset - allowed axial part
    const lateralX = dx - along * ax
    const lateralY = dy - along * ay
    const lateralZ = dz - along * az

    // Axial limit correction
    const axialErr = along - clampedAlong

    const corrX = lateralX * stiffness + axialErr * ax * stiffness
    const corrY = lateralY * stiffness + axialErr * ay * stiffness
    const corrZ = lateralZ * stiffness + axialErr * az * stiffness

    if (!a.isStatic) {
      a.position.x += corrX * wA
      a.position.y += corrY * wA
      a.position.z += corrZ * wA
    }
    if (!b.isStatic) {
      b.position.x -= corrX * wB
      b.position.y -= corrY * wB
      b.position.z -= corrZ * wB
    }

    // Lateral velocity damping
    const relVx = b.velocity.x - a.velocity.x
    const relVy = b.velocity.y - a.velocity.y
    const relVz = b.velocity.z - a.velocity.z
    const latVx = relVx - (relVx*ax + relVy*ay + relVz*az) * ax
    const latVy = relVy - (relVx*ax + relVy*ay + relVz*az) * ay
    const latVz = relVz - (relVx*ax + relVy*ay + relVz*az) * az
    const d = damping
    if (!a.isStatic) {
      a.velocity.x += latVx * wA * d
      a.velocity.y += latVy * wA * d
      a.velocity.z += latVz * wA * d
    }
    if (!b.isStatic) {
      b.velocity.x -= latVx * wB * d
      b.velocity.y -= latVy * wB * d
      b.velocity.z -= latVz * wB * d
    }
  }
}

/**
 * SpringConstraint — elastic spring between two bodies.
 * Blender: Rigid Body Constraint > Generic Spring.
 */
export class SpringConstraint {
  readonly type = 'spring'
  parameters: {
    restLength: number
    stiffness:  number
    damping:    number
  }

  readonly bodyA: RigidBody
  readonly bodyB: RigidBody
  enabled = true

  constructor(
    a: RigidBody,
    b: RigidBody,
    opts: { restLength?: number; stiffness?: number; damping?: number } = {},
  ) {
    this.bodyA = a
    this.bodyB = b
    const defaultRest = a.position.distanceTo(b.position)
    this.parameters = {
      restLength: opts.restLength ?? defaultRest,
      stiffness:  opts.stiffness  ?? 10,
      damping:    opts.damping    ?? 0.5,
    }
  }

  solve(): void {
    if (!this.enabled) return
    const { restLength, stiffness, damping } = this.parameters
    const a = this.bodyA, b = this.bodyB

    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const dz = b.position.z - a.position.z
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
    if (dist < 1e-12) return

    const nx = dx/dist, ny = dy/dist, nz = dz/dist
    const stretch = dist - restLength

    const mA = a.isStatic ? 0 : 1 / a.parameters.mass
    const mB = b.isStatic ? 0 : 1 / b.parameters.mass
    const total = mA + mB
    if (total < 1e-12) return

    const relV = (b.velocity.x - a.velocity.x)*nx +
                 (b.velocity.y - a.velocity.y)*ny +
                 (b.velocity.z - a.velocity.z)*nz

    const force = stiffness * stretch + damping * relV
    const wA = mA / total, wB = mB / total

    if (!a.isStatic) {
      a.velocity.x += nx * force * wA
      a.velocity.y += ny * force * wA
      a.velocity.z += nz * force * wA
    }
    if (!b.isStatic) {
      b.velocity.x -= nx * force * wB
      b.velocity.y -= ny * force * wB
      b.velocity.z -= nz * force * wB
    }
  }
}

/**
 * BallSocketConstraint — locks two bodies at a shared pivot while allowing
 * free rotation in all directions.
 * Blender: Rigid Body Constraint > Ball.
 *
 * Only translational DOF is removed; all rotational DOF remain free.
 * Effectively a positional-only HingeConstraint with no angular restrictions.
 */
export class BallSocketConstraint {
  readonly type = 'ballsocket'
  parameters: { stiffness: number; damping: number }

  readonly bodyA: RigidBody
  readonly bodyB: RigidBody

  private _pivot: Vector3
  /** Local-space anchor offset from body A centre to pivot (captured at construction). */
  private _anchorA: Vector3
  /** Local-space anchor offset from body B centre to pivot (captured at construction). */
  private _anchorB: Vector3

  enabled = true

  constructor(
    a: RigidBody,
    b: RigidBody,
    pivot: [number, number, number],
    opts: { stiffness?: number; damping?: number } = {},
  ) {
    this.bodyA  = a
    this.bodyB  = b
    this._pivot = new Vector3(...pivot)
    this.parameters = {
      stiffness: opts.stiffness ?? 0.8,
      damping:   opts.damping   ?? 0.1,
    }
    // Record body-relative anchor offsets at rest pose
    this._anchorA = new Vector3().subVectors(this._pivot, a.position)
    this._anchorB = new Vector3().subVectors(this._pivot, b.position)
  }

  /** World-space pivot point. */
  get pivot(): Vector3 { return this._pivot }

  solve(): void {
    if (!this.enabled) return
    const { stiffness, damping } = this.parameters
    const a = this.bodyA, b = this.bodyB

    const mA = a.isStatic ? 0 : 1 / a.parameters.mass
    const mB = b.isStatic ? 0 : 1 / b.parameters.mass
    const total = mA + mB
    if (total < 1e-12) return

    const wA = mA / total, wB = mB / total

    // World-space anchor positions (apply orientation to local anchor)
    const worldAnchorA = this._anchorA.clone().applyQuaternion(a.orientation).add(a.position)
    const worldAnchorB = this._anchorB.clone().applyQuaternion(b.orientation).add(b.position)

    // Error = how far the two anchor points are apart
    const errX = worldAnchorB.x - worldAnchorA.x
    const errY = worldAnchorB.y - worldAnchorA.y
    const errZ = worldAnchorB.z - worldAnchorA.z

    if (!a.isStatic) {
      a.position.x += errX * wA * stiffness
      a.position.y += errY * wA * stiffness
      a.position.z += errZ * wA * stiffness
    }
    if (!b.isStatic) {
      b.position.x -= errX * wB * stiffness
      b.position.y -= errY * wB * stiffness
      b.position.z -= errZ * wB * stiffness
    }

    // Damp relative translational velocity
    const relVx = b.velocity.x - a.velocity.x
    const relVy = b.velocity.y - a.velocity.y
    const relVz = b.velocity.z - a.velocity.z
    const d = damping
    if (!a.isStatic) {
      a.velocity.x += relVx * wA * d
      a.velocity.y += relVy * wA * d
      a.velocity.z += relVz * wA * d
    }
    if (!b.isStatic) {
      b.velocity.x -= relVx * wB * d
      b.velocity.y -= relVy * wB * d
      b.velocity.z -= relVz * wB * d
    }
  }
}

/**
 * ConeTwistConstraint — ball-and-socket joint that also limits swing angle
 * (a cone) and twist angle around the primary axis.
 * Blender: Rigid Body Constraint > Cone Twist.
 *
 * Position constraint: same as BallSocketConstraint.
 * Swing constraint: body B's primary axis must stay within `swingLimit` of
 *   the constraint axis.
 * Twist constraint: body B's rotation around the constraint axis is clamped
 *   to ±`twistLimit`.
 */
export class ConeTwistConstraint {
  readonly type = 'conetwist'
  parameters: {
    stiffness:  number
    damping:    number
    swingLimit: number
    twistLimit: number
  }

  readonly bodyA: RigidBody
  readonly bodyB: RigidBody

  private _pivot:  Vector3
  private _axis:   Vector3
  private _anchorA: Vector3
  private _anchorB: Vector3

  enabled = true

  constructor(
    a: RigidBody,
    b: RigidBody,
    pivot: [number, number, number],
    axis:  [number, number, number],
    opts: {
      stiffness?:  number
      damping?:    number
      swingLimit?: number
      twistLimit?: number
    } = {},
  ) {
    this.bodyA  = a
    this.bodyB  = b
    this._pivot = new Vector3(...pivot)
    this._axis  = new Vector3(...axis).normalize()
    this.parameters = {
      stiffness:  opts.stiffness  ?? 0.8,
      damping:    opts.damping    ?? 0.1,
      swingLimit: opts.swingLimit ?? Math.PI / 4,
      twistLimit: opts.twistLimit ?? Math.PI / 6,
    }
    this._anchorA = new Vector3().subVectors(this._pivot, a.position)
    this._anchorB = new Vector3().subVectors(this._pivot, b.position)
  }

  /** World-space pivot point. */
  get pivot(): Vector3 { return this._pivot }

  /** World-space constraint axis (unit vector). */
  get axis(): Vector3 { return this._axis }

  solve(): void {
    if (!this.enabled) return
    const { stiffness, damping, swingLimit, twistLimit } = this.parameters
    const a = this.bodyA, b = this.bodyB

    const mA = a.isStatic ? 0 : 1 / a.parameters.mass
    const mB = b.isStatic ? 0 : 1 / b.parameters.mass
    const total = mA + mB
    if (total < 1e-12) return

    const wA = mA / total, wB = mB / total

    // ── 1. Position constraint (identical to BallSocket) ──────────────────────
    const worldAnchorA = this._anchorA.clone().applyQuaternion(a.orientation).add(a.position)
    const worldAnchorB = this._anchorB.clone().applyQuaternion(b.orientation).add(b.position)

    const errX = worldAnchorB.x - worldAnchorA.x
    const errY = worldAnchorB.y - worldAnchorA.y
    const errZ = worldAnchorB.z - worldAnchorA.z

    if (!a.isStatic) {
      a.position.x += errX * wA * stiffness
      a.position.y += errY * wA * stiffness
      a.position.z += errZ * wA * stiffness
    }
    if (!b.isStatic) {
      b.position.x -= errX * wB * stiffness
      b.position.y -= errY * wB * stiffness
      b.position.z -= errZ * wB * stiffness
    }

    // Damp relative translational velocity
    const relVx = b.velocity.x - a.velocity.x
    const relVy = b.velocity.y - a.velocity.y
    const relVz = b.velocity.z - a.velocity.z
    const d = damping
    if (!a.isStatic) {
      a.velocity.x += relVx * wA * d
      a.velocity.y += relVy * wA * d
      a.velocity.z += relVz * wA * d
    }
    if (!b.isStatic) {
      b.velocity.x -= relVx * wB * d
      b.velocity.y -= relVy * wB * d
      b.velocity.z -= relVz * wB * d
    }

    if (b.isStatic) return

    // ── 2. Swing constraint (positional) ──────────────────────────────────────
    // The swing angle is the angle between the constraint axis and the
    // direction from A to B. Clamp B's position to stay inside the cone.
    if (swingLimit < Math.PI) {
      const dirX = b.position.x - a.position.x
      const dirY = b.position.y - a.position.y
      const dirZ = b.position.z - a.position.z
      const dist = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ)

      if (dist > 1e-8) {
        const nx = dirX / dist, ny = dirY / dist, nz = dirZ / dist
        const ax = this._axis.x, ay = this._axis.y, az = this._axis.z
        const cosAngle = Math.max(-1, Math.min(1, nx*ax + ny*ay + nz*az))
        const swingAngle = Math.acos(cosAngle)

        if (swingAngle > swingLimit) {
          // Project direction onto the cone boundary
          // Decompose into axial + lateral components
          const axialDot = nx*ax + ny*ay + nz*az
          const latX = nx - axialDot * ax
          const latY = ny - axialDot * ay
          const latZ = nz - axialDot * az
          const latLen = Math.sqrt(latX*latX + latY*latY + latZ*latZ)

          let clampedX: number, clampedY: number, clampedZ: number
          if (latLen < 1e-8) {
            // Pointing directly opposite the axis — pick arbitrary lateral
            clampedX = ax; clampedY = ay; clampedZ = az
          } else {
            // Blend axial and lateral to sit on cone boundary
            const cosL = Math.cos(swingLimit)
            const sinL = Math.sin(swingLimit)
            clampedX = ax * cosL + (latX / latLen) * sinL
            clampedY = ay * cosL + (latY / latLen) * sinL
            clampedZ = az * cosL + (latZ / latLen) * sinL
          }

          const targetX = a.position.x + clampedX * dist
          const targetY = a.position.y + clampedY * dist
          const targetZ = a.position.z + clampedZ * dist

          const posErrX = targetX - b.position.x
          const posErrY = targetY - b.position.y
          const posErrZ = targetZ - b.position.z

          b.position.x += posErrX * stiffness
          b.position.y += posErrY * stiffness
          b.position.z += posErrZ * stiffness

          // Kill velocity component pushing outside the cone
          const velDotErr = b.velocity.x * posErrX + b.velocity.y * posErrY + b.velocity.z * posErrZ
          if (velDotErr < 0) {
            const errLen2 = posErrX*posErrX + posErrY*posErrY + posErrZ*posErrZ
            if (errLen2 > 1e-12) {
              const scale = velDotErr / errLen2
              b.velocity.x -= scale * posErrX
              b.velocity.y -= scale * posErrY
              b.velocity.z -= scale * posErrZ
            }
          }
        }
      }
    }
  }
}

export type AnyConstraint = FixedConstraint | HingeConstraint | SliderConstraint | SpringConstraint | BallSocketConstraint | ConeTwistConstraint
