import type { Object3D } from 'three'
import type { SeededRandom } from './SeededRandom.js'

/**
 * Structural interface satisfied by both Particle and the pre-allocated
 * child draw-buffer entries.  Renderers iterate this instead of Particle[]
 * so children (which are not real pool particles) can pass through the same
 * draw loop.
 */
export interface ParticleLike {
  position:   { x: number; y: number; z: number }
  velocity:   { x: number; y: number; z: number }
  rotation:   { x: number; y: number; z: number }
  size:       number
  normalised: number
  alive:      boolean
  lifetime:   number
  age:        number
  emitterIndex: number
}

/** Pre-allocated draw-buffer entry — also carries the parent pool index. */
interface DrawEntry extends ParticleLike {
  poolIdx: number
}

/**
 * Abstract base for all particle renderers.
 * A renderer owns a Three.js Object3D and updates it each tick
 * from the live particle array.
 *
 * Concrete subclasses: BillboardRenderer, InstanceRenderer, LineRenderer.
 */
export abstract class BaseRenderer {
  /** The Three.js object to add to the scene */
  abstract readonly object3D: Object3D

  /**
   * Show or hide the particle helper geometry.
   * In Blender this is the viewport dot/sphere representation —
   * hidden in final renders. Set false to see only the resulting
   * mesh/material assigned to the particles, not the placeholders.
   */
  get visible(): boolean { return this.object3D.visible }
  set visible(v: boolean) { this.object3D.visible = v }

  /**
   * Called once per frame with the full particle pool.
   * Update GPU buffers here — no allocations allowed inside this method.
   *
   * params and childRng are optional so that legacy callers (unit tests) that
   * pass only (particles, aliveCount) still work — children are disabled when
   * params is omitted or params.childCount is 0.
   */
  abstract update(
    particles: ParticleLike[],
    aliveCount: number,
    params?:   Record<string, number>,
    childRng?: SeededRandom,
  ): void

  /** Free GPU resources */
  abstract dispose(): void

  // ── Children expansion infrastructure ────────────────────────────────────

  /**
   * Pre-allocated draw buffer — filled each frame by expandWithChildren().
   * Concrete constructors must call _allocDrawBuf(maxCount) to initialise it.
   */
  protected _drawBuf: DrawEntry[] = []

  /**
   * Pre-allocated alive-particle scratch list — filled inside expandWithChildren
   * for the interpolated pass without heap allocations.
   */
  protected _aliveBuf: ParticleLike[] = []

  /**
   * Allocate both pre-allocated buffers.
   * Call once from each concrete renderer's constructor, passing maxCount.
   */
  protected _allocDrawBuf(max: number): void {
    this._drawBuf = Array.from({ length: max }, () => ({
      position:   { x: 0, y: 0, z: 0 },
      velocity:   { x: 0, y: 0, z: 0 },
      rotation:   { x: 0, y: 0, z: 0 },
      size:       1,
      normalised: 0,
      alive:      true,
      lifetime:   1,
      age:        0,
      emitterIndex: 0,
      poolIdx:    0,
    }))
    // _aliveBuf only needs room for alive particles, worst case = max
    this._aliveBuf = new Array<ParticleLike>(max)
  }

  /**
   * Expand the particle pool with children and write the result into _drawBuf.
   * Returns the number of entries written (≤ maxCount).
   *
   * When childCount === 0 or childType === 0 this copies only alive parents —
   * the caller's draw loop then iterates _drawBuf[0..n] instead of pool,
   * skipping dead slots for free.
   *
   * childType:  0 = none (parents only)
   *             1 = simple   (random sphere scatter)
   *             2 = interpolated (between consecutive parents)
   */
  protected expandWithChildren(
    pool:        ParticleLike[],
    _aliveCount: number,
    childCount:  number,
    childType:   number,
    childSpread: number,
    rng:         SeededRandom | null,
    maxCount:    number,
  ): number {
    const cc = Math.round(Math.max(0, childCount))
    const ct = Math.round(childType)

    // ── No children — copy alive parents only ─────────────────────────────
    if (cc === 0 || ct === 0) {
      let n = 0
      for (let pi = 0; pi < pool.length; pi++) {
        const p = pool[pi]
        if (!p.alive) continue
        if (n >= maxCount) break
        this._copyToEntry(this._drawBuf[n], p, pi)
        n++
      }
      return n
    }

    // ── Build alive list (no allocations — writes into _aliveBuf) ─────────
    let an = 0
    for (let pi = 0; pi < pool.length; pi++) {
      const p = pool[pi]
      if (p.alive) {
        this._aliveBuf[an] = p
        // stash pool index in the drawbuf slot we'll use later; easiest to
        // track it separately via a parallel index trick below
        an++
      }
    }

    // Also need pool indices for each alive particle — re-scan is cheap
    let n = 0

    if (ct === 1) {
      // ── Simple children — random sphere around each parent ───────────────
      // Re-scan pool to preserve pool indices without extra allocation
      let ai = 0
      for (let pi = 0; pi < pool.length; pi++) {
        const p = pool[pi]
        if (!p.alive) continue
        if (n >= maxCount) break

        // Write parent
        this._copyToEntry(this._drawBuf[n], p, pi)
        n++
        ai++

        // Write children
        for (let ci = 0; ci < cc; ci++) {
          if (n >= maxCount) break
          const d = this._drawBuf[n]
          this._copyToEntry(d, p, pi)

          if (childSpread > 0 && rng !== null) {
            // Uniform sphere placement — 3 rng calls per child, no loops
            const theta = rng.next() * 6.283185307
            const phi   = Math.acos(1 - 2 * rng.next())
            const r     = childSpread * Math.cbrt(rng.next())
            d.position.x = p.position.x + r * Math.sin(phi) * Math.cos(theta)
            d.position.y = p.position.y + r * Math.sin(phi) * Math.sin(theta)
            d.position.z = p.position.z + r * Math.cos(phi)
          }
          n++
        }
      }
    } else {
      // ── Interpolated children — lerp between consecutive alive parents ───
      if (an === 0) return 0

      let ai = 0
      for (let pi = 0; pi < pool.length; pi++) {
        const p = pool[pi]
        if (!p.alive) continue
        if (n >= maxCount) break

        // Write parent
        this._copyToEntry(this._drawBuf[n], p, pi)
        n++

        const nextAi = (ai + 1) % an
        const p1     = this._aliveBuf[nextAi]

        // Write children interpolated between p and p1
        for (let ci = 0; ci < cc; ci++) {
          if (n >= maxCount) break
          const t = (ci + 1) / (cc + 1)
          const d = this._drawBuf[n]
          d.position.x  = p.position.x  + (p1.position.x  - p.position.x)  * t
          d.position.y  = p.position.y  + (p1.position.y  - p.position.y)  * t
          d.position.z  = p.position.z  + (p1.position.z  - p.position.z)  * t
          d.velocity.x  = p.velocity.x  + (p1.velocity.x  - p.velocity.x)  * t
          d.velocity.y  = p.velocity.y  + (p1.velocity.y  - p.velocity.y)  * t
          d.velocity.z  = p.velocity.z  + (p1.velocity.z  - p.velocity.z)  * t
          d.rotation.x  = p.rotation.x
          d.rotation.y  = p.rotation.y
          d.rotation.z  = p.rotation.z
          d.size        = p.size        + (p1.size        - p.size)        * t
          d.normalised  = p.normalised  + (p1.normalised  - p.normalised)  * t
          d.alive       = true
          d.lifetime    = p.lifetime
          d.age         = p.age
          d.emitterIndex = p.emitterIndex
          d.poolIdx     = pi
          n++
        }

        ai++
      }
    }

    return n
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _copyToEntry(d: DrawEntry, p: ParticleLike, poolIdx: number): void {
    d.position.x  = p.position.x
    d.position.y  = p.position.y
    d.position.z  = p.position.z
    d.velocity.x  = p.velocity.x
    d.velocity.y  = p.velocity.y
    d.velocity.z  = p.velocity.z
    d.rotation.x  = p.rotation.x
    d.rotation.y  = p.rotation.y
    d.rotation.z  = p.rotation.z
    d.size        = p.size
    d.normalised  = p.normalised
    d.alive       = true
    d.lifetime    = p.lifetime
    d.age         = p.age
    d.emitterIndex = p.emitterIndex
    d.poolIdx     = poolIdx
  }
}
