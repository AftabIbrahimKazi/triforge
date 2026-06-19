/**
 * @st-core-types — Shared TypeScript interfaces for the st- ecosystem.
 *
 * All packages communicate only through Three.js primitives (BufferGeometry,
 * Material, Texture). These interfaces describe the shapes of objects passed
 * at those boundaries, letting user code stay type-safe without any package
 * importing from another package.
 *
 * Import only what you need — all types are pure interfaces (no runtime code).
 */

export type { IAnimatable }        from './IAnimatable.js'
export type { IModifier }          from './IModifier.js'
export type { IGeometryProvider }  from './IGeometryProvider.js'
export type { ICurve }             from './ICurve.js'
export type { IStrand }            from './IStrand.js'
export type { IEmitter }           from './IEmitter.js'
export type { IForce }             from './IForce.js'
export type { IParticleLike }      from './IParticlePool.js'
export type { IParticlePool }      from './IParticlePool.js'
export type { IRenderer }          from './IRenderer.js'
export type { IKeyframeTarget }    from './IKeyframeTarget.js'
export type { IShaderNode }        from './IShaderNode.js'
export type { ICollider }          from './ICollider.js'
export type { IConstraint }        from './IConstraint.js'
export type { IRigidBody }         from './IRigidBody.js'
export type { IPoseBone }          from './IPoseBone.js'
