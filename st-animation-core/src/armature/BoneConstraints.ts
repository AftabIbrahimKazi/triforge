import { Vector3, Quaternion, Matrix4, Euler } from 'three'
import { PoseBone } from './PoseBone.js'

/**
 * Common interface for all bone constraints.
 * Blender: Pose > Bone Constraints
 */
export interface BoneConstraint {
  parameters: Record<string, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackToConstraint
// ─────────────────────────────────────────────────────────────────────────────

export type TrackAxis = 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z'
export type UpAxis   = 'X' | 'Y' | 'Z'

export interface TrackToOptions {
  targetPosition: Vector3 | (() => Vector3)
  trackAxis?: TrackAxis
  upAxis?: UpAxis
  influence?: number
}

/**
 * TrackToConstraint — makes the bone point one of its local axes toward a world target.
 * Blender: Pose > Bone Constraints > Track To
 */
export class TrackToConstraint implements BoneConstraint {
  parameters: { influence: number }

  private _targetPosition: Vector3 | (() => Vector3)
  private _trackAxis: TrackAxis
  private _upAxis: UpAxis

  constructor(_bone: PoseBone, opts: TrackToOptions) {
    this._targetPosition = opts.targetPosition
    this._trackAxis      = opts.trackAxis ?? 'Y'
    this._upAxis         = opts.upAxis    ?? 'Z'
    this.parameters      = { influence: opts.influence ?? 1.0 }
  }

  /**
   * Apply the constraint.
   * @param bone             The bone to rotate.
   * @param parentWorldMatrix The bone's parent world matrix (used to get the bone's own world position).
   */
  apply(bone: PoseBone, parentWorldMatrix: Matrix4): void {
    const influence = Math.max(0, Math.min(1, this.parameters.influence))
    if (influence === 0) return

    // Resolve target world position
    const target = typeof this._targetPosition === 'function'
      ? this._targetPosition()
      : this._targetPosition

    // Bone world position = parentWorld × boneLocal translation
    const boneWorldPos = new Vector3().setFromMatrixPosition(bone.worldMatrix)

    // Direction from bone to target in world space
    const toTarget = target.clone().sub(boneWorldPos)
    if (toTarget.lengthSq() < 1e-12) return
    toTarget.normalize()

    // Map track axis to local unit vector
    const trackDir = _axisToVector(this._trackAxis)

    // Map up axis to local unit vector
    const upDir = _axisToVector(this._upAxis)

    // Build a rotation that aligns trackDir → toTarget
    // We also need to respect the up axis to prevent roll ambiguity.
    const desiredQ = _lookRotation(toTarget, trackDir, upDir)

    // Current bone rotation
    const currentQ = bone.getQuaternion()

    // Slerp by influence
    currentQ.slerp(desiredQ, influence)
    bone.setQuaternion(currentQ)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CopyRotationConstraint
// ─────────────────────────────────────────────────────────────────────────────

export interface CopyRotationOptions {
  influence?: number
  mix?:    'replace' | 'add'
  invert?: boolean
}

/**
 * CopyRotationConstraint — copies the world-space rotation from a source bone.
 * Blender: Pose > Bone Constraints > Copy Rotation
 */
export class CopyRotationConstraint implements BoneConstraint {
  /** mix: 0 = replace, 1 = add */
  parameters: { influence: number; mix: number; invert: number }

  private _sourceBone: PoseBone

  constructor(sourceBone: PoseBone, opts: CopyRotationOptions = {}) {
    this._sourceBone = sourceBone
    this.parameters  = {
      influence: opts.influence ?? 1.0,
      mix:       opts.mix === 'add' ? 1 : 0,
      invert:    opts.invert ? 1 : 0,
    }
  }

  apply(bone: PoseBone): void {
    const influence = Math.max(0, Math.min(1, this.parameters.influence))
    if (influence === 0) return

    // Extract source world rotation
    let sourceQ = new Quaternion().setFromRotationMatrix(this._sourceBone.worldMatrix)

    if (this.parameters.invert !== 0) {
      sourceQ.invert()
    }

    // Current rotation
    const currentQ = bone.getQuaternion()

    let targetQ: Quaternion
    if (this.parameters.mix !== 0) {
      // Add: multiply source onto current
      targetQ = currentQ.clone().multiply(sourceQ)
    } else {
      // Replace: use source directly
      targetQ = sourceQ.clone()
    }

    // Lerp by influence from current toward target
    currentQ.slerp(targetQ, influence)
    bone.setQuaternion(currentQ)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CopyLocationConstraint
// ─────────────────────────────────────────────────────────────────────────────

export interface CopyLocationOptions {
  influence?: number
  offset?:    boolean
  axes?:      [boolean, boolean, boolean]
}

/**
 * CopyLocationConstraint — copies the world-space position from a source bone.
 * Blender: Pose > Bone Constraints > Copy Location
 */
export class CopyLocationConstraint implements BoneConstraint {
  parameters: { influence: number; offset: number; axisX: number; axisY: number; axisZ: number }

  private _sourceBone: PoseBone

  constructor(sourceBone: PoseBone, opts: CopyLocationOptions = {}) {
    this._sourceBone = sourceBone
    const axes       = opts.axes ?? [true, true, true]
    this.parameters  = {
      influence: opts.influence ?? 1.0,
      offset:    opts.offset ? 1 : 0,
      axisX:     axes[0] ? 1 : 0,
      axisY:     axes[1] ? 1 : 0,
      axisZ:     axes[2] ? 1 : 0,
    }
  }

  apply(bone: PoseBone, parentWorldMatrix: Matrix4): void {
    const influence = Math.max(0, Math.min(1, this.parameters.influence))
    if (influence === 0) return

    // Source world position
    const srcWorld = new Vector3().setFromMatrixPosition(this._sourceBone.worldMatrix)

    // Current bone local position (what's already in parameters)
    const currentLocal = new Vector3(
      bone.parameters.locationX,
      bone.parameters.locationY,
      bone.parameters.locationZ,
    )

    // Convert source world → local space (inverse of parent world matrix)
    const parentInv    = parentWorldMatrix.clone().invert()
    const srcLocal     = srcWorld.clone().applyMatrix4(parentInv)

    // Apply axis masking
    const maskedSrc = new Vector3(
      this.parameters.axisX !== 0 ? srcLocal.x : currentLocal.x,
      this.parameters.axisY !== 0 ? srcLocal.y : currentLocal.y,
      this.parameters.axisZ !== 0 ? srcLocal.z : currentLocal.z,
    )

    // Offset mode: add source position to current; replace mode: use source position
    let targetLocal: Vector3
    if (this.parameters.offset !== 0) {
      targetLocal = new Vector3(
        this.parameters.axisX !== 0 ? currentLocal.x + maskedSrc.x : currentLocal.x,
        this.parameters.axisY !== 0 ? currentLocal.y + maskedSrc.y : currentLocal.y,
        this.parameters.axisZ !== 0 ? currentLocal.z + maskedSrc.z : currentLocal.z,
      )
    } else {
      targetLocal = maskedSrc
    }

    // Lerp by influence
    currentLocal.lerp(targetLocal, influence)

    bone.parameters.locationX = currentLocal.x
    bone.parameters.locationY = currentLocal.y
    bone.parameters.locationZ = currentLocal.z
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a Blender-style axis name to a local unit vector. */
function _axisToVector(axis: TrackAxis | UpAxis): Vector3 {
  switch (axis) {
    case  'X': return new Vector3( 1,  0,  0)
    case '-X': return new Vector3(-1,  0,  0)
    case  'Y': return new Vector3( 0,  1,  0)
    case '-Y': return new Vector3( 0, -1,  0)
    case  'Z': return new Vector3( 0,  0,  1)
    case '-Z': return new Vector3( 0,  0, -1)
    default:   return new Vector3( 0,  1,  0)
  }
}

/**
 * Build a quaternion that rotates so `localTrackDir` aligns with `worldTarget`,
 * with `localUpDir` kept as close to world-up as possible.
 *
 * This mirrors Three.js Object3D.lookAt() but generalized to any track/up axis.
 */
function _lookRotation(worldTarget: Vector3, localTrackDir: Vector3, localUpDir: Vector3): Quaternion {
  // We need: rotation R such that R * localTrackDir = worldTarget

  // Step 1: rotate localTrackDir → worldTarget
  const q1 = new Quaternion().setFromUnitVectors(localTrackDir, worldTarget)

  // After q1, the localUpDir is now:
  const rotatedUp = localUpDir.clone().applyQuaternion(q1)

  // We want to keep the world "up" hint perpendicular to worldTarget.
  // Use the standard approach: find the plane perpendicular to worldTarget,
  // project a world-up hint there, then compute the twist correction.
  const worldUp = new Vector3(0, 1, 0)
  // If worldTarget is nearly parallel to worldUp, use world Z as the hint
  const upHint = Math.abs(worldTarget.dot(worldUp)) > 0.999
    ? new Vector3(0, 0, 1)
    : worldUp

  // Project upHint onto the plane perpendicular to worldTarget
  const desiredUp = upHint.clone().sub(worldTarget.clone().multiplyScalar(worldTarget.dot(upHint))).normalize()

  // If degenerate, skip twist correction
  if (desiredUp.lengthSq() < 1e-6) return q1

  // Project rotatedUp onto the same plane
  const currentUp = rotatedUp.clone().sub(worldTarget.clone().multiplyScalar(worldTarget.dot(rotatedUp))).normalize()
  if (currentUp.lengthSq() < 1e-6) return q1

  // Step 2: twist correction around worldTarget
  const q2 = new Quaternion().setFromUnitVectors(currentUp, desiredUp)

  return q2.multiply(q1)
}
