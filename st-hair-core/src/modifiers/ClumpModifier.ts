import type { Strand } from '../core/Strand.js'
import { sampleSpline } from '../core/Strand.js'

/**
 * ClumpModifier — pull child strands toward parent/guide strands.
 * Blender: Hair > Children > Clumping.
 *
 * Each strand is pulled toward the nearest parent strand by `factor`.
 * The pull is envelope-shaped: zero at root (strands share roots),
 * growing toward tip (controlled by `shape`).
 */
export interface ClumpOptions {
  /** Pull strength [0,1]. Blender: Clumping. */
  factor:    number
  /** Taper shape — how quickly clumping grows from root. Blender: Clumping Shape. */
  shape:     number
  /** Number of interpolation steps used to sample parent strands. */
  steps?:    number
}

/**
 * Apply clumping — pull `children` toward the closest strand in `parents`.
 * Returns new strands without mutating originals.
 */
export function applyClump(
  children: Strand[],
  parents:  Strand[],
  opts:     Partial<ClumpOptions> = {},
): Strand[] {
  const { factor = 0.5, shape = 1, steps = 8 } = opts
  if (parents.length === 0 || factor === 0) return children

  return children.map(child => {
    // Find closest parent by root distance
    const childRoot = child.points[0]
    let closestParent = parents[0]
    let minDist = Infinity
    for (const p of parents) {
      const root = p.points[0]
      const d    = dist3(childRoot, root)
      if (d < minDist) { minDist = d; closestParent = p }
    }

    const n = child.points.length
    const newPoints = child.points.map((pt, i): [number,number,number] => {
      const t   = n > 1 ? i / (n - 1) : 0
      const env = factor * Math.pow(t, Math.max(0.01, shape))
      const pp  = sampleSpline(closestParent.points, t)
      return [
        pt[0] + (pp[0] - pt[0]) * env,
        pt[1] + (pp[1] - pt[1]) * env,
        pt[2] + (pp[2] - pt[2]) * env,
      ]
    })

    return { ...child, points: newPoints }
  })
}

function dist3(a: [number,number,number], b: [number,number,number]): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)
}
