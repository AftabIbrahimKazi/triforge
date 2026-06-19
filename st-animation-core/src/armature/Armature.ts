import { Matrix4, Vector3, Quaternion } from 'three'
import { PoseBone } from './PoseBone.js'
import { TrackToConstraint, CopyRotationConstraint, CopyLocationConstraint } from './BoneConstraints.js'

export type AnyBoneConstraint = TrackToConstraint | CopyRotationConstraint | CopyLocationConstraint

export interface BoneDefinition {
  /** Unique name for this bone. */
  name: string
  /** Head position in armature local space (rest pose). */
  head: Vector3
  /** Tail position in armature local space (rest pose). Used for display and child offset. */
  tail: Vector3
  /** Parent bone name. Undefined = root bone. */
  parent?: string
}

/**
 * Armature — hierarchical bone skeleton.
 * Blender: Armature object (Edit Mode defines rest pose; Pose Mode applies transforms).
 *
 * Workflow:
 *   1. Define bones with BoneDefinition[] (rest pose, same as Edit Mode)
 *   2. Access `armature.pose[name]` to get each bone's PoseBone
 *   3. Animate `pose[name].parameters` with st-keyframe
 *   4. Call `armature.update()` each frame to recompute world matrices
 *   5. Pass `armature.getBoneMatrices()` to a SkinnedGeometry or shader uniform
 *
 * World matrix = parentWorldMatrix × restMatrix × poseLocalMatrix × restMatrixInverse
 * This is the standard skinning formula (Blender/glTF compatible).
 */
export class Armature {
  private _bones: BoneDefinition[]
  private _order: string[]         // topological order (parents before children)
  private _restMatrices: Map<string, Matrix4>
  private _restInverses: Map<string, Matrix4>

  /** Access pose bones by name. Animate their `parameters`. */
  pose: Record<string, PoseBone> = {}

  /** Per-bone constraint lists. Use addConstraint() to populate. */
  constraints: Map<string, AnyBoneConstraint[]> = new Map()

  constructor(bones: BoneDefinition[]) {
    this._bones = bones
    this._restMatrices = new Map()
    this._restInverses = new Map()
    this._order = topologicalSort(bones)

    // Build rest matrices from head positions
    for (const def of bones) {
      this.pose[def.name] = new PoseBone(def.name)
    }

    this._buildRestMatrices()
  }

  get bones(): readonly BoneDefinition[] { return this._bones }
  get boneNames(): string[] { return this._order }

  private _buildRestMatrices(): void {
    for (const name of this._order) {
      const def    = this._bones.find(b => b.name === name)!
      const parent = def.parent ? this._restMatrices.get(def.parent) : undefined

      // Rest matrix = translation to head, orientation from head→tail
      const dir  = def.tail.clone().sub(def.head).normalize()
      const up   = new Vector3(0, 1, 0)
      const q    = new Quaternion()

      if (Math.abs(dir.dot(up)) < 0.999) {
        q.setFromUnitVectors(up, dir)
      } else {
        // Bone points along Y — use identity or flip
        if (dir.y < 0) q.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
      }

      const rest = new Matrix4().compose(def.head.clone(), q, new Vector3(1, 1, 1))
      if (parent) rest.premultiply(parent)

      this._restMatrices.set(name, rest)
      this._restInverses.set(name, rest.clone().invert())
    }
  }

  /**
   * Register a constraint on a named bone.
   * Constraints are applied in insertion order during update().
   */
  addConstraint(boneName: string, constraint: AnyBoneConstraint): void {
    if (!this.constraints.has(boneName)) {
      this.constraints.set(boneName, [])
    }
    this.constraints.get(boneName)!.push(constraint)
  }

  /**
   * Recompute world matrices for all pose bones.
   * Call every frame after modifying `pose[name].parameters`.
   * Constraints are applied after initial world matrix computation and
   * cause the local matrix to be rebuilt so skinning uses the constrained result.
   */
  update(): void {
    for (const name of this._order) {
      const def   = this._bones.find(b => b.name === name)!
      const bone  = this.pose[name]
      bone.buildLocalMatrix()

      const rest    = this._restMatrices.get(name)!
      const restInv = this._restInverses.get(name)!

      // Skinning matrix: rest × poseLocal
      const world = rest.clone().multiply(bone.localMatrix)

      if (def.parent) {
        const parentWorld = this.pose[def.parent].worldMatrix
        world.premultiply(parentWorld).premultiply(restInv)
        bone.worldMatrix.copy(world)
      } else {
        // Root bone
        bone.worldMatrix.copy(world.multiply(restInv))
      }

      // Apply constraints, then rebuild local matrix so skinning is correct
      const boneConstraints = this.constraints.get(name)
      if (boneConstraints && boneConstraints.length > 0) {
        const parentWorldMatrix = def.parent
          ? this.pose[def.parent].worldMatrix
          : new Matrix4()

        for (const constraint of boneConstraints) {
          if (constraint instanceof CopyRotationConstraint) {
            constraint.apply(bone)
          } else {
            // TrackToConstraint and CopyLocationConstraint take parentWorldMatrix
            (constraint as TrackToConstraint | CopyLocationConstraint).apply(bone, parentWorldMatrix)
          }
        }

        // Rebuild matrices with constrained parameters
        bone.buildLocalMatrix()
        const constrainedWorld = rest.clone().multiply(bone.localMatrix)
        if (def.parent) {
          const parentWorld = this.pose[def.parent].worldMatrix
          constrainedWorld.premultiply(parentWorld).premultiply(restInv)
          bone.worldMatrix.copy(constrainedWorld)
        } else {
          bone.worldMatrix.copy(constrainedWorld.multiply(restInv))
        }
      }
    }
  }

  /**
   * Return skinning matrices (one per bone, in definition order).
   * Pass to a shader as `uniform mat4 boneMatrices[N]`.
   * Each matrix = worldMatrix (transforms from bind pose to current pose).
   */
  getBoneMatrices(): Matrix4[] {
    return this._order.map(name => this.pose[name].worldMatrix)
  }

  /**
   * Get bone world position (head location in current pose).
   */
  getBoneWorldPosition(name: string, out = new Vector3()): Vector3 {
    return out.setFromMatrixPosition(this.pose[name].worldMatrix)
  }

  /**
   * Get bone world quaternion.
   */
  getBoneWorldQuaternion(name: string, out = new Quaternion()): Quaternion {
    return out.setFromRotationMatrix(this.pose[name].worldMatrix)
  }

  /**
   * 2-bone analytical IK.
   * Rotates `boneA` and `boneB` so that `boneB`'s tail reaches `target`.
   * Blender: IK constraint (2-bone chain).
   *
   * @param boneA  Root bone of the chain (e.g. "upper_arm")
   * @param boneB  End bone of the chain (e.g. "forearm")
   * @param target Target position in armature local space
   * @param poleAngle Twist offset in radians (controls elbow/knee direction). Default 0.
   */
  solveIK2Bone(boneA: string, boneB: string, target: Vector3, poleAngle = 0): boolean {
    const defA = this._bones.find(b => b.name === boneA)
    const defB = this._bones.find(b => b.name === boneB)
    if (!defA || !defB) return false

    const lenA = defA.tail.distanceTo(defA.head)
    const lenB = defB.tail.distanceTo(defB.head)

    // Origin = boneA head in rest pose (world space)
    const origin = defA.head.clone()
    const toTarget = target.clone().sub(origin)
    const dist     = toTarget.length()

    // Clamp target within reach
    const maxDist = lenA + lenB
    const minDist = Math.abs(lenA - lenB)
    const clampedDist = Math.max(minDist + 1e-5, Math.min(maxDist - 1e-5, dist))

    // Law of cosines: angle at boneA
    const cosA = (lenA * lenA + clampedDist * clampedDist - lenB * lenB) / (2 * lenA * clampedDist)
    const cosB = (lenA * lenA + lenB * lenB - clampedDist * clampedDist) / (2 * lenA * lenB)
    const angleA = Math.acos(Math.max(-1, Math.min(1, cosA)))
    const angleB = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosB)))

    // Bend axis: perpendicular to the limb plane
    const up   = new Vector3(0, 1, 0)
    const dir  = toTarget.clone().normalize()
    let bendAxis = new Vector3().crossVectors(dir, up).normalize()
    if (bendAxis.length() < 0.001) bendAxis = new Vector3(1, 0, 0)

    // Apply rotations to pose bones
    const qA = new Quaternion().setFromAxisAngle(dir, 0)
      .multiply(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir))
    const qBend = new Quaternion().setFromAxisAngle(bendAxis, -angleA + poleAngle)
    const finalQA = qBend.multiply(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir))
    this.pose[boneA].setQuaternion(finalQA)

    const qBB = new Quaternion().setFromAxisAngle(bendAxis, angleB)
    this.pose[boneB].setQuaternion(qBB)

    return true
  }
}

function topologicalSort(bones: BoneDefinition[]): string[] {
  const visited = new Set<string>()
  const order: string[] = []

  function visit(name: string) {
    if (visited.has(name)) return
    visited.add(name)
    const def = bones.find(b => b.name === name)
    if (def?.parent) visit(def.parent)
    order.push(name)
  }

  for (const b of bones) visit(b.name)
  return order
}
