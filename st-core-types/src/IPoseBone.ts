import type { Matrix4, Quaternion } from 'three'

/**
 * IPoseBone — the minimal interface for a pose bone in st-animation-core.
 *
 * Use this when bone constraints or external animation systems need to
 * read/write bone transform without importing the concrete PoseBone class.
 */
export interface IPoseBone {
  readonly name: string
  parameters: {
    locationX: number; locationY: number; locationZ: number
    rotationX: number; rotationY: number; rotationZ: number
    scaleX:    number; scaleY:    number; scaleZ:    number
  }
  worldMatrix: Matrix4
  localMatrix: Matrix4
  setQuaternion(q: Quaternion): void
  getQuaternion(out?: Quaternion): Quaternion
}
