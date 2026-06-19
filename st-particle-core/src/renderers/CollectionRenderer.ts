import {
  Group, InstancedMesh, BufferGeometry, Material,
  Matrix4, Quaternion, Vector3, Euler, Camera,
} from 'three'
import { BaseRenderer }       from '../core/BaseRenderer.js'
import type { ParticleLike }  from '../core/BaseRenderer.js'
import type { SeededRandom }  from '../core/SeededRandom.js'

export interface CollectionMesh {
  geometry: BufferGeometry
  material:  Material
}

export interface CollectionRendererOptions {
  /** Array of mesh configs — each particle is randomly assigned to one. */
  meshes:     CollectionMesh[]
  /** Pool size — must match or exceed ParticleSystem.count. Default 1000. */
  maxCount?:  number
  /**
   * Rotate each instance to face the camera.
   * Blender: Render → Collection with "Face Camera" orientation. Default: true.
   */
  billboard?: boolean
  /**
   * Shrink each instance to scale 0 over its lifetime. Default: true.
   */
  fadeOut?:   boolean
  /**
   * Shifts random mesh assignment — different seeds give different distributions.
   * Default: 0.
   */
  seed?:      number
  /**
   * Relative spawn probability for each mesh (Blender: Render → Collection → Dupliweights).
   * Length must match meshes.length. Values are normalised internally — [1,1,2] means
   * mesh 0 and 1 each get 25%, mesh 2 gets 50%. Omit for uniform distribution.
   */
  weights?:   number[]
}

/**
 * CollectionRenderer — picks randomly from a list of meshes and instances each group.
 * (Blender: Render → Collection)
 *
 * Creates one THREE.InstancedMesh per collection entry, bundled in a THREE.Group.
 * Assignment uses poolIdx so children of a parent always get the same mesh variant
 * as their parent — stable across frames.
 *
 * No allocations inside update() — all temporaries are pre-allocated.
 */
export class CollectionRenderer extends BaseRenderer {
  readonly object3D: Group

  /**
   * Scalar inputs — safe to animate with GSAP or the keyframe system.
   * fadeOut:    1 = shrink to 0 over lifetime, 0 = constant size.
   * billboard:  1 = face camera, 0 = use particle rotation.
   * seed:       integer offset for mesh assignment.
   * weight0…N: per-mesh relative weights (Blender: Dupliweights).
   *             Changing these at runtime calls _rebuildCDF() on the next update().
   */
  parameters: Record<string, number>

  /** Set this to your active camera when billboard is 1 (the default). */
  camera: Camera | null = null

  private readonly _instances:  InstancedMesh[]
  private readonly _counts:     Int32Array
  private readonly _prevCounts: Int32Array
  private readonly _matrix:     Matrix4    = new Matrix4()
  private readonly _pos:        Vector3    = new Vector3()
  private readonly _quat:       Quaternion = new Quaternion()
  private readonly _camQuat:    Quaternion = new Quaternion()
  private readonly _euler:      Euler      = new Euler()
  private readonly _scale:      Vector3    = new Vector3()
  private readonly _zeroMat:    Matrix4    = new Matrix4().makeScale(0, 0, 0)
  private _maxCount: number
  /** Cumulative distribution function for weighted mesh selection. */
  private _cdf:          Float64Array
  /** Snapshot of weight keys at last CDF build — used to detect runtime changes. */
  private _weightDigest: number

  constructor(opts: CollectionRendererOptions) {
    super()
    const max = opts.maxCount ?? 1000
    this._maxCount = max

    const weightParams: Record<string, number> = {}
    const n = opts.meshes.length
    for (let i = 0; i < n; i++) {
      weightParams[`weight${i}`] = opts.weights?.[i] ?? 1
    }

    this.parameters = {
      billboard: (opts.billboard ?? true) ? 1 : 0,
      fadeOut:   (opts.fadeOut   ?? true) ? 1 : 0,
      seed:      opts.seed ?? 0,
      ...weightParams,
    }

    this._cdf          = new Float64Array(n)
    this._weightDigest = -1  // force CDF build on first update
    this._rebuildCDF()

    this.object3D = new Group()
    this.object3D.frustumCulled = false

    this._instances = opts.meshes.map(m => {
      const mesh = new InstancedMesh(m.geometry, m.material, max)
      mesh.frustumCulled = false
      mesh.count = 0
      for (let i = 0; i < max; i++) mesh.setMatrixAt(i, this._zeroMat)
      mesh.instanceMatrix.needsUpdate = true
      this.object3D.add(mesh)
      return mesh
    })

    this._counts     = new Int32Array(n)
    this._prevCounts = new Int32Array(n)

    this._allocDrawBuf(max)
  }

  update(
    particles: ParticleLike[],
    aliveCount: number,
    params?:    Record<string, number>,
    childRng?:  SeededRandom,
  ): void {
    const n = this._instances.length
    if (n === 0) return

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
    const seed      = Math.floor(Math.abs(this.parameters.seed))

    if (billboard && this.camera) {
      this.camera.getWorldQuaternion(this._camQuat)
    }

    // Rebuild CDF if any weight parameter changed since last frame
    const digest = this._weightDigest_(n)
    if (digest !== this._weightDigest) {
      this._rebuildCDF()
      this._weightDigest = digest
    }

    // Reset per-mesh write cursors
    for (let i = 0; i < n; i++) this._counts[i] = 0

    for (let di = 0; di < drawCount; di++) {
      const d  = this._drawBuf[di]
      // Use parent's pool index for stable, deterministic mesh assignment.
      // Mix seed into a cheap hash so seed shifts the distribution without
      // breaking the per-particle stability guarantee.
      const hash = (d.poolIdx * 2654435761 + seed * 40503) >>> 0
      const r    = (hash & 0xFFFF) / 65536        // [0,1)
      const mi   = this._cdfSample(r)
      const slot = this._counts[mi]

      const s = d.size * (fadeOut ? 1 - d.normalised : 1)
      this._pos.set(d.position.x, d.position.y, d.position.z)
      this._scale.setScalar(Math.max(s, 0))

      if (billboard && this.camera) {
        this._matrix.compose(this._pos, this._camQuat, this._scale)
      } else {
        this._euler.set(d.rotation.x, d.rotation.y, d.rotation.z)
        this._quat.setFromEuler(this._euler)
        this._matrix.compose(this._pos, this._quat, this._scale)
      }

      this._instances[mi].setMatrixAt(slot, this._matrix)
      this._counts[mi]++
    }

    for (let i = 0; i < n; i++) {
      const mesh = this._instances[i]
      // Zero slots that were alive last frame but aren't now
      for (let j = this._counts[i]; j < this._prevCounts[i]; j++) {
        mesh.setMatrixAt(j, this._zeroMat)
      }
      this._prevCounts[i] = this._counts[i]
      mesh.count = this._counts[i]
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  /** Rebuild the CDF from current weight0…weightN parameters. */
  private _rebuildCDF(): void {
    const n = this._cdf.length
    let sum = 0
    for (let i = 0; i < n; i++) {
      const w = Math.max(0, this.parameters[`weight${i}`] ?? 1)
      sum += w
      this._cdf[i] = sum
    }
    if (sum > 0) {
      for (let i = 0; i < n; i++) this._cdf[i] /= sum
    } else {
      // All zero weights → uniform fallback
      for (let i = 0; i < n; i++) this._cdf[i] = (i + 1) / n
    }
  }

  /** Sample the CDF with r ∈ [0,1) → mesh index. */
  private _cdfSample(r: number): number {
    const n = this._cdf.length
    for (let i = 0; i < n; i++) {
      if (r < this._cdf[i]) return i
    }
    return n - 1
  }

  /** Fast digest of current weight values — used to detect runtime changes. */
  private _weightDigest_(n: number): number {
    let h = 0
    for (let i = 0; i < n; i++) {
      const w = this.parameters[`weight${i}`] ?? 1
      // FNV-1a inspired mix
      h = ((h ^ Math.round(w * 1000)) * 16777619) >>> 0
    }
    return h
  }

  dispose(): void {
    for (const mesh of this._instances) {
      mesh.geometry.dispose()
      ;(mesh.material as Material).dispose()
    }
  }
}
