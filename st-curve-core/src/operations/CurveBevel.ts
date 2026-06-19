import { BufferGeometry, BufferAttribute, Vector2, Vector3 } from 'three'
import type { BaseCurve } from '../core/BaseCurve.js'
import { computeRMFrames, type CurveFrame } from '../utils/frames.js'

export interface CurveBevelOptions {
  /** Number of cross-section rings. Blender: Resolution U. Default 64. */
  tubularSegments?: number
  /** Scale applied to the profile. Default 1. */
  profileScale?: number
  /** Blender: Bevel Factor Start — trim geometry to start at this fraction (0–1). Default 0. */
  bevelFactorStart?: number
  /** Blender: Bevel Factor End — trim geometry to end at this fraction (0–1). Default 1. */
  bevelFactorEnd?: number
}

/**
 * CurveBevel — extrude an arbitrary 2D profile along a 3D curve.
 * Blender: curve object with Geometry > Bevel Object (a 2D curve profile).
 *
 * The profile is a list of 2D points (local XY) that gets stamped along each
 * cross-section ring using the curve's rotation-minimizing frame.
 *
 * Built-in profiles: square, star, diamond, letter "C" shape.
 * Or supply any list of Vector2 points for a custom profile.
 */
export class CurveBevel {
  parameters: {
    tubularSegments: number
    profileScale: number
    bevelFactorStart: number
    bevelFactorEnd: number
  }

  /** 2D profile points (closed polygon). */
  profile: Vector2[]

  constructor(profile: Vector2[], opts: CurveBevelOptions = {}) {
    this.profile = profile
    this.parameters = {
      tubularSegments:  opts.tubularSegments  ?? 64,
      profileScale:     opts.profileScale     ?? 1,
      bevelFactorStart: opts.bevelFactorStart ?? 0,
      bevelFactorEnd:   opts.bevelFactorEnd   ?? 1,
    }
  }

  apply(curve: BaseCurve): BufferGeometry {
    const { tubularSegments, profileScale, bevelFactorStart, bevelFactorEnd } = this.parameters
    const tubeSegs   = Math.max(3, tubularSegments)
    const profilePts = this.profile
    const profileN   = profilePts.length
    const frameCount = tubeSegs + 1

    // Clamp bevel factors
    const tStart = Math.max(0, Math.min(1, bevelFactorStart))
    const tEnd   = Math.max(tStart, Math.min(1, bevelFactorEnd))

    const frames = _sampleFramesInRange(curve, frameCount, tStart, tEnd)

    const vertCount = frameCount * profileN
    const positions = new Float32Array(vertCount * 3)
    const normals   = new Float32Array(vertCount * 3)
    const uvs       = new Float32Array(vertCount * 2)

    let vi = 0, ui = 0
    for (let i = 0; i < frameCount; i++) {
      const frame = frames[i]
      const uStep = i / tubeSegs
      for (let j = 0; j < profileN; j++) {
        const px = profilePts[j].x * profileScale
        const py = profilePts[j].y * profileScale

        positions[vi]   = frame.position.x + frame.normal.x * px + frame.binormal.x * py
        positions[vi+1] = frame.position.y + frame.normal.y * px + frame.binormal.y * py
        positions[vi+2] = frame.position.z + frame.normal.z * px + frame.binormal.z * py

        // Approximate normals from profile edge directions
        const next = profilePts[(j + 1) % profileN]
        const ex   = next.x - profilePts[j].x, ey = next.y - profilePts[j].y
        const nPx  =  ey, nPy = -ex
        const nLen = Math.sqrt(nPx*nPx + nPy*nPy) || 1
        normals[vi]   = (frame.normal.x * nPx + frame.binormal.x * nPy) / nLen
        normals[vi+1] = (frame.normal.y * nPx + frame.binormal.y * nPy) / nLen
        normals[vi+2] = (frame.normal.z * nPx + frame.binormal.z * nPy) / nLen

        uvs[ui]   = uStep
        uvs[ui+1] = j / (profileN - 1)
        vi += 3; ui += 2
      }
    }

    const faceCount  = tubeSegs * profileN * 2
    const indices    = new Uint32Array(faceCount * 3)
    let   ii = 0
    for (let i = 0; i < tubeSegs; i++) {
      for (let j = 0; j < profileN; j++) {
        const a = profileN * i + j
        const b = profileN * (i + 1) + j
        const c = profileN * (i + 1) + (j + 1) % profileN
        const d = profileN * i + (j + 1) % profileN
        indices[ii++] = a; indices[ii++] = b; indices[ii++] = d
        indices[ii++] = b; indices[ii++] = c; indices[ii++] = d
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('normal',   new BufferAttribute(normals,   3))
    geo.setAttribute('uv',       new BufferAttribute(uvs,       2))
    geo.setIndex(new BufferAttribute(indices, 1))
    return geo
  }

  // ── Built-in profiles ──────────────────────────────────────────────────────

  /** Circular profile — same result as CurveTube. */
  static circle(radius = 0.1, sides = 12): Vector2[] {
    return Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2
      return new Vector2(Math.cos(a) * radius, Math.sin(a) * radius)
    })
  }

  /** Square profile. */
  static square(size = 0.1): Vector2[] {
    const h = size / 2
    return [new Vector2(-h,-h), new Vector2(h,-h), new Vector2(h,h), new Vector2(-h,h)]
  }

  /** Diamond (rotated square). */
  static diamond(size = 0.1): Vector2[] {
    const h = size / 2
    return [new Vector2(0,-h), new Vector2(h,0), new Vector2(0,h), new Vector2(-h,0)]
  }

  /** Star profile. */
  static star(outerR = 0.12, innerR = 0.05, points = 5): Vector2[] {
    const pts: Vector2[] = []
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? outerR : innerR
      pts.push(new Vector2(Math.cos(a) * r, Math.sin(a) * r))
    }
    return pts
  }
}

// ── Shared internal helper (same logic as CurveTube) ─────────────────────────

function _sampleFramesInRange(
  curve: BaseCurve,
  count: number,
  tStart: number,
  tEnd: number,
): CurveFrame[] {
  if (tStart === 0 && tEnd === 1) {
    return computeRMFrames(curve, count)
  }

  const preCount  = Math.max(count, 64)
  const allFrames = computeRMFrames(curve, preCount)

  const out: CurveFrame[] = []
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? tStart : tStart + (tEnd - tStart) * (i / (count - 1))
    out.push(_interpolateFrame(u, allFrames, preCount))
  }
  return out
}

function _interpolateFrame(u: number, frames: CurveFrame[], frameCount: number): CurveFrame {
  const idx   = Math.min(Math.floor(u * (frameCount - 1)), frameCount - 2)
  const alpha = u * (frameCount - 1) - idx
  const f0    = frames[idx]
  const f1    = frames[idx + 1]

  const position = new Vector3().lerpVectors(f0.position, f1.position, alpha)
  const tangent  = new Vector3().lerpVectors(f0.tangent,  f1.tangent,  alpha).normalize()
  const normal   = new Vector3().lerpVectors(f0.normal,   f1.normal,   alpha).normalize()
  const binormal = new Vector3().crossVectors(tangent, normal).normalize()
  const correctedNormal = new Vector3().crossVectors(binormal, tangent).normalize()

  return { position, tangent, normal: correctedNormal, binormal }
}
