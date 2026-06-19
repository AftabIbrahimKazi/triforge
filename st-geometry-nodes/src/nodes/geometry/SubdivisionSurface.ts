import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * SubdivisionSurface — Loop subdivision.
 * Blender: Geometry Nodes > Mesh > Subdivision Surface
 *
 * Uses the full Loop formula (same algorithm as st-modifier-core SubdivisionModifier):
 *   New edge vertex (interior):  3/8*(v1+v2) + 1/8*(opp1+opp2)
 *   New edge vertex (boundary):  1/2*(v1+v2)
 *   Updated orig vertex (interior): (1 - n*β)*v + β*sum(neighbors)
 *   Updated orig vertex (boundary): 3/4*v + 1/8*(bn1+bn2)
 */
export class SubdivisionSurface extends GeometryNode {
  readonly nodeType = 'SubdivisionSurface'

  parameters: {
    /** Subdivision level 0–6. Blender: Level. */
    level: number
  }

  constructor(opts: {
    geometry?: OutputRef | BufferGeometry | null
    level?: number
  } = {}) {
    super()
    this.parameters = { level: opts.level ?? 1 }
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { Geometry: null }

    let geo = ensureIndexed(src)
    const level = Math.max(0, Math.min(6, this.parameters.level))
    for (let i = 0; i < level; i++) geo = loopSubdivide(geo)
    geo.computeVertexNormals()
    return { Geometry: geo }
  }
}

/** Ensure geometry has an index buffer; triangulate quads if needed. */
function ensureIndexed(src: BufferGeometry): BufferGeometry {
  const posAttr = src.getAttribute('position') as BufferAttribute
  const uvAttr  = src.getAttribute('uv') as BufferAttribute | undefined
  const idx     = src.getIndex()

  if (idx) return src  // already indexed — use as-is

  // Non-indexed: build a trivial index over the flat triangle soup
  const n   = posAttr.count
  const arr = new Uint32Array(n)
  for (let i = 0; i < n; i++) arr[i] = i
  const geo = src.clone()
  geo.setIndex(new BufferAttribute(arr, 1))
  return geo
}

function loopSubdivide(geometry: BufferGeometry): BufferGeometry {
  const pos = geometry.getAttribute('position') as BufferAttribute
  const uv  = geometry.getAttribute('uv')       as BufferAttribute | undefined
  const idx = geometry.getIndex()!

  const vCount = pos.count

  // Build flat triangle list
  const tris: [number, number, number][] = []
  const ia = idx.array
  for (let i = 0; i < ia.length; i += 3) tris.push([ia[i], ia[i+1], ia[i+2]])

  // Build adjacency
  const edgeOpposites = new Map<string, number[]>()
  const vertNeighbors: Set<number>[] = Array.from({ length: vCount }, () => new Set())

  for (const [a, b, c] of tris) {
    vertNeighbors[a].add(b); vertNeighbors[a].add(c)
    vertNeighbors[b].add(a); vertNeighbors[b].add(c)
    vertNeighbors[c].add(a); vertNeighbors[c].add(b)

    for (const [e0, e1, opp] of [[a,b,c],[b,c,a],[c,a,b]] as [number,number,number][]) {
      const key = e0 < e1 ? `${e0}_${e1}` : `${e1}_${e0}`
      if (!edgeOpposites.has(key)) edgeOpposites.set(key, [])
      edgeOpposites.get(key)!.push(opp)
    }
  }

  const outPos: number[] = []
  const outUv:  number[] = []

  const getP = (i: number) => [pos.getX(i), pos.getY(i), pos.getZ(i)]
  const getU = (i: number) => uv ? [uv.getX(i), uv.getY(i)] : [0, 0]
  const addVert = (p: number[], u: number[]): number => {
    const i = outPos.length / 3
    outPos.push(p[0], p[1], p[2])
    outUv.push(u[0], u[1])
    return i
  }

  // New edge midpoint vertices (Loop formula)
  const edgeMidIndex = new Map<string, number>()
  for (const [key, opps] of edgeOpposites.entries()) {
    const [ai, bi] = key.split('_').map(Number)
    const pa = getP(ai), pb = getP(bi)
    const ua = getU(ai), ub = getU(bi)
    let np: number[], nu: number[]
    if (opps.length === 2) {
      const po1 = getP(opps[0]), po2 = getP(opps[1])
      const uo1 = getU(opps[0]), uo2 = getU(opps[1])
      np = [
        0.375*(pa[0]+pb[0]) + 0.125*(po1[0]+po2[0]),
        0.375*(pa[1]+pb[1]) + 0.125*(po1[1]+po2[1]),
        0.375*(pa[2]+pb[2]) + 0.125*(po1[2]+po2[2]),
      ]
      nu = [
        0.375*(ua[0]+ub[0]) + 0.125*(uo1[0]+uo2[0]),
        0.375*(ua[1]+ub[1]) + 0.125*(uo1[1]+uo2[1]),
      ]
    } else {
      np = [0.5*(pa[0]+pb[0]), 0.5*(pa[1]+pb[1]), 0.5*(pa[2]+pb[2])]
      nu = [0.5*(ua[0]+ub[0]), 0.5*(ua[1]+ub[1])]
    }
    edgeMidIndex.set(key, addVert(np, nu))
  }

  // Updated original vertices (Loop formula)
  const origNewIndex: number[] = new Array(vCount)
  for (let v = 0; v < vCount; v++) {
    const neighbors = Array.from(vertNeighbors[v])
    const n_  = neighbors.length
    const pv  = getP(v)
    const uv_ = getU(v)

    let isBoundary = false
    const boundaryNeighbors: number[] = []
    for (const nb of neighbors) {
      const key = v < nb ? `${v}_${nb}` : `${nb}_${v}`
      if ((edgeOpposites.get(key)?.length ?? 0) === 1) {
        isBoundary = true
        boundaryNeighbors.push(nb)
      }
    }

    let np: number[], nu: number[]
    if (isBoundary && boundaryNeighbors.length >= 2) {
      const pn1 = getP(boundaryNeighbors[0]), pn2 = getP(boundaryNeighbors[1])
      const un1 = getU(boundaryNeighbors[0]), un2 = getU(boundaryNeighbors[1])
      np = [
        0.75*pv[0] + 0.125*(pn1[0]+pn2[0]),
        0.75*pv[1] + 0.125*(pn1[1]+pn2[1]),
        0.75*pv[2] + 0.125*(pn1[2]+pn2[2]),
      ]
      nu = [
        0.75*uv_[0] + 0.125*(un1[0]+un2[0]),
        0.75*uv_[1] + 0.125*(un1[1]+un2[1]),
      ]
    } else {
      const beta = n_ === 3 ? 3/16 : 3/(8*n_)
      const w    = 1 - n_ * beta
      let sx = 0, sy = 0, sz = 0, su = 0, sv = 0
      for (const nb of neighbors) {
        const pnb = getP(nb), unb = getU(nb)
        sx += pnb[0]; sy += pnb[1]; sz += pnb[2]
        su += unb[0]; sv += unb[1]
      }
      np = [w*pv[0] + beta*sx, w*pv[1] + beta*sy, w*pv[2] + beta*sz]
      nu = [w*uv_[0] + beta*su, w*uv_[1] + beta*sv]
    }
    origNewIndex[v] = addVert(np, nu)
  }

  // Build new index
  const outIdx: number[] = []
  const getMid = (a: number, b: number) => edgeMidIndex.get(a < b ? `${a}_${b}` : `${b}_${a}`)!
  for (const [a, b, c] of tris) {
    const oa = origNewIndex[a], ob = origNewIndex[b], oc = origNewIndex[c]
    const ab = getMid(a, b), bc = getMid(b, c), ca = getMid(c, a)
    outIdx.push(oa, ab, ca)
    outIdx.push(ab, ob, bc)
    outIdx.push(ca, bc, oc)
    outIdx.push(ab, bc, ca)
  }

  const result = new BufferGeometry()
  result.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
  if (uv) result.setAttribute('uv', new BufferAttribute(new Float32Array(outUv), 2))
  result.setIndex(new BufferAttribute(new Uint32Array(outIdx), 1))
  return result
}
