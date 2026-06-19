import { Euler, Vector3, Quaternion, Matrix4 } from 'three'

/**
 * PoseBone — the pose-space transform of a single bone.
 * Blender: Pose Mode bone transform (separate from Edit Mode / rest pose).
 *
 * All numeric channels live in `parameters` for st-keyframe / GSAP compatibility:
 *   track(bone.parameters, 'rotationX', [...])
 *
 * World matrix is computed by Armature.update() — do not set it directly.
 */
export class PoseBone {
  /** Blender bone name. */
  name: string

  /**
   * Animatable scalar channels.
   * Rotation in radians (Euler XYZ order).
   * Scale uniform component applied to all axes.
   */
  parameters: {
    locationX: number; locationY: number; locationZ: number
    rotationX: number; rotationY: number; rotationZ: number
    scaleX: number;    scaleY: number;    scaleZ: number
  }

  /** Computed world matrix — updated by Armature.update(). Read-only. */
  worldMatrix = new Matrix4()
  /** Local matrix derived from parameters. */
  localMatrix = new Matrix4()

  constructor(name: string) {
    this.name = name
    this.parameters = {
      locationX: 0, locationY: 0, locationZ: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX:    1, scaleY:    1, scaleZ:    1,
    }
  }

  /** Convenience: set rotation from a Quaternion. Converts to Euler internally. */
  setQuaternion(q: Quaternion): void {
    const e = new Euler().setFromQuaternion(q, 'XYZ')
    this.parameters.rotationX = e.x
    this.parameters.rotationY = e.y
    this.parameters.rotationZ = e.z
  }

  /** Convenience: get rotation as Quaternion. */
  getQuaternion(out = new Quaternion()): Quaternion {
    return out.setFromEuler(new Euler(
      this.parameters.rotationX,
      this.parameters.rotationY,
      this.parameters.rotationZ,
      'XYZ',
    ))
  }

  /** Rebuild localMatrix from parameters. Called by Armature.update(). */
  buildLocalMatrix(): void {
    const { locationX: lx, locationY: ly, locationZ: lz,
            rotationX: rx, rotationY: ry, rotationZ: rz,
            scaleX: sx, scaleY: sy, scaleZ: sz } = this.parameters
    const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'XYZ'))
    this.localMatrix.compose(new Vector3(lx, ly, lz), q, new Vector3(sx, sy, sz))
  }
}
