import { BufferGeometry, BufferAttribute } from 'three'
import type { Strand } from '../core/Strand.js'
import { sampleSpline, sampleTangent } from '../core/Strand.js'

/**
 * Build a flat ribbon BufferGeometry from multiple strands.
 * Each strand becomes a quad strip oriented by `up` cross tangent.
 * Good for dense grass, fur, feathers.
 * Blender: Hair > Shape > Strand Shape ribbon mode.
 */
export function buildRibbonGeometry(
  strands:    Strand[],
  steps:      number,
  widthRoot:  number,
  widthTip:   number,
  up:         [number, number, number] = [0, 1, 0],
): BufferGeometry {
  const allPos: number[] = [], allNor: number[] = [], allUvs: number[] = [], allTan: number[] = [], allRnd: number[] = [], allIdx: number[] = []
  let base = 0

  for (let si = 0; si < strands.length; si++) {
    const strand = strands[si]
    const rnd = (si * 2654435761) % 0x100000000 / 0x100000000
    const w = strand.width ?? 1

    for (let i = 0; i <= steps; i++) {
      const t   = i / steps
      const p   = sampleSpline(strand.points, t)
      const tan = sampleTangent(strand.points, t)

      // Side axis = tangent × up, normalised
      const sx = tan[1]*up[2] - tan[2]*up[1]
      const sy = tan[2]*up[0] - tan[0]*up[2]
      const sz = tan[0]*up[1] - tan[1]*up[0]
      const sl = Math.sqrt(sx*sx+sy*sy+sz*sz) || 1
      const sxn = sx/sl, syn = sy/sl, szn = sz/sl

      // Normal = tangent × side
      const nx = tan[1]*szn - tan[2]*syn
      const ny = tan[2]*sxn - tan[0]*szn
      const nz = tan[0]*syn - tan[1]*sxn

      const hw = (widthRoot * (1-t) + widthTip * t) * w * 0.5

      allPos.push(p[0]-sxn*hw, p[1]-syn*hw, p[2]-szn*hw)
      allPos.push(p[0]+sxn*hw, p[1]+syn*hw, p[2]+szn*hw)
      allNor.push(nx, ny, nz, nx, ny, nz)
      allUvs.push(0, t, 1, t)
      allTan.push(tan[0], tan[1], tan[2], tan[0], tan[1], tan[2])
      allRnd.push(rnd, rnd)
    }

    const cols = 2
    for (let i = 0; i < steps; i++) {
      const a = base + i*cols, b = a + cols
      allIdx.push(a, b, a+1, b, b+1, a+1)
    }
    base += (steps + 1) * 2
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position',      new BufferAttribute(new Float32Array(allPos), 3))
  geo.setAttribute('normal',        new BufferAttribute(new Float32Array(allNor), 3))
  geo.setAttribute('uv',            new BufferAttribute(new Float32Array(allUvs), 2))
  geo.setAttribute('strandTangent', new BufferAttribute(new Float32Array(allTan), 3))
  geo.setAttribute('strandRandom',  new BufferAttribute(new Float32Array(allRnd), 1))
  geo.setIndex(allIdx)
  return geo
}
