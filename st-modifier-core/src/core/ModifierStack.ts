import { BufferGeometry } from 'three'
import type { BaseModifier } from './BaseModifier.js'

/**
 * Non-destructive modifier stack — mirrors Blender's modifier stack.
 * Modifiers run in order: first added = first applied (top of stack).
 * Disabled modifiers are skipped transparently.
 *
 * @example
 * const stack = new ModifierStack(baseGeometry)
 * stack.add(new SubdivisionModifier({ levels: 2 }))
 * stack.add(new DisplacementModifier({ strength: 0.3, noiseFunction: (x,y,z) => noise(x,y,z) }))
 * const finalGeo = stack.apply()
 */
export class ModifierStack {
  private _modifiers: BaseModifier[] = []
  private _source:    BufferGeometry

  constructor(source: BufferGeometry) {
    this._source = source
  }

  /** Add a modifier to the end of the stack. */
  add(modifier: BaseModifier): this {
    this._modifiers.push(modifier)
    return this
  }

  /** Remove a modifier from the stack by reference. */
  remove(modifier: BaseModifier): this {
    const i = this._modifiers.indexOf(modifier)
    if (i !== -1) this._modifiers.splice(i, 1)
    return this
  }

  /** Read-only view of the current modifier list. */
  get modifiers(): readonly BaseModifier[] {
    return this._modifiers
  }

  /** Replace the source geometry (e.g. after an animation tick that regenerates geometry). */
  setSource(geometry: BufferGeometry): this {
    this._source = geometry
    return this
  }

  /**
   * Run all enabled modifiers in order and return the final geometry.
   * Each modifier receives the output of the previous one.
   * Intermediate geometries are disposed automatically.
   * The original source geometry is never disposed or mutated.
   */
  apply(): BufferGeometry {
    let current: BufferGeometry = this._source
    const intermediates: BufferGeometry[] = []

    for (const modifier of this._modifiers) {
      if (!modifier.enabled) continue
      const next = modifier.apply(current)
      if (current !== this._source) intermediates.push(current)
      current = next
    }

    // Dispose all intermediates except the final result
    for (const geo of intermediates) {
      if (geo !== current) geo.dispose()
    }

    return current
  }

  /**
   * Bake the stack — apply all modifiers and return the result as a standalone geometry.
   * Equivalent to Blender's "Apply" button on all modifiers.
   * Does NOT dispose the source geometry.
   */
  bake(): BufferGeometry {
    return this.apply()
  }
}
