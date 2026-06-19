import { BufferGeometry, BufferAttribute } from 'three'
import type { Strand } from '../core/Strand.js'
import { sampleSpline } from '../core/Strand.js'

/**
 * Build a line BufferGeometry from multiple strands.
 * Used for very dense hair where tube geometry is too heavy.
 * Render with THREE.LineSegments.
 * Blender: Hair > Display > Strand segments (line mode).
 */
export function buildLineGeometry(
  strands: Strand[],
  steps:   number,
): BufferGeometry {
  const allPos: number[] = []

  for (const strand of strands) {
    for (let i = 0; i < steps; i++) {
      const a = sampleSpline(strand.points, i / steps)
      const b = sampleSpline(strand.points, (i+1) / steps)
      allPos.push(...a, ...b)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3))
  return geo
}
