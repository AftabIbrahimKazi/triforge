import { BufferGeometry, Vector3 } from 'three'

export interface DeflectorColliderOptions {
  friction?:  number
  damping?:   number
  stiffness?: number
}

/**
 * DeflectorCollider — mesh surface that bounces or kills particles on contact.
 * (Blender: Physics → Collision panel)
 *
 * buildBVH() precomputes a flat triangle list (vertex A + face normal per tri).
 * Called automatically on first use.
 */
export class DeflectorCollider {
  /** All scalar inputs — GSAP / keyframe compatible (Blender-matched names) */
  parameters: { friction: number; damping: number; stiffness: number }

  private _triangles: Float32Array = new Float32Array(0)  // [ax,ay,az,nx,ny,nz] per tri
  private _triCount = 0
  private _geometry: BufferGeometry
  private _built = false

  constructor(geometry: BufferGeometry, opts: DeflectorColliderOptions = {}) {
    this._geometry = geometry
    this.parameters = {
      friction:  opts.friction  ?? 0,
      damping:   opts.damping   ?? 0.5,
      stiffness: opts.stiffness ?? 1,
    }
  }

  /** Precompute triangle planes from geometry. Called automatically on first use. */
  buildBVH(): void {
    const geo = this._geometry
    const pos = geo.getAttribute('position')
    const idx = geo.getIndex()
    if (!pos) return

    let triCount: number
    let getVerts: (i: number) => [number, number, number]

    if (idx) {
      triCount = Math.floor(idx.count / 3)
      getVerts = (i) => [idx.getX(i * 3), idx.getX(i * 3 + 1), idx.getX(i * 3 + 2)]
    } else {
      triCount = Math.floor(pos.count / 3)
      getVerts = (i) => [i * 3, i * 3 + 1, i * 3 + 2]
    }

    // 6 floats per triangle: vertex A (x,y,z) + face normal (x,y,z)
    this._triangles = new Float32Array(triCount * 6)
    this._triCount  = triCount

    const vA = new Vector3(), vB = new Vector3(), vC = new Vector3()
    const e1  = new Vector3(), e2  = new Vector3()

    for (let i = 0; i < triCount; i++) {
      const [a, b, c] = getVerts(i)
      vA.fromBufferAttribute(pos, a)
      vB.fromBufferAttribute(pos, b)
      vC.fromBufferAttribute(pos, c)

      e1.subVectors(vB, vA)
      e2.subVectors(vC, vA)
      const n = new Vector3().crossVectors(e1, e2).normalize()

      const o = i * 6
      this._triangles[o]     = vA.x
      this._triangles[o + 1] = vA.y
      this._triangles[o + 2] = vA.z
      this._triangles[o + 3] = n.x
      this._triangles[o + 4] = n.y
      this._triangles[o + 5] = n.z
    }

    this._built = true
  }

  /**
   * Find the closest triangle plane to (px, py, pz).
   * Returns true if any triangle is within parameters.stiffness × 0.5 world units.
   */
  closestPoint(
    px: number, py: number, pz: number,
    out: { point: Vector3; normal: Vector3; dist: number },
  ): boolean {
    if (!this._built) this.buildBVH()

    const threshold = this.parameters.stiffness * 0.5
    let minDist = Infinity
    let found   = false

    for (let i = 0; i < this._triCount; i++) {
      const o  = i * 6
      const ax = this._triangles[o],     ay = this._triangles[o + 1], az = this._triangles[o + 2]
      const nx = this._triangles[o + 3], ny = this._triangles[o + 4], nz = this._triangles[o + 5]

      const d    = (px - ax) * nx + (py - ay) * ny + (pz - az) * nz
      const dist = Math.abs(d)

      if (dist < threshold && dist < minDist) {
        minDist = dist
        out.point.set(px - d * nx, py - d * ny, pz - d * nz)
        out.normal.set(nx, ny, nz)
        out.dist = dist
        found = true
      }
    }

    return found
  }

  /**
   * Test whether the particle segment (prev → curr) crosses any triangle plane.
   * radius (default 0) offsets the plane by the particle's collision radius so
   * particles bounce before touching the surface (Blender: Size Deflect).
   * Writes face normal and contact point to outNormal/outPoint on hit.
   * Returns true if a crossing was detected.
   */
  checkCrossing(
    prevX: number, prevY: number, prevZ: number,
    currX: number, currY: number, currZ: number,
    outNormal: Vector3,
    outPoint:  Vector3,
    radius = 0,
  ): boolean {
    if (!this._built) this.buildBVH()

    for (let i = 0; i < this._triCount; i++) {
      const o  = i * 6
      const ax = this._triangles[o],     ay = this._triangles[o + 1], az = this._triangles[o + 2]
      const nx = this._triangles[o + 3], ny = this._triangles[o + 4], nz = this._triangles[o + 5]

      const dPrev = (prevX - ax) * nx + (prevY - ay) * ny + (prevZ - az) * nz
      const dCurr = (currX - ax) * nx + (currY - ay) * ny + (currZ - az) * nz

      if (dPrev >= radius && dCurr < radius) {
        outNormal.set(nx, ny, nz)
        // Project current position back to the offset contact plane
        outPoint.set(
          currX - (dCurr - radius) * nx,
          currY - (dCurr - radius) * ny,
          currZ - (dCurr - radius) * nz,
        )
        return true
      }
    }

    return false
  }
}
