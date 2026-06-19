import type { Strand } from '../core/Strand.js'
import { sampleTangent } from '../core/Strand.js'

/**
 * KinkModifier — add wave / curl patterns to strands.
 * Blender: Hair > Kink.
 *
 * All displacements are applied in the per-point local frame of the strand
 * (tangent / right / up), so patterns follow each strand's own axis.
 */

export type KinkType = 'WAVE' | 'CURL' | 'RADIAL' | 'BRAID' | 'NOTHING'

export interface KinkOptions {
  /** Kink pattern. Blender: Kink > Type. */
  type:       KinkType
  /** Kink amplitude. Blender: Kink > Amplitude. */
  amplitude:  number
  /** Kink frequency. Blender: Kink > Frequency. */
  frequency:  number
  /** Clump kink toward root (0 = full kink at tip, 1 = full kink at root). */
  shape:      number
}

/**
 * Apply kink displacement to a strand's control points.
 * Returns a new Strand — original is not mutated.
 */
export function applyKink(strand: Strand, opts: Partial<KinkOptions>): Strand {
  const { type = 'WAVE', amplitude = 0.1, frequency = 2, shape = 0 } = opts
  if (type === 'NOTHING' || amplitude === 0) return strand

  const newPoints = strand.points.map((p, i, arr): [number, number, number] => {
    const t     = arr.length > 1 ? i / (arr.length - 1) : 0
    const env   = amplitude * Math.pow(t, Math.max(0, 1 - shape))
    const phase = t * frequency * Math.PI * 2

    // Build a local right/up frame perpendicular to the strand tangent at t
    const tan = sampleTangent(arr, t)
    const ref: [number,number,number] = Math.abs(tan[1]) < 0.9 ? [0,1,0] : [1,0,0]
    const right = norm(cross(tan, ref))
    const up    = cross(right, tan)

    if (type === 'WAVE') {
      const s = Math.sin(phase)
      return [p[0] + right[0]*s*env, p[1] + right[1]*s*env, p[2] + right[2]*s*env]
    }

    if (type === 'CURL') {
      const c = Math.cos(phase), s = Math.sin(phase)
      return [
        p[0] + right[0]*c*env + up[0]*s*env,
        p[1] + right[1]*c*env + up[1]*s*env,
        p[2] + right[2]*c*env + up[2]*s*env,
      ]
    }

    if (type === 'RADIAL') {
      const c = Math.cos(phase), s = Math.sin(phase)
      return [
        p[0] + right[0]*c*env + up[0]*s*env,
        p[1] + right[1]*c*env + up[1]*s*env,
        p[2] + right[2]*c*env + up[2]*s*env,
      ]
    }

    if (type === 'BRAID') {
      const c = Math.cos(phase * 3), s = Math.sin(phase * 3)
      return [
        p[0] + right[0]*c*env + up[0]*s*env,
        p[1] + right[1]*c*env + up[1]*s*env,
        p[2] + right[2]*c*env + up[2]*s*env,
      ]
    }

    return p
  })

  return { ...strand, points: newPoints }
}

/**
 * Apply kink to an array of strands.
 */
export function applyKinkToStrands(strands: Strand[], opts: Partial<KinkOptions>): Strand[] {
  return strands.map(s => applyKink(s, opts))
}

// ── helpers ───────────────────────────────────────────────────────────────────
type V3 = [number,number,number]
const cross = ([ax,ay,az]: V3, [bx,by,bz]: V3): V3 => [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx]
const norm  = ([x,y,z]: V3): V3 => { const l = Math.sqrt(x*x+y*y+z*z) || 1; return [x/l, y/l, z/l] }
