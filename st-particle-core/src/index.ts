// Core
export { Particle }          from './core/Particle.js'
export { SeededRandom }      from './core/SeededRandom.js'
export { ParticleSystem }    from './core/ParticleSystem.js'
export { ParticleCache }     from './core/ParticleCache.js'
export { DeflectorCollider } from './core/DeflectorCollider.js'
export { BaseEmitter }       from './core/BaseEmitter.js'
export { BaseForce }         from './core/BaseForce.js'
export { BaseRenderer }      from './core/BaseRenderer.js'

// Emitters
export { PointEmitter }    from './emitters/PointEmitter.js'
export { MeshEmitter }     from './emitters/MeshEmitter.js'
export { EdgeEmitter }     from './emitters/EdgeEmitter.js'

// Forces
export { GravityForce }      from './forces/GravityForce.js'
export { WindForce }         from './forces/WindForce.js'
export { VortexForce }       from './forces/VortexForce.js'
export { TurbulenceForce }   from './forces/TurbulenceForce.js'
export { DragForce }         from './forces/DragForce.js'
export { MagneticForce }     from './forces/MagneticForce.js'
export { HarmonicForce }     from './forces/HarmonicForce.js'
export { LennardJonesForce } from './forces/LennardJonesForce.js'
export { ChargeForce }       from './forces/ChargeForce.js'
export { BoidForce }         from './forces/BoidForce.js'
export { ForceField }        from './forces/ForceField.js'
export { TextureForce }      from './forces/TextureForce.js'
export { CurveGuideForce }   from './forces/CurveGuideForce.js'
export { FlowFieldForce }    from './forces/FlowFieldForce.js'
export { BoidField }         from './forces/BoidField.js'
export type { BoidFieldSource, BoidFieldOptions } from './forces/BoidField.js'

// Physics stubs
export { KeyedPhysics }  from './physics/KeyedPhysics.js'
export { SPHPhysics }    from './physics/SPHPhysics.js'

// Renderers (implementation names)
export { BillboardRenderer }   from './renderers/BillboardRenderer.js'
export { InstanceRenderer }    from './renderers/InstanceRenderer.js'
export { LineRenderer }        from './renderers/LineRenderer.js'
export { CollectionRenderer }  from './renderers/CollectionRenderer.js'
export { TrailRenderer }       from './renderers/TrailRenderer.js'

// Renderers (Blender panel names — same classes, alternate exports)
export { HaloRenderer }        from './renderers/HaloRenderer.js'
export { ObjectRenderer }      from './renderers/ObjectRenderer.js'
export { StrandRenderer }                                          from './renderers/StrandRenderer.js'
export type { StrandCurveFn, StrandRenderMode, StrandRendererOptions } from './renderers/StrandRenderer.js'
export { NoneRenderer }        from './renderers/NoneRenderer.js'

// Types
export type { DeflectorColliderOptions }                  from './core/DeflectorCollider.js'
export type { EmitFrom, BaseEmitterOptions }              from './core/BaseEmitter.js'
export type { ParticleSystemOptions }                     from './core/ParticleSystem.js'
export type { BillboardRendererOptions }                  from './renderers/BillboardRenderer.js'
export type { HaloRendererOptions }                       from './renderers/HaloRenderer.js'
export type { InstanceRendererOptions }                   from './renderers/InstanceRenderer.js'
export type { ObjectRendererOptions }                     from './renderers/ObjectRenderer.js'
export type { LineRendererOptions }                       from './renderers/LineRenderer.js'
export type { CollectionRendererOptions, CollectionMesh } from './renderers/CollectionRenderer.js'
export type { TextureForceOptions }                       from './forces/TextureForce.js'
export type { TrailRendererOptions }                      from './renderers/TrailRenderer.js'
export type { EdgeEmitterOptions }                        from './emitters/EdgeEmitter.js'
export type { PointEmitterOptions }                       from './emitters/PointEmitter.js'
export type { MeshEmitterOptions }                        from './emitters/MeshEmitter.js'
export type { BoidObstacle }                              from './forces/BoidForce.js'
export type { FlowVelocityFn, FlowFieldForceOptions }     from './forces/FlowFieldForce.js'
