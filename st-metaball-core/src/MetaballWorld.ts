import { Mesh, MeshStandardMaterial, type Material } from 'three'
import { buildMetaballGeometry, type SolverBall } from './MarchingCubesSolver.js'
import type { MetaballObject } from './MetaballObject.js'

export interface MetaballWorldOptions {
  /** Grid resolution per axis. Default 28. Higher = smoother, heavier. */
  resolution?: number
  /** World-space half-extent of the volume. Default 1.5. */
  extent?: number
  /** Iso-surface threshold. Default 0.5. Lower = larger blobs that merge earlier. */
  threshold?: number
  /** Material for the mesh. */
  material?: Material
}

export class MetaballWorld {
  /** The Three.js Mesh — add this to your scene. */
  readonly mesh: Mesh

  readonly balls: MetaballObject[] = []

  parameters: { threshold: number; resolution: number; extent: number }

  /** Reused across update() calls to avoid reallocating the solver-ball array every frame. */
  private readonly _solverBallsBuffer: SolverBall[] = []

  constructor(opts: MetaballWorldOptions = {}) {
    const res = opts.resolution ?? 28
    const thr = opts.threshold  ?? 0.5
    const ext = opts.extent     ?? 1.5

    this.parameters = { threshold: thr, resolution: res, extent: ext }

    const mat = opts.material ?? new MeshStandardMaterial({
      color:     0x88aacc,
      roughness: 0.4,
      metalness: 0.1,
    })

    this.mesh = new Mesh(undefined, mat)
    this.mesh.castShadow    = true
    this.mesh.receiveShadow = true
  }

  add(...balls: MetaballObject[]): this {
    this.balls.push(...balls)
    return this
  }

  remove(ball: MetaballObject): this {
    const i = this.balls.indexOf(ball)
    if (i !== -1) this.balls.splice(i, 1)
    return this
  }

  /**
   * Rebuild the iso-surface geometry from the current ball positions.
   * Call every frame when any ball moves or changes.
   */
  update(): void {
    const buffer = this._solverBallsBuffer
    buffer.length = this.balls.length
    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i]
      // combine radius and strength into effective radius
      const r = b.parameters.radius * Math.sqrt(b.parameters.strength)
      const entry = buffer[i]
      if (entry) {
        entry.x = b.position.x
        entry.y = b.position.y
        entry.z = b.position.z
        entry.r = r
        entry.negative = b.negative
      } else {
        buffer[i] = { x: b.position.x, y: b.position.y, z: b.position.z, r, negative: b.negative }
      }
    }

    const oldGeo = this.mesh.geometry
    this.mesh.geometry = buildMetaballGeometry(
      buffer,
      this.parameters.threshold,
      this.parameters.resolution,
      this.parameters.extent,
    )
    if (oldGeo) oldGeo.dispose()
  }

  setPosition(x: number, y: number, z: number): this {
    this.mesh.position.set(x, y, z)
    return this
  }

  setScale(s: number): this {
    this.mesh.scale.setScalar(s)
    return this
  }
}
