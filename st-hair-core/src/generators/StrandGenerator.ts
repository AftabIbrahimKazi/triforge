import { BufferGeometry, BufferAttribute } from 'three'
import type { Strand } from '../core/Strand.js'

/**
 * StrandGenerator — distribute hair strands on a mesh surface.
 * Blender: Particle System > Hair, distributed on mesh.
 *
 * Generates strands rooted at random surface points, growing along
 * interpolated normals with optional tip displacement.
 */
export interface StrandGeneratorOptions {
  /** Number of strands. Blender: Number. */
  count:         number
  /** Strand length. Blender: Hair Length. */
  length:        number
  /** Control points per strand. Blender: Steps. */
  segments:      number
  /** Random seed. Blender: Seed. */
  seed:          number
  /** Length variation [0,1]. Blender: Length Random. */
  lengthRandom?: number
  /** Tip spread in the normal plane. */
  spread?:       number
  /** Gravity pull toward -Y [0,1]. */
  gravity?:      number
}

export class StrandGenerator {
  parameters: {
    count:        number
    length:       number
    segments:     number
    seed:         number
    lengthRandom: number
    spread:       number
    gravity:      number
  }

  constructor(opts: Partial<StrandGeneratorOptions> = {}) {
    this.parameters = {
      count:        opts.count        ?? 100,
      length:       opts.length       ?? 1,
      segments:     opts.segments     ?? 6,
      seed:         opts.seed         ?? 0,
      lengthRandom: opts.lengthRandom ?? 0,
      spread:       opts.spread       ?? 0,
      gravity:      opts.gravity      ?? 0,
    }
  }

  /**
   * Generate strands distributed on the surface of a BufferGeometry.
   * The geometry must have position and normal attributes.
   */
  generate(mesh: BufferGeometry): Strand[] {
    const { count, length, segments, seed, lengthRandom, spread, gravity } = this.parameters
    const posAttr = mesh.getAttribute('position') as BufferAttribute
    const norAttr = mesh.getAttribute('normal')   as BufferAttribute | undefined
    const index   = mesh.getIndex()

    // Collect triangles [a, b, c, normal]
    type Tri = { a: [number,number,number]; b: [number,number,number]; c: [number,number,number]; n: [number,number,number] }
    const tris: Tri[] = []

    const getPos = (i: number): [number,number,number] => [posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)]
    const getNor = (i: number): [number,number,number] => norAttr
      ? [norAttr.getX(i), norAttr.getY(i), norAttr.getZ(i)]
      : [0, 1, 0]

    const addTri = (ia: number, ib: number, ic: number) => {
      const a = getPos(ia), b = getPos(ib), c = getPos(ic)
      const na = getNor(ia), nb = getNor(ib), nc = getNor(ic)
      const avgN = norm([(na[0]+nb[0]+nc[0])/3, (na[1]+nb[1]+nc[1])/3, (na[2]+nb[2]+nc[2])/3])
      tris.push({ a, b, c, n: avgN })
    }

    if (index) {
      for (let i = 0; i < index.count; i += 3) addTri(index.getX(i), index.getX(i+1), index.getX(i+2))
    } else {
      for (let i = 0; i < posAttr.count; i += 3) addTri(i, i+1, i+2)
    }

    // Area-weighted CDF
    const areas = tris.map(({ a, b, c }) => {
      const abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2]
      const acx=c[0]-a[0],acy=c[1]-a[1],acz=c[2]-a[2]
      const cx=aby*acz-abz*acy,cy=abz*acx-abx*acz,cz=abx*acy-aby*acx
      return Math.sqrt(cx*cx+cy*cy+cz*cz) * 0.5
    })
    const totalArea = areas.reduce((s,a) => s+a, 0)
    const cdf = areas.map(((s=0) => (a: number) => (s += a))(0))

    // LCG RNG
    let lcg = (seed | 0) ^ 0xdeadbeef
    const rand = () => { lcg=(Math.imul(lcg,1664525)+1013904223)>>>0; return lcg/0x100000000 }

    const strands: Strand[] = []

    for (let i = 0; i < count; i++) {
      // Pick triangle
      const r = rand() * totalArea
      let ti = cdf.findIndex(c => c >= r)
      if (ti < 0) ti = tris.length - 1
      const { a, b, c, n } = tris[ti]

      // Random barycentric
      let u = rand(), v = rand()
      if (u + v > 1) { u = 1-u; v = 1-v }
      const w = 1 - u - v
      const root: [number,number,number] = [a[0]*w+b[0]*u+c[0]*v, a[1]*w+b[1]*u+c[1]*v, a[2]*w+b[2]*u+c[2]*v]

      // Strand length with variation
      const L = length * (1 - lengthRandom * rand())

      // Random spread direction — rotate a full circle in the normal plane
      const perp = perpTo(n)
      const bino: [number,number,number] = [
        n[1]*perp[2] - n[2]*perp[1],
        n[2]*perp[0] - n[0]*perp[2],
        n[0]*perp[1] - n[1]*perp[0],
      ]
      const angle = rand() * Math.PI * 2
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const sd: [number,number,number] = [
        perp[0]*cos + bino[0]*sin,
        perp[1]*cos + bino[1]*sin,
        perp[2]*cos + bino[2]*sin,
      ]

      // Build control points
      // Gravity: component of [0,-1,0] perpendicular to strand normal.
      // g_perp = g - n*(n·g),  g=[0,-1,0],  n·g = -n[1]
      const ndg = -n[1]
      const gravPerp: [number,number,number] = [
        0 - n[0] * ndg,
        -1 - n[1] * ndg,
        0 - n[2] * ndg,
      ]
      const points: [number,number,number][] = []
      for (let j = 0; j <= segments; j++) {
        const t = j / segments
        const sag = gravity * t * t * L
        points.push([
          root[0] + n[0] * L * t + sd[0] * spread * t + gravPerp[0] * sag,
          root[1] + n[1] * L * t + sd[1] * spread * t + gravPerp[1] * sag,
          root[2] + n[2] * L * t + sd[2] * spread * t + gravPerp[2] * sag,
        ])
      }

      strands.push({ points, normal: n })
    }

    return strands
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
type V3 = [number,number,number]
const norm = ([x,y,z]: V3): V3 => { const l=Math.sqrt(x*x+y*y+z*z)||1; return [x/l,y/l,z/l] }
const perpTo = ([x,y,z]: V3): V3 => {
  const v: V3 = Math.abs(x) < 0.9 ? [1,0,0] : [0,1,0]
  const d = x*v[0]+y*v[1]+z*v[2]
  return norm([v[0]-d*x, v[1]-d*y, v[2]-d*z])
}
