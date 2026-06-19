import type { BufferGeometry } from 'three'

/**
 * IModifier — the contract every st-modifier-core modifier fulfils.
 *
 * Modifiers are non-destructive: `apply()` always returns a NEW
 * BufferGeometry and never mutates the input. They can be toggled with
 * `enabled` and stacked via ModifierStack.
 *
 * @example
 * function applyAll(geo: BufferGeometry, mods: IModifier[]): BufferGeometry {
 *   return mods.filter(m => m.enabled).reduce((g, m) => m.apply(g), geo)
 * }
 */
export interface IModifier {
  /** Human-readable name matching Blender's modifier name. */
  readonly name: string
  /** When false the modifier passes geometry through unchanged. */
  enabled: boolean
  /** All scalar parameters — GSAP / st-keyframe compatible. */
  parameters: Record<string, number>
  /**
   * Apply this modifier to the input geometry.
   * Never mutates the input — always returns a new BufferGeometry.
   */
  apply(geometry: BufferGeometry): BufferGeometry
}
