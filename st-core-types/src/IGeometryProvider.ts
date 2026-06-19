import type { BufferGeometry } from 'three'

/**
 * IGeometryProvider — a zero-argument callback that returns the current
 * source geometry for a particle emitter or other consumer.
 *
 * This is the bridge between st-modifier-core and st-particle-core without
 * either package importing from the other. The user wires them together:
 *
 * @example
 * const stack = new ModifierStack(baseGeo)
 * stack.add(new SubdivisionModifier({ levels: 2 }))
 *
 * const provider: IGeometryProvider = () => stack.apply()
 * particleSystem.setGeometryProvider(provider)
 *
 * // Each update() call will emit from the subdivided surface.
 */
export type IGeometryProvider = () => BufferGeometry
