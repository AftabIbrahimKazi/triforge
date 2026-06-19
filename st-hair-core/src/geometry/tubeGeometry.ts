import { BufferGeometry, BufferAttribute } from 'three'
import type { Strand } from '../core/Strand.js'
import { computeRMFrames } from '../core/Strand.js'

/**
 * Build a tube BufferGeometry for a single strand.
 * Each strand gets a circular cross-section that tapers from root to tip.
 */
export function buildTubeStrand(
  strand: Strand,
  steps:         number,
  crossSections: number,
  radiusRoot:    number,
  radiusTip:     number,
): { pos: number[]; nor: number[]; uvs: number[]; tan: number[]; idx: number[]; baseVertex: number } {
  const frames = computeRMFrames(strand.points, steps)
  const cols   = crossSections + 1
  const w      = strand.width ?? 1

  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], tan: number[] = [], idx: number[] = []

  for (let i = 0; i <= steps; i++) {
    const { pos: p, tangent: T, normal: n, binormal: b } = frames[i]
    const t      = i / steps
    const radius = (radiusRoot * (1 - t) + radiusTip * t) * w

    for (let c = 0; c <= crossSections; c++) {
      const angle = (c / crossSections) * Math.PI * 2
      const cos   = Math.cos(angle), sin = Math.sin(angle)
      const nx    = n[0]*cos + b[0]*sin
      const ny    = n[1]*cos + b[1]*sin
      const nz    = n[2]*cos + b[2]*sin
      pos.push(p[0] + nx*radius, p[1] + ny*radius, p[2] + nz*radius)
      nor.push(nx, ny, nz)
      uvs.push(c / crossSections, t)
      tan.push(T[0], T[1], T[2])  // same tangent for all verts in this ring
    }
  }

  for (let i = 0; i < steps; i++) {
    const rowA = i * cols
    const rowB = rowA + cols
    for (let c = 0; c < crossSections; c++) {
      const a = rowA + c, b = rowB + c
      idx.push(a, b, a+1, b, b+1, a+1)
    }
  }

  return { pos, nor, uvs, tan, idx, baseVertex: 0 }
}

/**
 * Build a merged tube BufferGeometry from multiple strands.
 * All strands share one geometry for efficient rendering.
 */
export function buildTubeGeometry(
  strands:       Strand[],
  steps:         number,
  crossSections: number,
  radiusRoot:    number,
  radiusTip:     number,
): BufferGeometry {
  const allPos: number[] = [], allNor: number[] = [], allUvs: number[] = [], allTan: number[] = [], allRnd: number[] = [], allIdx: number[] = []
  let base = 0

  for (let si = 0; si < strands.length; si++) {
    const { pos, nor, uvs, tan, idx } = buildTubeStrand(strands[si], steps, crossSections, radiusRoot, radiusTip)
    for (const i of idx) allIdx.push(i + base)
    allPos.push(...pos); allNor.push(...nor); allUvs.push(...uvs); allTan.push(...tan)
    const rnd = (si * 2654435761) % 0x100000000 / 0x100000000
    for (let v = 0; v < pos.length / 3; v++) allRnd.push(rnd)
    base += pos.length / 3
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
