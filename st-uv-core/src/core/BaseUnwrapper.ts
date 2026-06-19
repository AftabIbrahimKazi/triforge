import type { BufferGeometry } from 'three'

/**
 * Abstract base for all UV unwrappers.
 * Mirrors Blender's UV unwrap operations: non-destructive, parameterized.
 *
 * Every unwrapper:
 * - Takes a BufferGeometry in, returns a new BufferGeometry with updated UV attribute
 * - Never mutates the input geometry
 * - Exposes a plain `parameters` object for GSAP/keyframe compatibility
 */
export abstract class BaseUnwrapper {
  /** When false, apply() returns a clone of the input with no UV changes. */
  enabled = true

  /** All scalar inputs as plain numbers. GSAP-compatible. */
  abstract parameters: Record<string, number>

  /** Human-readable name matching Blender's operation name. */
  abstract readonly unwrapType: string

  /**
   * Apply this unwrapper to the input geometry.
   * NEVER mutates the input — always returns a new BufferGeometry.
   */
  abstract apply(geometry: BufferGeometry): BufferGeometry
}
