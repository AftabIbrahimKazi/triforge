import {
  InstancedMesh, BufferGeometry, Material,
  Matrix4, Quaternion, Vector3, Euler, Camera,
} from 'three'
import { BaseRenderer }       from '../core/BaseRenderer.js'
import type { ParticleLike }  from '../core/BaseRenderer.js'
import type { SeededRandom }  from '../core/SeededRandom.js'

export interface InstanceRendererOptions {
  /** Geometry stamped at every particle position */
  geometry:   BufferGeometry
  /** Any Three.js material — including compiled shader node graphs */
  material:   Material
  /** Pool size — must match or exceed ParticleSystem.count */
  maxCount?:  number
  /**
   * Rotate each instance to face the camera.
   * Essential for flat foam/splash meshes — without this they render edge-on.
   * Blender: Render → Object with "Face Camera" orientation.
   * Default: true.
   */
  billboard?: boolean
  /**
   * Shrink the instance scale to 0 over its lifetime.
   * Simulates a fade when the material has no transparency.
   * Default: true.
   */
  fadeOut?:   boolean
  /**
   * Show instances on startup.
   * Mirrors Blender's viewport display toggle. Default: true.
   */
  showHelpers?: boolean
}

/**
 * InstanceRenderer — renders each particle as a full mesh instance.
 * Uses THREE.InstancedMesh — one draw call regardless of particle count.
 * Blender parallel: Particle System → Render → Object / Collection.
 *
 * Assign any material here, including a compiled @st-shader-core node graph,
 * to get full PBR shading on every particle.
 *
 * No allocations inside update() — all temporaries are pre-allocated.
 */
export class InstanceRenderer extends BaseRenderer {
  readonly object3D: InstancedMesh

  /**
   * Scalar inputs — safe to animate with GSAP or the keyframe system.
   * fadeOut: 1 = shrink to 0 over lifetime, 0 = constant size.
   * billboard: 1 = face camera, 0 = use particle rotation.
   */
  parameters: { fadeOut: number; billboard: number }

  /**
   * Set this to your active camera to enable billboard alignment.
   * Required when billboard: 1 (the default).
   */
  camera: Camera | null = null
  private readonly _matrix:     Matrix4    = new Matrix4()
  private readonly _pos:        Vector3    = new Vector3()
  private readonly _quat:       Quaternion = new Quaternion()
  private readonly _camQuat:    Quaternion = new Quaternion()
  private readonly _euler:      Euler      = new Euler()
  private readonly _scale:      Vector3    = new Vector3()
  private readonly _zeroMatrix: Matrix4    = new Matrix4().makeScale(0, 0, 0)
  private _prevCount: number = 0
  private _maxCount:  number

  constructor(opts: InstanceRendererOptions) {
    super()
    const max = opts.maxCount ?? 1000
    this._maxCount = max
    this.parameters = {
      billboard: (opts.billboard ?? true) ? 1 : 0,
      fadeOut:   (opts.fadeOut   ?? true) ? 1 : 0,
    }

    this.object3D = new InstancedMesh(opts.geometry, opts.material, max)
    this.object3D.frustumCulled = false
    this.object3D.count         = 0
    this.object3D.visible       = opts.showHelpers ?? true

    // Pre-zero all slots so no stale instances flash on first frame
    for (let i = 0; i < max; i++) {
      this.object3D.setMatrixAt(i, this._zeroMatrix)
    }
    this.object3D.instanceMatrix.needsUpdate = true

    this._allocDrawBuf(max)
  }

  update(
    particles: ParticleLike[],
    aliveCount: number,
    params?:    Record<string, number>,
    childRng?:  SeededRandom,
  ): void {
    const childCount  = params ? Math.round(Math.max(0, params.childCount  ?? 0)) : 0
    const childType   = params ? Math.round(params.childType   ?? 0) : 0
    const childSpread = params ? (params.childSpread ?? 0.5) : 0.5

    const rawCount = this.expandWithChildren(
      particles, aliveCount, childCount, childType, childSpread,
      childRng ?? null, this._maxCount,
    )

    const displayAmount = params ? Math.min(1, Math.max(0, params.displayAmount ?? 1)) : 1
    const drawCount = displayAmount >= 1 ? rawCount : Math.round(rawCount * displayAmount)

    const billboard = this.parameters.billboard >= 0.5
    const fadeOut   = this.parameters.fadeOut   >= 0.5
    if (billboard && this.camera) {
      this.camera.getWorldQuaternion(this._camQuat)
    }

    for (let i = 0; i < drawCount; i++) {
      const p = this._drawBuf[i]
      const s = p.size * (fadeOut ? 1 - p.normalised : 1)
      this._pos.set(p.position.x, p.position.y, p.position.z)
      this._scale.setScalar(Math.max(s, 0))

      if (billboard && this.camera) {
        this._matrix.compose(this._pos, this._camQuat, this._scale)
      } else {
        this._euler.set(p.rotation.x, p.rotation.y, p.rotation.z)
        this._quat.setFromEuler(this._euler)
        this._matrix.compose(this._pos, this._quat, this._scale)
      }

      this.object3D.setMatrixAt(i, this._matrix)
    }

    // Zero out slots that were alive last frame but aren't now
    for (let i = drawCount; i < this._prevCount; i++) {
      this.object3D.setMatrixAt(i, this._zeroMatrix)
    }

    this._prevCount = drawCount
    this.object3D.count = drawCount
    this.object3D.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.object3D.geometry.dispose()
    ;(this.object3D.material as Material).dispose()
  }
}
