// ── Core ──────────────────────────────────────────────────────────────────────
export { BaseUnwrapper } from './core/BaseUnwrapper.js'

// ── Projection unwrappers ─────────────────────────────────────────────────────
export { CubeProjection }     from './unwrappers/CubeProjection.js'
export { CylinderProjection } from './unwrappers/CylinderProjection.js'
export { SphereProjection }   from './unwrappers/SphereProjection.js'
export { SmartUVProject }     from './unwrappers/SmartUVProject.js'

// ── Parametric unwrappers ─────────────────────────────────────────────────────
export { ConformalLSCM }  from './unwrappers/ConformalLSCM.js'
export { AngleBasedABF }  from './unwrappers/AngleBasedABF.js'

// ── UV operations ─────────────────────────────────────────────────────────────
export { PackIslands }        from './operations/PackIslands.js'
export { AverageIslandScale } from './operations/AverageIslandScale.js'
export { MarkSeams }          from './operations/MarkSeams.js'

// ── Option types ──────────────────────────────────────────────────────────────
export type { CubeProjectionOptions }     from './unwrappers/CubeProjection.js'
export type { CylinderProjectionOptions } from './unwrappers/CylinderProjection.js'
export type { SphereProjectionOptions }   from './unwrappers/SphereProjection.js'
export type { SmartUVProjectOptions }     from './unwrappers/SmartUVProject.js'
export type { ConformalLSCMOptions }      from './unwrappers/ConformalLSCM.js'
export type { AngleBasedABFOptions }      from './unwrappers/AngleBasedABF.js'
export type { PackIslandsOptions }        from './operations/PackIslands.js'
export type { SeamEdge }                  from './operations/MarkSeams.js'
