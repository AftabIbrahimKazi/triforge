import { Vector3, Matrix4, Quaternion } from 'three'
import type { BaseCurve } from '../core/BaseCurve.js'

export interface CurveFrame {
  position: Vector3
  tangent:  Vector3
  normal:   Vector3
  binormal: Vector3
}

/**
 * Compute rotation-minimizing frames (RMF) along a curve.
 * Avoids the spinning / twisting of Frenet frames at inflection points.
 *
 * Algorithm: Double Reflection Method (Wang et al. 2008).
 * Result: `count` frames evenly distributed along the curve (arc-length uniform).
 *
 * Blender uses a similar algorithm for curve tilt and object path-follow.
 */
export function computeRMFrames(curve: BaseCurve, count: number, divisions = 400): CurveFrame[] {
  const lut    = curve.buildArcLengthLUT(divisions)
  const frames: CurveFrame[] = []

  // Initial frame: use world-up or a fallback to avoid colinear tangent
  const t0  = curve.getPoint(0)
  const tan = curve.getTangent(0)
  let up    = new Vector3(0, 1, 0)
  if (Math.abs(tan.dot(up)) > 0.99) up = new Vector3(0, 0, 1)

  let normal   = new Vector3().crossVectors(up, tan).normalize()
  let binormal = new Vector3().crossVectors(tan, normal).normalize()

  frames.push({
    position: t0.clone(),
    tangent:  tan.clone(),
    normal:   normal.clone(),
    binormal: binormal.clone(),
  })

  for (let i = 1; i < count; i++) {
    const u    = i / (count - 1)
    const tParam = curve.getUtoTmapping(u, lut)
    const pos  = curve.getPoint(tParam)
    const tan2 = curve.getTangent(tParam)

    const prev = frames[frames.length - 1]

    // Double reflection transport
    const v1 = pos.clone().sub(prev.position)
    const c1 = v1.dot(v1)
    let   rn = prev.normal.clone()
    let   rt = prev.tangent.clone()
    if (c1 > 1e-10) {
      const sc1 = 2 / c1
      rn.sub(v1.clone().multiplyScalar(sc1 * v1.dot(rn)))
      rt.sub(v1.clone().multiplyScalar(sc1 * v1.dot(rt)))
    }

    const v2  = tan2.clone().sub(rt)
    const c2  = v2.dot(v2)
    const sc2 = c2 > 1e-10 ? 2 / c2 : 0
    const newNormal = rn.clone().sub(v2.clone().multiplyScalar(sc2 * v2.dot(rn))).normalize()
    const newBinormal = new Vector3().crossVectors(tan2, newNormal).normalize()

    frames.push({
      position: pos.clone(),
      tangent:  tan2.clone(),
      normal:   newNormal,
      binormal: newBinormal,
    })
    normal   = newNormal
    binormal = newBinormal
  }

  return frames
}

/**
 * Convert a CurveFrame to a 4×4 transformation matrix.
 * Column order: normal (X), binormal (Y), tangent (Z), position (W).
 * Suitable for placing objects along a curve path.
 */
export function frameToMatrix(frame: CurveFrame, out = new Matrix4()): Matrix4 {
  const { position: p, tangent: z, normal: x, binormal: y } = frame
  return out.set(
    x.x, y.x, z.x, p.x,
    x.y, y.y, z.y, p.y,
    x.z, y.z, z.z, p.z,
    0,   0,   0,   1,
  )
}

/**
 * Convert a CurveFrame to a Quaternion rotation.
 * Convenience for Object3D.quaternion assignment.
 */
export function frameToQuaternion(frame: CurveFrame, out = new Quaternion()): Quaternion {
  const m = frameToMatrix(frame)
  return out.setFromRotationMatrix(m)
}
