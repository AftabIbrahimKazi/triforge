import type { MeshRange, TriangleSoup } from './types.js'

const POS_FLOATS = 9
const UV_FLOATS = 6
const CHANNELS = 4
const BARY_TOLERANCE = 1e-5
const MIN_DENOMINATOR = 1e-14
const DILATE_PASSES = 2
const NEIGHBOURS = [-1, 0, 1]

export interface TexelGrid {
  width: number
  height: number
  covered: Uint8Array
  positions: Float32Array
  triangles: Int32Array
}

function crossLength(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
}

export function textureSizeFor(
  soup: TriangleSoup,
  range: MeshRange,
  texelsPerMeter: number,
  maxTexels: number,
): number {
  let worldArea = 0
  let uvArea = 0
  for (let t = range.start; t < range.end; t++) {
    const p = t * POS_FLOATS
    const q = t * UV_FLOATS
    const P = soup.positions
    const U = soup.uvs
    worldArea +=
      crossLength(
        P[p + 3] - P[p], P[p + 4] - P[p + 1], P[p + 5] - P[p + 2],
        P[p + 6] - P[p], P[p + 7] - P[p + 1], P[p + 8] - P[p + 2],
      ) / 2
    uvArea += Math.abs((U[q + 2] - U[q]) * (U[q + 5] - U[q + 1]) - (U[q + 4] - U[q]) * (U[q + 3] - U[q + 1])) / 2
  }
  if (!(uvArea > 0)) return 0
  const wanted = Math.ceil(Math.sqrt((worldArea * texelsPerMeter * texelsPerMeter) / uvArea))
  return Math.max(1, Math.min(maxTexels, wanted))
}

export function rasterizeMesh(soup: TriangleSoup, range: MeshRange, size: number): TexelGrid {
  const texels = size * size
  const grid: TexelGrid = {
    width: size,
    height: size,
    covered: new Uint8Array(texels),
    positions: new Float32Array(texels * 3),
    triangles: new Int32Array(texels).fill(-1),
  }
  for (let t = range.start; t < range.end; t++) {
    rasterizeTriangle(soup, t, grid)
  }
  return grid
}

function rasterizeTriangle(soup: TriangleSoup, t: number, grid: TexelGrid): void {
  const U = soup.uvs
  const P = soup.positions
  const q = t * UV_FLOATS
  const p = t * POS_FLOATS
  const u0 = U[q], v0 = U[q + 1], u1 = U[q + 2], v1 = U[q + 3], u2 = U[q + 4], v2 = U[q + 5]
  const denom = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2)
  if (Math.abs(denom) < MIN_DENOMINATOR) return
  const { width, height } = grid
  const iMin = Math.max(0, Math.floor(Math.min(u0, u1, u2) * width) - 1)
  const iMax = Math.min(width - 1, Math.ceil(Math.max(u0, u1, u2) * width))
  const jMin = Math.max(0, Math.floor(Math.min(v0, v1, v2) * height) - 1)
  const jMax = Math.min(height - 1, Math.ceil(Math.max(v0, v1, v2) * height))
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      const texel = j * width + i
      if (grid.covered[texel]) continue
      const pu = (i + 0.5) / width
      const pv = (j + 0.5) / height
      const w0 = ((v1 - v2) * (pu - u2) + (u2 - u1) * (pv - v2)) / denom
      const w1 = ((v2 - v0) * (pu - u2) + (u0 - u2) * (pv - v2)) / denom
      const w2 = 1 - w0 - w1
      if (w0 < -BARY_TOLERANCE || w1 < -BARY_TOLERANCE || w2 < -BARY_TOLERANCE) continue
      grid.covered[texel] = 1
      grid.triangles[texel] = t
      for (let a = 0; a < 3; a++) {
        grid.positions[texel * 3 + a] = w0 * P[p + a] + w1 * P[p + 3 + a] + w2 * P[p + 6 + a]
      }
    }
  }
}

export function dilate(data: Float32Array, covered: Uint8Array, width: number, height: number): void {
  const filled = covered.slice()
  for (let pass = 0; pass < DILATE_PASSES; pass++) {
    const next = filled.slice()
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        if (filled[j * width + i]) continue
        const sum = [0, 0, 0]
        let count = 0
        for (const dj of NEIGHBOURS) {
          for (const di of NEIGHBOURS) {
            const ni = i + di
            const nj = j + dj
            if (ni < 0 || nj < 0 || ni >= width || nj >= height || !filled[nj * width + ni]) continue
            const o = (nj * width + ni) * CHANNELS
            sum[0] += data[o]
            sum[1] += data[o + 1]
            sum[2] += data[o + 2]
            count++
          }
        }
        if (count === 0) continue
        const o = (j * width + i) * CHANNELS
        data[o] = sum[0] / count
        data[o + 1] = sum[1] / count
        data[o + 2] = sum[2] / count
        data[o + 3] = 1
        next[j * width + i] = 1
      }
    }
    filled.set(next)
  }
}
