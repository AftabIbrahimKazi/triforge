import { BufferGeometry, BufferAttribute } from 'three'

/**
 * ShapeKey — a named morph target stored as absolute vertex positions.
 * Blender: Shape Key (not deltas — full positions, same as Three.js morph targets).
 *
 * The "Basis" shape key is the rest mesh (influence = 0 means no effect).
 * All other keys are blended toward their positions as influence → 1.
 */
export interface ShapeKey {
  /** Blender: Shape Key name. "Basis" is the rest shape. */
  name: string
  /**
   * Vertex positions for this shape key.
   * Must have the same vertex count as the base geometry.
   */
  positions: Float32Array
}

/**
 * Create a ShapeKey from a BufferGeometry.
 * Copies the current position attribute into the key.
 */
export function shapeKeyFromGeometry(name: string, geometry: BufferGeometry): ShapeKey {
  const pos = geometry.getAttribute('position') as BufferAttribute
  return { name, positions: new Float32Array(pos.array) }
}

/**
 * Create a ShapeKey from raw position deltas added to a base geometry.
 * Blender: Relative shape keys using the "From Mix" workflow.
 * Each delta[i*3+0/1/2] is added to base.position[i].
 */
export function shapeKeyFromDeltas(name: string, base: BufferGeometry, deltas: Float32Array): ShapeKey {
  const pos  = (base.getAttribute('position') as BufferAttribute).array as Float32Array
  const n    = pos.length
  const out  = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = pos[i] + deltas[i]
  return { name, positions: out }
}
