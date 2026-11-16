import type { RayHit, RayIntersector, TriangleSoup } from '../types.js'

const LEAF_SIZE = 4
const STACK_SIZE = 96
const EPSILON = 1e-9
const MIN_T = 1e-6
const FAR = 1e30
const COORDS = 3
const TRI_FLOATS = 9
const NODE_FLOATS = 6

type BuildTask = [node: number, first: number, end: number]

export class BuiltInIntersector implements RayIntersector {
  private readonly positions: Float32Array
  private readonly order: Uint32Array
  private bounds = new Float32Array(0)
  private left = new Int32Array(0)
  private right = new Int32Array(0)
  private start = new Int32Array(0)
  private size = new Int32Array(0)
  private nodeCount = 0
  private readonly stack = new Int32Array(STACK_SIZE)

  constructor(soup: TriangleSoup) {
    this.positions = soup.positions
    this.order = new Uint32Array(soup.count)
    for (let i = 0; i < soup.count; i++) this.order[i] = i
    this.build(soup.count)
  }

  raycast(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    hit: RayHit,
  ): boolean {
    if (this.nodeCount === 0) return false
    const ix = 1 / dx
    const iy = 1 / dy
    const iz = 1 / dz
    let bestT = FAR
    let bestTri = -1
    let top = 0
    this.stack[top++] = 0
    while (top > 0) {
      const node = this.stack[--top]
      if (!this.hitsBox(node, ox, oy, oz, ix, iy, iz, bestT)) continue
      if (this.left[node] < 0) {
        const first = this.start[node]
        const end = first + this.size[node]
        for (let k = first; k < end; k++) {
          const tri = this.order[k]
          const t = this.triangleT(tri, ox, oy, oz, dx, dy, dz)
          if (t < bestT) {
            bestT = t
            bestTri = tri
          }
        }
      } else if (top + 2 <= STACK_SIZE) {
        this.stack[top++] = this.left[node]
        this.stack[top++] = this.right[node]
      }
    }
    if (bestTri < 0) return false
    hit.t = bestT
    hit.triangle = bestTri
    return true
  }

  private build(count: number): void {
    if (count === 0) return
    const maxNodes = count * 2
    this.bounds = new Float32Array(maxNodes * NODE_FLOATS)
    this.left = new Int32Array(maxNodes).fill(-1)
    this.right = new Int32Array(maxNodes).fill(-1)
    this.start = new Int32Array(maxNodes)
    this.size = new Int32Array(maxNodes)
    const centroids = this.centroids(count)
    const pending: BuildTask[] = [[this.newNode(), 0, count]]
    for (let task = pending.pop(); task !== undefined; task = pending.pop()) {
      const [node, first, end] = task
      this.fitBounds(node, first, end)
      if (end - first <= LEAF_SIZE) {
        this.start[node] = first
        this.size[node] = end - first
        continue
      }
      const axis = this.longestAxis(node)
      this.order.subarray(first, end).sort(
        (a, b) => centroids[a * COORDS + axis] - centroids[b * COORDS + axis],
      )
      const mid = (first + end) >> 1
      const l = this.newNode()
      const r = this.newNode()
      this.left[node] = l
      this.right[node] = r
      pending.push([l, first, mid], [r, mid, end])
    }
  }

  private newNode(): number {
    return this.nodeCount++
  }

  private centroids(count: number): Float32Array {
    const out = new Float32Array(count * COORDS)
    for (let t = 0; t < count; t++) {
      for (let a = 0; a < COORDS; a++) {
        const base = t * TRI_FLOATS + a
        out[t * COORDS + a] =
          (this.positions[base] + this.positions[base + COORDS] + this.positions[base + 2 * COORDS]) / COORDS
      }
    }
    return out
  }

  private fitBounds(node: number, first: number, end: number): void {
    const mins = [Infinity, Infinity, Infinity]
    const maxs = [-Infinity, -Infinity, -Infinity]
    for (let k = first; k < end; k++) {
      const base = this.order[k] * TRI_FLOATS
      for (let v = 0; v < COORDS; v++) {
        for (let a = 0; a < COORDS; a++) {
          const value = this.positions[base + v * COORDS + a]
          if (value < mins[a]) mins[a] = value
          if (value > maxs[a]) maxs[a] = value
        }
      }
    }
    const o = node * NODE_FLOATS
    for (let a = 0; a < COORDS; a++) {
      this.bounds[o + a] = mins[a]
      this.bounds[o + COORDS + a] = maxs[a]
    }
  }

  private longestAxis(node: number): number {
    const o = node * NODE_FLOATS
    let best = 0
    let bestExtent = -1
    for (let a = 0; a < COORDS; a++) {
      const extent = this.bounds[o + COORDS + a] - this.bounds[o + a]
      if (extent > bestExtent) {
        bestExtent = extent
        best = a
      }
    }
    return best
  }

  private hitsBox(
    node: number,
    ox: number, oy: number, oz: number,
    ix: number, iy: number, iz: number,
    limit: number,
  ): boolean {
    const b = this.bounds
    const o = node * NODE_FLOATS
    let t0 = 0
    let t1 = limit
    let a = (b[o] - ox) * ix
    let c = (b[o + 3] - ox) * ix
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
    a = (b[o + 1] - oy) * iy
    c = (b[o + 4] - oy) * iy
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
    a = (b[o + 2] - oz) * iz
    c = (b[o + 5] - oz) * iz
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
    return t0 <= t1
  }

  private triangleT(
    tri: number,
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
  ): number {
    const p = this.positions
    const i = tri * TRI_FLOATS
    const e1x = p[i + 3] - p[i]
    const e1y = p[i + 4] - p[i + 1]
    const e1z = p[i + 5] - p[i + 2]
    const e2x = p[i + 6] - p[i]
    const e2y = p[i + 7] - p[i + 1]
    const e2z = p[i + 8] - p[i + 2]
    const px = dy * e2z - dz * e2y
    const py = dz * e2x - dx * e2z
    const pz = dx * e2y - dy * e2x
    const det = e1x * px + e1y * py + e1z * pz
    if (det > -EPSILON && det < EPSILON) return FAR
    const inv = 1 / det
    const sx = ox - p[i]
    const sy = oy - p[i + 1]
    const sz = oz - p[i + 2]
    const u = (sx * px + sy * py + sz * pz) * inv
    if (u < 0 || u > 1) return FAR
    const qx = sy * e1z - sz * e1y
    const qy = sz * e1x - sx * e1z
    const qz = sx * e1y - sy * e1x
    const v = (dx * qx + dy * qy + dz * qz) * inv
    if (v < 0 || u + v > 1) return FAR
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv
    return t > MIN_T ? t : FAR
  }
}
