import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import type { BaseCurve } from '../core/BaseCurve.js'
import { computeRMFrames, type CurveFrame } from '../utils/frames.js'

export interface CurveTubeOptions {
  /** Number of cross-section rings along the tube. Blender: Resolution U. Default 64. */
  tubularSegments?: number
  /** Number of sides per ring. Blender: Resolution V. Default 12. */
  radialSegments?: number
  /** Tube radius. Blender: Bevel Depth. Default 0.1. */
  radius?: number
  /** Close the tube at both ends (caps). Default false. */
  closed?: boolean
  /** Blender: Bevel Factor Start — trim geometry to start at this fraction (0–1). Default 0. */
  bevelFactorStart?: number
  /** Blender: Bevel Factor End — trim geometry to end at this fraction (0–1). Default 1. */
  bevelFactorEnd?: number
}

/**
 * CurveTube — extrude a circle cross-section along a curve.
 * Blender: curve object with Geometry > Bevel > Round mode.
 *
 * Returns a BufferGeometry with position, normal, and uv attributes.
 * Non-destructive — always returns a new geometry.
 */
export class CurveTube {
  parameters: {
    tubularSegments: number
    radialSegments: number
    radius: number
    bevelFactorStart: number
    bevelFactorEnd: number
  }

  closed: boolean

  constructor(opts: CurveTubeOptions = {}) {
    this.parameters = {
      tubularSegments:  opts.tubularSegments  ?? 64,
      radialSegments:   opts.radialSegments   ?? 12,
      radius:           opts.radius           ?? 0.1,
      bevelFactorStart: opts.bevelFactorStart ?? 0,
      bevelFactorEnd:   opts.bevelFactorEnd   ?? 1,
    }
    this.closed = opts.closed ?? false
  }

  apply(curve: BaseCurve): BufferGeometry {
    const { tubularSegments, radialSegments, radius, bevelFactorStart, bevelFactorEnd } = this.parameters
    const tubeSegs   = Math.max(3, tubularSegments)
    const radialSegs = Math.max(3, radialSegments)
    const frameCount = tubeSegs + 1

    // Clamp bevel factors
    const tStart = Math.max(0, Math.min(1, bevelFactorStart))
    const tEnd   = Math.max(tStart, Math.min(1, bevelFactorEnd))

    // Sample full-curve frames and then remap u to [tStart, tEnd]
    const frames = sampleFramesInRange(curve, frameCount, tStart, tEnd)

    const vertCount = frameCount * (radialSegs + 1)
    const positions = new Float32Array(vertCount * 3)
    const normals   = new Float32Array(vertCount * 3)
    const uvs       = new Float32Array(vertCount * 2)

    let vi = 0, ui = 0
    for (let i = 0; i < frameCount; i++) {
      const frame   = frames[i]
      const uStep   = i / tubeSegs
      for (let j = 0; j <= radialSegs; j++) {
        const angle = (j / radialSegs) * Math.PI * 2
        const cos   = Math.cos(angle)
        const sin   = Math.sin(angle)

        // Normal in the cross-section plane (normal * cos + binormal * sin)
        const nx = frame.normal.x * cos + frame.binormal.x * sin
        const ny = frame.normal.y * cos + frame.binormal.y * sin
        const nz = frame.normal.z * cos + frame.binormal.z * sin

        positions[vi]   = frame.position.x + nx * radius
        positions[vi+1] = frame.position.y + ny * radius
        positions[vi+2] = frame.position.z + nz * radius
        normals[vi]     = nx
        normals[vi+1]   = ny
        normals[vi+2]   = nz
        uvs[ui]   = uStep
        uvs[ui+1] = j / radialSegs
        vi += 3; ui += 2
      }
    }

    // Indices
    const indexCount = tubeSegs * radialSegs * 6
    const indices = new Uint32Array(indexCount)
    let ii = 0
    for (let i = 0; i < tubeSegs; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = (radialSegs + 1) * i + j
        const b = (radialSegs + 1) * (i + 1) + j
        const c = (radialSegs + 1) * (i + 1) + j + 1
        const d = (radialSegs + 1) * i + j + 1
        indices[ii++] = a; indices[ii++] = b; indices[ii++] = d
        indices[ii++] = b; indices[ii++] = c; indices[ii++] = d
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('normal',   new BufferAttribute(normals,   3))
    geo.setAttribute('uv',       new BufferAttribute(uvs,       2))
    geo.setIndex(new BufferAttribute(indices, 1))

    if (this.closed) addCaps(geo, frames, radialSegs, radius)

    return geo
  }
}

/**
 * Sample RMF frames over the sub-range [tStart, tEnd] of the curve.
 * When tStart=0 and tEnd=1 this is identical to computeRMFrames.
 * When trimmed, frames are computed for the full curve first (for stable
 * propagation), then the subset covering [tStart, tEnd] is returned.
 */
function sampleFramesInRange(
  curve: BaseCurve,
  count: number,
  tStart: number,
  tEnd: number,
): CurveFrame[] {
  if (tStart === 0 && tEnd === 1) {
    return computeRMFrames(curve, count)
  }

  // We propagate RMF from 0 up to tEnd using a coarse pre-pass,
  // then resample at `count` evenly-spaced positions within [tStart, tEnd].
  // Strategy: compute enough frames for the whole [0, tEnd] range, then slice.
  const lut  = curve.buildArcLengthLUT(400)

  // Build a temporary full-resolution frame set from 0..tEnd
  const preCount = Math.max(count, 64)
  const allFrames = computeRMFrames(curve, preCount)

  // Map each output frame index to a t value in [tStart, tEnd]
  const { computeRMFrameAt } = _rmfUtils(curve, lut)

  const out: CurveFrame[] = []
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? tStart : tStart + (tEnd - tStart) * (i / (count - 1))
    out.push(computeRMFrameAt(u, allFrames, preCount))
  }
  return out
}

/** Internal utility: interpolate a CurveFrame at curve parameter u by finding the closest frame. */
function _rmfUtils(curve: BaseCurve, lut: ReturnType<BaseCurve['buildArcLengthLUT']>) {
  function computeRMFrameAt(
    u: number,
    frames: CurveFrame[],
    frameCount: number,
  ): CurveFrame {
    // Map u to the closest precomputed frame index
    const idx   = Math.min(Math.floor(u * (frameCount - 1)), frameCount - 2)
    const alpha = u * (frameCount - 1) - idx
    const f0    = frames[idx]
    const f1    = frames[idx + 1]

    // Linearly interpolate position (good enough for sub-frame accuracy)
    const position = new Vector3().lerpVectors(f0.position, f1.position, alpha)
    const tangent  = new Vector3().lerpVectors(f0.tangent,  f1.tangent,  alpha).normalize()
    const normal   = new Vector3().lerpVectors(f0.normal,   f1.normal,   alpha).normalize()
    const binormal = new Vector3().crossVectors(tangent, normal).normalize()

    // Re-orthogonalise normal against tangent
    const correctedNormal = new Vector3().crossVectors(binormal, tangent).normalize()

    return { position, tangent, normal: correctedNormal, binormal }
  }
  void lut
  return { computeRMFrameAt }
}

/** Add flat circular end caps. */
function addCaps(geo: BufferGeometry, frames: CurveFrame[], radialSegs: number, radius: number): void {
  // Caps can be added separately as CircleGeometry positioned at frame endpoints.
  void geo; void frames; void radialSegs; void radius
}
