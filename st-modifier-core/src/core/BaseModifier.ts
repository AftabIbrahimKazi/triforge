import type { BufferGeometry } from 'three'

/**
 * Abstract base for all modifiers.
 * Mirrors Blender's modifier pattern: non-destructive, stackable, parameterized.
 *
 * Every modifier:
 * - Takes a BufferGeometry in, returns a new BufferGeometry out (never mutates input)
 * - Exposes a plain `parameters` object for GSAP/keyframe compatibility
 * - Can be toggled with `enabled`
 */
export abstract class BaseModifier {
  /** When false the modifier is skipped in the stack — geometry passes through unchanged. */
  enabled: boolean = true

  /**
   * Live scalar parameters. All numeric inputs live here.
   * After construction, writing to parameters[name] affects the next apply() call.
   * GSAP-compatible: gsap.to(modifier.parameters, { strength: 1.0, duration: 2 })
   */
  abstract parameters: Record<string, number>

  /** Human-readable name matching Blender's modifier name. */
  abstract get name(): string

  /**
   * Apply this modifier to the input geometry.
   * NEVER mutates the input — always returns a new BufferGeometry.
   * The caller is responsible for disposing the old geometry when no longer needed.
   */
  abstract apply(geometry: BufferGeometry): BufferGeometry
}
