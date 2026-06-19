// ── Core ──────────────────────────────────────────────────────────────────────
export { BaseModifier }    from './core/BaseModifier.js'
export { ModifierStack }   from './core/ModifierStack.js'

// ── Generate modifiers ────────────────────────────────────────────────────────
export { SubdivisionModifier } from './modifiers/generate/SubdivisionModifier.js'
export { ArrayModifier }       from './modifiers/generate/ArrayModifier.js'
export { ExtrudeModifier }     from './modifiers/generate/ExtrudeModifier.js'
export { SolidifyModifier }    from './modifiers/generate/SolidifyModifier.js'
export { MirrorModifier }      from './modifiers/generate/MirrorModifier.js'
export { OceanModifier }       from './modifiers/generate/OceanModifier.js'
export { BooleanModifier }     from './modifiers/generate/BooleanModifier.js'
export { WireframeModifier }   from './modifiers/generate/WireframeModifier.js'
export { BevelModifier }       from './modifiers/generate/BevelModifier.js'

// ── Deform modifiers ──────────────────────────────────────────────────────────
export { DisplacementModifier }  from './modifiers/deform/DisplacementModifier.js'
export { WarpModifier }          from './modifiers/deform/WarpModifier.js'
export { TwistModifier }         from './modifiers/deform/TwistModifier.js'
export { BendModifier }          from './modifiers/deform/BendModifier.js'
export { ShrinkwrapModifier }    from './modifiers/deform/ShrinkwrapModifier.js'

// ── Transform modifiers ───────────────────────────────────────────────────────
export { UVProjectionModifier }      from './modifiers/transform/UVProjectionModifier.js'
export { NormalRecalculateModifier } from './modifiers/transform/NormalRecalculateModifier.js'

// ── Types ─────────────────────────────────────────────────────────────────────
export type { SubdivisionModifierOptions } from './modifiers/generate/SubdivisionModifier.js'
export type { ArrayModifierOptions }       from './modifiers/generate/ArrayModifier.js'
export type { ExtrudeModifierOptions }     from './modifiers/generate/ExtrudeModifier.js'
export type { SolidifyModifierOptions }    from './modifiers/generate/SolidifyModifier.js'
export type { MirrorModifierOptions }      from './modifiers/generate/MirrorModifier.js'
export type { OceanModifierOptions }       from './modifiers/generate/OceanModifier.js'
export type { BooleanModifierOptions, BooleanOperation } from './modifiers/generate/BooleanModifier.js'
export type { DisplacementModifierOptions, NoiseFunction } from './modifiers/deform/DisplacementModifier.js'
export type { WarpModifierOptions }        from './modifiers/deform/WarpModifier.js'
export type { TwistModifierOptions, TwistAxis } from './modifiers/deform/TwistModifier.js'
export type { BendModifierOptions, BendAxis }   from './modifiers/deform/BendModifier.js'
export type { UVProjectionModifierOptions, UVProjectionType } from './modifiers/transform/UVProjectionModifier.js'
export type { WireframeModifierOptions }  from './modifiers/generate/WireframeModifier.js'
export type { BevelModifierOptions }      from './modifiers/generate/BevelModifier.js'
export type { ShrinkwrapModifierOptions } from './modifiers/deform/ShrinkwrapModifier.js'
