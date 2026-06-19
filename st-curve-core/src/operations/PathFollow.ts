import { Object3D, Matrix4, Vector3, Quaternion } from 'three'
import type { BaseCurve } from '../core/BaseCurve.js'
import { computeRMFrames, frameToMatrix, frameToQuaternion } from '../utils/frames.js'

/**
 * PathFollow — drives an Object3D along a curve.
 * Blender: Follow Path constraint / Curve modifier in path mode.
 *
 * Precomputes rotation-minimizing frames and lets you:
 * - Place an object at any arc-length fraction u ∈ [0,1]
 * - Get the 4×4 transform matrix at any u
 * - Animate the `parameters.offset` with st-keyframe for path animation
 */
export class PathFollow {
  /** All scalar inputs — animate `offset` with st-keyframe. */
  parameters: {
    /** Arc-length fraction: 0 = start, 1 = end. */
    offset: number
    /** Roll angle in radians added on top of RMF. Default 0. */
    roll: number
  }

  private _frames: ReturnType<typeof computeRMFrames>
  private _lut: { t: number; len: number }[]
  private _curve: BaseCurve

  constructor(curve: BaseCurve, opts: { frameCount?: number; offset?: number; roll?: number } = {}) {
    this._curve  = curve
    const count  = opts.frameCount ?? 256
    this._lut    = curve.buildArcLengthLUT(count * 2)
    this._frames = computeRMFrames(curve, count)
    this.parameters = { offset: opts.offset ?? 0, roll: opts.roll ?? 0 }
  }

  /** Interpolate a frame at arc-length fraction u ∈ [0,1]. */
  private _frameAt(u: number): ReturnType<typeof computeRMFrames>[0] {
    u = Math.max(0, Math.min(1, u))
    const idx = u * (this._frames.length - 1)
    const lo  = Math.floor(idx)
    const hi  = Math.min(lo + 1, this._frames.length - 1)
    const alpha = idx - lo

    const a = this._frames[lo], b = this._frames[hi]
    return {
      position: new Vector3().lerpVectors(a.position, b.position, alpha),
      tangent:  new Vector3().lerpVectors(a.tangent,  b.tangent,  alpha).normalize(),
      normal:   new Vector3().lerpVectors(a.normal,   b.normal,   alpha).normalize(),
      binormal: new Vector3().lerpVectors(a.binormal, b.binormal, alpha).normalize(),
    }
  }

  /**
   * Get the 4×4 transform matrix at arc-length fraction u.
   * If u is omitted, uses `parameters.offset`.
   */
  getMatrix(u = this.parameters.offset, out = new Matrix4()): Matrix4 {
    const frame = this._frameAt(u)
    frameToMatrix(frame, out)

    if (this.parameters.roll !== 0) {
      // Apply roll around the tangent axis
      const rollMat = new Matrix4().makeRotationAxis(frame.tangent, this.parameters.roll)
      out.premultiply(rollMat)
      out.setPosition(frame.position)
    }

    return out
  }

  /**
   * Get position at arc-length fraction u.
   */
  getPosition(u = this.parameters.offset, out = new Vector3()): Vector3 {
    return this._frameAt(u).position
  }

  /**
   * Get rotation quaternion at arc-length fraction u.
   */
  getQuaternion(u = this.parameters.offset, out = new Quaternion()): Quaternion {
    return frameToQuaternion(this._frameAt(u), out)
  }

  /**
   * Apply the current `parameters.offset` position and orientation to an Object3D.
   * Call this every frame after animating `parameters.offset` with st-keyframe.
   */
  apply(object: Object3D): void {
    const frame = this._frameAt(this.parameters.offset)
    object.position.copy(frame.position)
    frameToQuaternion(frame, object.quaternion)
    if (this.parameters.roll !== 0) {
      object.rotateOnAxis(frame.tangent, this.parameters.roll)
    }
  }

  /** Total arc length of the curve. */
  get length(): number {
    return this._lut[this._lut.length - 1].len
  }

  /** Rebuild frames if the curve's control points changed. */
  rebuild(frameCount = this._frames.length): void {
    this._lut    = this._curve.buildArcLengthLUT(frameCount * 2)
    this._frames = computeRMFrames(this._curve, frameCount)
  }
}
