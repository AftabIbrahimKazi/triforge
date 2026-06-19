// Core
export { HairSystem }                    from './core/HairSystem.js'
export type { HairMode, HairSystemOptions } from './core/HairSystem.js'
export { sampleSpline, sampleTangent, computeRMFrames } from './core/Strand.js'
export type { Strand }                   from './core/Strand.js'

// Geometry builders (for custom use)
export { buildTubeGeometry, buildTubeStrand }  from './geometry/tubeGeometry.js'
export { buildRibbonGeometry }                 from './geometry/ribbonGeometry.js'
export { buildLineGeometry }                   from './geometry/lineGeometry.js'

// Generators
export { StrandGenerator }               from './generators/StrandGenerator.js'
export type { StrandGeneratorOptions }   from './generators/StrandGenerator.js'

// Dynamics
export { HairDynamics }                  from './dynamics/HairDynamics.js'
export type { HairDynamicsOptions }      from './dynamics/HairDynamics.js'

// Modifiers
export { applyKink, applyKinkToStrands } from './modifiers/KinkModifier.js'
export type { KinkType, KinkOptions }    from './modifiers/KinkModifier.js'
export { applyClump }                    from './modifiers/ClumpModifier.js'
export type { ClumpOptions }             from './modifiers/ClumpModifier.js'
