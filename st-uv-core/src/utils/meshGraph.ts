import { BufferGeometry, BufferAttribute } from 'three'

export interface MeshGraph {
  positions:       Float32Array   // vertexCount * 3
  triangles:       Uint32Array    // triangleCount * 3
  vertexCount:     number
  triangleCount:   number
  /** For each vertex: list of incident triangle indices */
  vertexTriangles: number[][]
  /** Edge "minV_maxV" -> triangle indices (1 or 2) */
  edgeTriangles:   Map<string, number[]>
  /** Vertex indices on the mesh boundary (edges with only 1 incident triangle) */
  boundary:        number[]
  /** Set for fast boundary lookup */
  boundarySet:     Set<number>
  /**
   * Set to true by applySeamCuts when vertices are duplicated along seams.
   * Tells applyUVsToGeometry to de-index the output so each triangle corner
   * gets its own UV slot (required for different UVs on each side of a seam).
   */
  hasSeamSplits?:  boolean
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`
}

/**
 * Build a MeshGraph from a BufferGeometry.
 * Handles both indexed and non-indexed geometry.
 * For non-indexed geometry, merges vertices at identical positions.
 */
export function buildMeshGraph(geometry: BufferGeometry): MeshGraph {
  const posAttr = geometry.getAttribute('position') as BufferAttribute
  if (!posAttr) throw new Error('st-uv-core: geometry has no position attribute.')

  let triangles: Uint32Array
  let positions: Float32Array

  if (geometry.index) {
    // Indexed geometry — use as-is
    positions = new Float32Array(posAttr.array)
    const idx  = geometry.index.array
    triangles  = new Uint32Array(idx.length)
    for (let i = 0; i < idx.length; i++) triangles[i] = idx[i]
  } else {
    // Non-indexed — weld by position
    const raw       = posAttr.array
    const vertCount = posAttr.count
    const posMap    = new Map<string, number>()
    const newPos:   number[] = []
    const newIdx:   number[] = []

    for (let i = 0; i < vertCount; i++) {
      const x = raw[i * 3], y = raw[i * 3 + 1], z = raw[i * 3 + 2]
      // Round to 5 decimal places to merge near-identical vertices
      const key = `${x.toFixed(5)}_${y.toFixed(5)}_${z.toFixed(5)}`
      let vi = posMap.get(key)
      if (vi === undefined) {
        vi = newPos.length / 3
        posMap.set(key, vi)
        newPos.push(x, y, z)
      }
      newIdx.push(vi)
    }

    positions = new Float32Array(newPos)
    triangles = new Uint32Array(newIdx)
  }

  const vertexCount   = positions.length / 3
  const triangleCount = triangles.length / 3

  // Build adjacency structures
  const vertexTriangles: number[][] = Array.from({ length: vertexCount }, () => [])
  const edgeTriangles   = new Map<string, number[]>()

  for (let t = 0; t < triangleCount; t++) {
    const i = triangles[t * 3]
    const j = triangles[t * 3 + 1]
    const k = triangles[t * 3 + 2]

    vertexTriangles[i].push(t)
    vertexTriangles[j].push(t)
    vertexTriangles[k].push(t)

    for (const [a, b] of [[i, j], [j, k], [k, i]] as [number, number][]) {
      const key = edgeKey(a, b)
      const entry = edgeTriangles.get(key)
      if (entry) entry.push(t)
      else edgeTriangles.set(key, [t])
    }
  }

  // Find boundary vertices (edges with only 1 triangle)
  const boundarySet = new Set<number>()
  for (const [key, tris] of edgeTriangles) {
    if (tris.length === 1) {
      const [a, b] = key.split('_').map(Number)
      boundarySet.add(a)
      boundarySet.add(b)
    }
  }
  const boundary = [...boundarySet]

  return { positions, triangles, vertexCount, triangleCount, vertexTriangles, edgeTriangles, boundary, boundarySet }
}

/** Get the index of the vertex opposite to edge (a,b) in triangle t. */
export function oppositeVertex(triangles: Uint32Array, t: number, a: number, b: number): number {
  const i = triangles[t * 3], j = triangles[t * 3 + 1], k = triangles[t * 3 + 2]
  if (i !== a && i !== b) return i
  if (j !== a && j !== b) return j
  return k
}

/** Cotangent of angle at vertex opp in the triangle opp-a-b. */
export function cotangentWeight(positions: Float32Array, opp: number, a: number, b: number): number {
  const ox = positions[opp * 3], oy = positions[opp * 3 + 1], oz = positions[opp * 3 + 2]
  const ax = positions[a   * 3], ay = positions[a   * 3 + 1], az = positions[a   * 3 + 2]
  const bx = positions[b   * 3], by = positions[b   * 3 + 1], bz = positions[b   * 3 + 2]

  const ux = ax - ox, uy = ay - oy, uz = az - oz
  const vx = bx - ox, vy = by - oy, vz = bz - oz

  const dot   =  ux * vx + uy * vy + uz * vz
  // cross magnitude
  const cx = uy * vz - uz * vy
  const cy = uz * vx - ux * vz
  const cz = ux * vy - uy * vx
  const crossLen = Math.sqrt(cx * cx + cy * cy + cz * cz)

  if (crossLen < 1e-10) return 0
  return dot / crossLen
}

/** Mean-value weight for edge (i,j) at vertex i — used by ABF. */
export function meanValueWeight(positions: Float32Array, i: number, j: number, opp: number): number {
  const ix = positions[i * 3], iy = positions[i * 3 + 1], iz = positions[i * 3 + 2]
  const jx = positions[j * 3], jy = positions[j * 3 + 1], jz = positions[j * 3 + 2]
  const ox = positions[opp * 3], oy = positions[opp * 3 + 1], oz = positions[opp * 3 + 2]

  // Angle at i in triangle (i, j, opp)
  const ijx = jx - ix, ijy = jy - iy, ijz = jz - iz
  const iox = ox - ix, ioy = oy - iy, ioz = oz - iz

  const lenIJ  = Math.sqrt(ijx*ijx + ijy*ijy + ijz*ijz)
  const lenIO  = Math.sqrt(iox*iox + ioy*ioy + ioz*ioz)
  const cosA   = (ijx*iox + ijy*ioy + ijz*ioz) / (lenIJ * lenIO + 1e-10)
  const angle  = Math.acos(Math.max(-1, Math.min(1, cosA)))

  return Math.tan(angle / 2) / (lenIJ + 1e-10)
}

/**
 * Apply seam cuts to a MeshGraph in-place.
 *
 * For each seam edge (a,b) that has two incident triangles [t0, t1]:
 *   - Duplicates vertices a and b as new vertices a' and b'
 *   - Rewires triangle t1 to use a' and b' instead of a and b
 *   - Removes the shared edge and adds two free boundary edges instead
 *   - Updates all adjacency structures (vertexTriangles, edgeTriangles, positions)
 *
 * After all cuts, recomputes boundary / boundarySet so the solver treats the
 * seam edges as open boundaries and assigns independent UV coordinates on each side.
 *
 * Called by ConformalLSCM and AngleBasedABF when geometry.userData.seams is set.
 */
export function applySeamCuts(
  graph: MeshGraph,
  seams: Array<{ a: number; b: number }>,
): void {
  if (!seams || seams.length === 0) return

  // Work with growable arrays so we can add vertices
  const posList:  number[] = Array.from(graph.positions)
  const triList:  number[] = Array.from(graph.triangles)
  let vertexCount = graph.vertexCount

  // vertexTriangles is indexed by vertex; grow it as we add vertices
  const vertexTriangles: number[][] = graph.vertexTriangles.map(arr => [...arr])

  for (const { a, b } of seams) {
    const key   = edgeKey(a, b)
    const entry = graph.edgeTriangles.get(key)
    if (!entry || entry.length !== 2) continue  // boundary or non-existent edge

    const [t0, t1] = entry

    // ── duplicate vertex a → a' ──────────────────────────────────────────────
    const aPrime = vertexCount++
    posList.push(posList[a * 3], posList[a * 3 + 1], posList[a * 3 + 2])
    vertexTriangles.push([])   // will be populated below

    // ── duplicate vertex b → b' ──────────────────────────────────────────────
    const bPrime = vertexCount++
    posList.push(posList[b * 3], posList[b * 3 + 1], posList[b * 3 + 2])
    vertexTriangles.push([])

    // ── rewire t1: replace a→aPrime and b→bPrime ─────────────────────────────
    for (let corner = 0; corner < 3; corner++) {
      const idx = t1 * 3 + corner
      if (triList[idx] === a) triList[idx] = aPrime
      else if (triList[idx] === b) triList[idx] = bPrime
    }

    // ── fix vertexTriangles for a, b, aPrime, bPrime ─────────────────────────
    // Remove t1 from a's and b's triangle lists; add to aPrime and bPrime
    vertexTriangles[a]      = vertexTriangles[a].filter(t => t !== t1)
    vertexTriangles[b]      = vertexTriangles[b].filter(t => t !== t1)
    vertexTriangles[aPrime].push(t1)
    vertexTriangles[bPrime].push(t1)

    // ── update edgeTriangles ──────────────────────────────────────────────────
    // Remove the shared edge entirely (it no longer exists as a manifold edge)
    graph.edgeTriangles.delete(key)

    // t1 now has new corners; rebuild its edge keys
    const i1 = triList[t1 * 3], j1 = triList[t1 * 3 + 1], k1 = triList[t1 * 3 + 2]
    for (const [ea, eb] of [[i1, j1], [j1, k1], [k1, i1]] as [number, number][]) {
      if ((ea === aPrime || ea === bPrime) || (eb === aPrime || eb === bPrime)) {
        // This edge involves the new vertices — register it fresh
        const newKey = edgeKey(ea, eb)
        if (!graph.edgeTriangles.has(newKey)) {
          graph.edgeTriangles.set(newKey, [t1])
        } else {
          const existing = graph.edgeTriangles.get(newKey)!
          if (!existing.includes(t1)) existing.push(t1)
        }
      }
    }

    // t0 keeps the original edge a-b but it's now a boundary (only 1 triangle)
    // Register a boundary entry for t0's a-b edge if not already present
    const t0key = edgeKey(a, b)
    graph.edgeTriangles.set(t0key, [t0])
  }

  // Commit grown arrays back into graph
  graph.positions       = new Float32Array(posList)
  graph.triangles       = new Uint32Array(triList)
  graph.vertexCount     = vertexCount
  graph.triangleCount   = triList.length / 3
  graph.vertexTriangles = vertexTriangles
  graph.hasSeamSplits   = true

  // Recompute boundary
  const boundarySet = new Set<number>()
  for (const [key, tris] of graph.edgeTriangles) {
    if (tris.length === 1) {
      const [va, vb] = key.split('_').map(Number)
      boundarySet.add(va)
      boundarySet.add(vb)
    }
  }
  graph.boundarySet = boundarySet
  graph.boundary    = [...boundarySet]
}

/**
 * Order boundary vertices into a closed loop.
 * Returns undefined if boundary is empty or has complex topology.
 */
export function orderBoundaryLoop(graph: MeshGraph): number[] | undefined {
  if (graph.boundary.length === 0) return undefined

  // Build boundary edge adjacency
  const boundaryAdj = new Map<number, number[]>()
  for (const [key, tris] of graph.edgeTriangles) {
    if (tris.length === 1) {
      const [a, b] = key.split('_').map(Number)
      if (!boundaryAdj.has(a)) boundaryAdj.set(a, [])
      if (!boundaryAdj.has(b)) boundaryAdj.set(b, [])
      boundaryAdj.get(a)!.push(b)
      boundaryAdj.get(b)!.push(a)
    }
  }

  // Walk the boundary
  const start = graph.boundary[0]
  const loop: number[] = [start]
  const visited = new Set<number>([start])
  let current = start

  while (true) {
    const neighbors = boundaryAdj.get(current) ?? []
    const next = neighbors.find(n => !visited.has(n))
    if (next === undefined) break
    loop.push(next)
    visited.add(next)
    current = next
  }

  return loop
}

/**
 * Copy the UV attribute from uvArray back into a clone of the source geometry.
 * uvArray: Float32Array of length graph.vertexCount * 2
 *
 * Normal case (no seam splits):
 *   - Indexed geometry: write UVs per unique vertex index.
 *   - Non-indexed geometry: expand UVs back to per-face-vertex layout.
 *
 * Seam-split case (graph.hasSeamSplits === true):
 *   The graph has duplicated vertices; graph.triangles maps each triangle corner
 *   to a graph vertex index. We de-index the output so that each face-vertex
 *   gets its own UV slot, enabling different UVs on each side of the seam.
 */
export function applyUVsToGeometry(
  source: BufferGeometry,
  uvArray: Float32Array,
  graph: MeshGraph,
): BufferGeometry {

  // ── seam-split path: output de-indexed geometry ───────────────────────────
  if (graph.hasSeamSplits && source.index) {
    // De-index the source geometry so every face-vertex is independent
    const result   = source.toNonIndexed()
    const numFaceVerts = graph.triangleCount * 3
    const uv       = new Float32Array(numFaceVerts * 2)

    for (let fc = 0; fc < numFaceVerts; fc++) {
      const graphVI    = graph.triangles[fc]      // graph vertex index for this face-corner
      uv[fc * 2]     = uvArray[graphVI * 2]
      uv[fc * 2 + 1] = uvArray[graphVI * 2 + 1]
    }
    result.setAttribute('uv', new BufferAttribute(uv, 2))
    return result
  }

  const result = source.clone()

  if (source.index) {
    // Indexed without seam splits: uvArray has one entry per unique vertex
    const uv = new Float32Array(graph.vertexCount * 2)
    for (let i = 0; i < graph.vertexCount; i++) {
      uv[i * 2]     = uvArray[i * 2]
      uv[i * 2 + 1] = uvArray[i * 2 + 1]
    }
    result.setAttribute('uv', new BufferAttribute(uv, 2))
  } else {
    // Non-indexed: expand per-welded-vertex UVs to per-face-vertex
    const origCount = source.getAttribute('position').count
    const uv        = new Float32Array(origCount * 2)

    // Rebuild the weld map to know which original vertex → welded vertex
    const posAttr = source.getAttribute('position') as BufferAttribute
    const raw     = posAttr.array
    const posMap  = new Map<string, number>()
    const weldedIdx: number[] = []

    for (let i = 0; i < origCount; i++) {
      const x = raw[i * 3], y = raw[i * 3 + 1], z = raw[i * 3 + 2]
      const key = `${x.toFixed(5)}_${y.toFixed(5)}_${z.toFixed(5)}`
      let vi = posMap.get(key)
      if (vi === undefined) { vi = posMap.size; posMap.set(key, vi) }
      weldedIdx.push(vi)
    }

    for (let i = 0; i < origCount; i++) {
      const wi = weldedIdx[i]
      uv[i * 2]     = uvArray[wi * 2]
      uv[i * 2 + 1] = uvArray[wi * 2 + 1]
    }
    result.setAttribute('uv', new BufferAttribute(uv, 2))
  }

  return result
}
