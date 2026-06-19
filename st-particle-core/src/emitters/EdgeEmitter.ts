import { Vector3, BufferGeometry } from 'three'
import { BaseEmitter, BaseEmitterOptions } from '../core/BaseEmitter.js'
import type { Particle }     from '../core/Particle.js'
import type { SeededRandom } from '../core/SeededRandom.js'

export interface EdgeEmitterOptions extends BaseEmitterOptions {
  /**
   * Y threshold — only emit from edges whose midpoint Y is within
   * this distance of targetY. Used for waterline foam (y ≈ 0).
   * Default: Infinity (all edges).
   */
  yThreshold?: number
  /**
   * Target Y value to test against yThreshold. Default: 0.
   */
  targetY?: number
  /**
   * Only emit from edges whose midpoint Z is >= zMin (local space).
   * Use this to restrict emission to the shore-edge of an ocean mesh.
   * Default: -Infinity (all edges).
   */
  zMin?: number
  /**
   * Only emit from edges whose midpoint Z is <= zMax (local space).
   * Default: +Infinity (all edges).
   */
  zMax?: number
}

/**
 * EdgeEmitter — emits particles from mesh edges.
 *
 * Primary use case: waterline foam — edges where the ocean surface
 * crosses y ≈ 0 (the shore) are the emission source.
 *
 * yThreshold filters to only edges near the water surface.
 */
export class EdgeEmitter extends BaseEmitter {
  /** Cached candidate edges — rebuilt when geometry reference changes */
  private _edgeCache: [number, number][] = []
  private _lastGeo:   BufferGeometry | null = null

  constructor(opts: EdgeEmitterOptions = {}) {
    super(opts)
    this.parameters.yThreshold = opts.yThreshold ?? Infinity
    this.parameters.targetY    = opts.targetY    ?? 0
    this.parameters.zMin       = opts.zMin       ?? -Infinity
    this.parameters.zMax       = opts.zMax       ?? Infinity
  }

  spawn(particle: Particle, geometry: BufferGeometry | null, rng: SeededRandom): void {
    if (!geometry) return

    const pos      = geometry.getAttribute('position')
    const norm     = geometry.getAttribute('normal')
    const index    = geometry.getIndex()
    const yThr     = this.parameters.yThreshold
    const targetY  = this.parameters.targetY
    const zMin     = this.parameters.zMin
    const zMax     = this.parameters.zMax

    if (!pos) return

    // Rebuild edge cache only when geometry changes.
    // Without caching, every spawn scans all 18k+ edges — O(n) per particle.
    // With caching, scan happens once per geometry rebuild (once per frame).
    if (geometry !== this._lastGeo) {
      this._lastGeo   = geometry
      this._edgeCache = []

      const addEdge = (a: number, b: number) => {
        const my = (pos.getY(a) + pos.getY(b)) * 0.5
        const mz = (pos.getZ(a) + pos.getZ(b)) * 0.5
        if (Math.abs(my - targetY) > yThr) return
        if (mz < zMin || mz > zMax) return
        this._edgeCache.push([a, b])
      }

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2)
          addEdge(a, b); addEdge(b, c); addEdge(c, a)
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          addEdge(i, i + 1); addEdge(i + 1, i + 2); addEdge(i + 2, i)
        }
      }
    }

    if (this._edgeCache.length === 0) return

    const [a, b] = this._edgeCache[Math.floor(rng.next() * this._edgeCache.length)]

    // Random point along the edge
    const t = rng.next()
    particle.position.set(
      pos.getX(a) * (1 - t) + pos.getX(b) * t,
      pos.getY(a) * (1 - t) + pos.getY(b) * t,
      pos.getZ(a) * (1 - t) + pos.getZ(b) * t,
    )

    const normal = norm
      ? new Vector3(
          norm.getX(a) * (1 - t) + norm.getX(b) * t,
          norm.getY(a) * (1 - t) + norm.getY(b) * t,
          norm.getZ(a) * (1 - t) + norm.getZ(b) * t,
        ).normalize()
      : new Vector3(0, 1, 0)

    const tangent = new Vector3(
      pos.getX(b) - pos.getX(a),
      pos.getY(b) - pos.getY(a),
      pos.getZ(b) - pos.getZ(a),
    ).normalize()

    this.applyVelocity(particle, normal, tangent, rng)
  }
}
