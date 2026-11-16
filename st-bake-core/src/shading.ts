import type { RayHit, RayIntersector, SkyFunction, TriangleSoup, Vec3 } from './types.js'

const RAY_OFFSET = 1e-3
const TANGENT_SWITCH = 0.9
const TWO_PI = Math.PI * 2
const COORDS = 3

export interface ShaderSetup {
  soup: TriangleSoup
  intersector: RayIntersector
  albedo: Float32Array
  sunDirection: Vec3
  sunColor: Vec3
  sunIntensity: number
  sky: SkyFunction
  samples: number
  random: () => number
}

export class Shader {
  private readonly hit: RayHit = { t: 0, triangle: -1 }
  private readonly radiance = new Float64Array(COORDS)

  constructor(private readonly setup: ShaderSetup) {}

  shade(
    px: number, py: number, pz: number,
    triangle: number,
    out: Float32Array, outOffset: number,
  ): void {
    const { soup, albedo, samples, random, intersector, sky } = this.setup
    const meshIndex = soup.triangleMesh[triangle]
    const nx = soup.normals[triangle * COORDS]
    const ny = soup.normals[triangle * COORDS + 1]
    const nz = soup.normals[triangle * COORDS + 2]
    const ox = px + nx * RAY_OFFSET
    const oy = py + ny * RAY_OFFSET
    const oz = pz + nz * RAY_OFFSET

    this.directSun(ox, oy, oz, nx, ny, nz, meshIndex)
    const dr = this.radiance[0]
    const dg = this.radiance[1]
    const db = this.radiance[2]

    let ir = 0
    let ig = 0
    let ib = 0
    const helperIsY = Math.abs(nx) > TANGENT_SWITCH
    const hx = helperIsY ? 0 : 1
    const hy = helperIsY ? 1 : 0
    let tx = hy * nz
    let ty = -hx * nz
    let tz = hx * ny - hy * nx
    const tl = Math.hypot(tx, ty, tz)
    tx /= tl
    ty /= tl
    tz /= tl
    const bx = ny * tz - nz * ty
    const by = nz * tx - nx * tz
    const bz = nx * ty - ny * tx

    for (let s = 0; s < samples; s++) {
      const r = Math.sqrt(random())
      const phi = TWO_PI * random()
      const a = r * Math.cos(phi)
      const b = r * Math.sin(phi)
      const c = Math.sqrt(Math.max(0, 1 - r * r))
      const dx = tx * a + bx * b + nx * c
      const dy = ty * a + by * b + ny * c
      const dz = tz * a + bz * b + nz * c
      if (intersector.raycast(ox, oy, oz, dx, dy, dz, this.hit)) {
        this.bounce(ox, oy, oz, dx, dy, dz)
        ir += this.radiance[0]
        ig += this.radiance[1]
        ib += this.radiance[2]
      } else {
        const [sr, sg, sb] = sky([dx, dy, dz])
        ir += sr
        ig += sg
        ib += sb
      }
    }

    const base = meshIndex * COORDS
    const r = dr + albedo[base] * (ir / samples)
    const g = dg + albedo[base + 1] * (ig / samples)
    const bl = db + albedo[base + 2] * (ib / samples)
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(bl)) {
      throw new RangeError('LightBaker: sky function returned a non-finite value')
    }
    out[outOffset] = r
    out[outOffset + 1] = g
    out[outOffset + 2] = bl
    out[outOffset + 3] = 1
  }

  private bounce(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): void {
    const { soup } = this.setup
    const tri = this.hit.triangle
    const t = this.hit.t
    let nx = soup.normals[tri * COORDS]
    let ny = soup.normals[tri * COORDS + 1]
    let nz = soup.normals[tri * COORDS + 2]
    if (nx * dx + ny * dy + nz * dz > 0) {
      nx = -nx
      ny = -ny
      nz = -nz
    }
    this.directSun(
      ox + dx * t + nx * RAY_OFFSET,
      oy + dy * t + ny * RAY_OFFSET,
      oz + dz * t + nz * RAY_OFFSET,
      nx, ny, nz,
      soup.triangleMesh[tri],
    )
  }

  private directSun(
    ox: number, oy: number, oz: number,
    nx: number, ny: number, nz: number,
    meshIndex: number,
  ): void {
    const { sunDirection, sunColor, sunIntensity, albedo, intersector } = this.setup
    const cosine = nx * sunDirection[0] + ny * sunDirection[1] + nz * sunDirection[2]
    this.radiance[0] = 0
    this.radiance[1] = 0
    this.radiance[2] = 0
    if (cosine <= 0) return
    if (intersector.raycast(ox, oy, oz, sunDirection[0], sunDirection[1], sunDirection[2], this.hit)) return
    const scale = (sunIntensity * cosine) / Math.PI
    const base = meshIndex * COORDS
    this.radiance[0] = albedo[base] * sunColor[0] * scale
    this.radiance[1] = albedo[base + 1] * sunColor[1] * scale
    this.radiance[2] = albedo[base + 2] * sunColor[2] * scale
  }
}
