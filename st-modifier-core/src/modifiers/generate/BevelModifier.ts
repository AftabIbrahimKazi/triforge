import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface BevelModifierOptions {
  width?:          number
  segments?:       number
  angleThreshold?: number   // degrees — edges sharper than this are bevelled
}

/**
 * Bevel Modifier — Blender "Bevel" modifier equivalent (chamfer variant).
 * Inserts additional vertices along hard edges (angle > angleThreshold),
 * producing a flat chamfer bevel. segments=1 produces a single new edge loop
 * per side (a chamfer); higher values produce more rounded bevels.
 *
 * parameters.width:          chamfer width
 * parameters.segments:       edge loops per bevel side (1–4)
 * parameters.angleThreshold: minimum dihedral angle (degrees) to bevel
 *
 * Algorithm:
 *   1. Build per-face normals and an edge→faces adjacency map.
 *   2. Identify "hard" edges where adjacent faces exceed angleThreshold.
 *   3. For each hard edge, split each endpoint vertex into separate copies
 *      displaced along the edge direction, forming the chamfer geometry.
 *   4. Rebuild index, compute vertex normals.
 */
export class BevelModifier extends BaseModifier {
  get name() { return 'Bevel' }

  parameters: Record<string, number>

  constructor(options: BevelModifierOptions = {}) {
    super()
    this.parameters = {
      width:          options.width          ?? 0.1,
      segments:       Math.round(Math.max(1, Math.min(4, options.segments ?? 1))),
      angleThreshold: options.angleThreshold ?? 30,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const width     = Math.max(0, this.parameters.width)
    const segments  = Math.round(Math.max(1, Math.min(4, this.parameters.segments)))
    const threshold = (this.parameters.angleThreshold * Math.PI) / 180

    const srcPos = geometry.getAttribute('position')
    const srcUv  = geometry.getAttribute('uv')
    const srcIdx = geometry.getIndex()
    const vCount = srcPos.count

    // ── Flatten to triangle list ───────────────────────────────────────────────

    const tris: [number, number, number][] = []
    if (srcIdx) {
      const ia = srcIdx.array
      for (let i = 0; i < ia.length; i += 3) tris.push([ia[i], ia[i + 1], ia[i + 2]])
    } else {
      for (let i = 0; i < vCount; i += 3) tris.push([i, i + 1, i + 2])
    }

    const getP = (i: number): Vector3 =>
      new Vector3(srcPos.getX(i), srcPos.getY(i), srcPos.getZ(i))

    // ── Position-weld: map each vertex index to a canonical "weld index" ───────
    // Needed because non-welded meshes (e.g. BoxGeometry) duplicate vertices at
    // shared corners — index-based edge keys would miss shared edges entirely.
    const EPS = 1e-5
    const posKey = (i: number) => {
      const x = Math.round(srcPos.getX(i) / EPS)
      const y = Math.round(srcPos.getY(i) / EPS)
      const z = Math.round(srcPos.getZ(i) / EPS)
      return `${x},${y},${z}`
    }
    const posToWeld = new Map<string, number>()
    const weld: number[] = new Array(vCount)
    for (let i = 0; i < vCount; i++) {
      const k = posKey(i)
      if (!posToWeld.has(k)) posToWeld.set(k, i)
      weld[i] = posToWeld.get(k)!
    }

    // ── Per-face normals ───────────────────────────────────────────────────────

    const faceNormals: Vector3[] = tris.map(([a, b, c]) => {
      const ab = getP(b).sub(getP(a))
      const ac = getP(c).sub(getP(a))
      return ab.cross(ac).normalize()
    })

    // ── Edge → face adjacency (using weld indices for shared-edge detection) ───

    type EdgeKey = string
    const edgeFaces = new Map<EdgeKey, number[]>()  // edge key → [faceIndex, ...]

    const edgeKey = (a: number, b: number): EdgeKey => {
      const wa = weld[a], wb = weld[b]
      return wa < wb ? `${wa}_${wb}` : `${wb}_${wa}`
    }

    for (let fi = 0; fi < tris.length; fi++) {
      const [a, b, c] = tris[fi]
      for (const [e0, e1] of [[a, b], [b, c], [c, a]] as [number, number][]) {
        const key = edgeKey(e0, e1)
        if (!edgeFaces.has(key)) edgeFaces.set(key, [])
        edgeFaces.get(key)!.push(fi)
      }
    }

    // ── Identify hard edges ────────────────────────────────────────────────────

    const hardEdges = new Set<EdgeKey>()

    for (const [key, faces] of edgeFaces.entries()) {
      if (faces.length < 2) continue   // boundary edge — skip
      const n0 = faceNormals[faces[0]]
      const n1 = faceNormals[faces[1]]
      const dot = Math.max(-1, Math.min(1, n0.dot(n1)))
      const angle = Math.acos(dot)
      if (angle > threshold) hardEdges.add(key)
    }

    if (hardEdges.size === 0) {
      // No hard edges — return a copy
      return geometry.clone()
    }

    // ── Build output as unindexed triangles ───────────────────────────────────
    // Strategy: re-emit all original faces, replacing vertices on hard edges
    // with chamfered versions that pull the face corner inward by `width`.

    // For each triangle face, for each of its 3 edges:
    //   If that edge is hard, we need to "pull back" the two vertices of that
    //   edge within this face: offset each vertex along the direction toward
    //   the opposite vertex of that edge (i.e. the edge tangent direction
    //   projected perpendicular to the edge, within the face plane).

    // We build a map: for each (face, vertex) pair that sits on a hard edge,
    // what is the displacement vector?
    // A vertex in a face can be on multiple hard edges → accumulate displacements.

    // Step 1: For each face vertex on a hard edge, compute the inward offset
    // direction: direction from vertex along each hard edge emanating from it.

    const outPos:  number[] = []
    const outUv:   number[] = []
    const outIdx:  number[] = []

    // We will generate the bevel polygons (the chamfer faces between the
    // two pulled-back faces sharing a hard edge) as additional quads.

    // --- Pass 1: For each face, compute per-vertex offsets due to hard edges.
    // displaced[fi][localVi] = accumulated offset Vector3

    const displaced: Vector3[][] = tris.map(() => [new Vector3(), new Vector3(), new Vector3()])

    for (const key of hardEdges) {
      const [wva, wvb] = key.split('_').map(Number)
      // Weld indices — use getP with the weld index directly (position is identical)
      const pa = getP(wva), pb = getP(wvb)
      const edgeDir = pb.clone().sub(pa).normalize()

      // For every face containing this edge, offset the two vertices inward
      const faces = edgeFaces.get(key)!
      for (const fi of faces) {
        const [ta, tb, tc] = tris[fi]
        for (const [ei, ej] of [[ta, tb], [tb, tc], [tc, ta]] as [number,number][]) {
          if (edgeKey(ei, ej) !== key) continue
          // ei and ej are the two endpoints of this hard edge in face fi
          // The "inward" direction for ei: from ei toward ej, projected into the face plane
          const localEiIdx = tris[fi].indexOf(ei) as 0 | 1 | 2
          const localEjIdx = tris[fi].indexOf(ej) as 0 | 1 | 2
          // Inward offset direction for ei: along edgeDir toward ej
          const dirItoJ = edgeDir.clone()
          displaced[fi][localEiIdx].addScaledVector(dirItoJ,  width)
          // Inward offset direction for ej: along -edgeDir toward ei
          displaced[fi][localEjIdx].addScaledVector(dirItoJ, -width)
        }
      }
    }

    // --- Pass 2: Emit original faces with displaced vertices as unindexed geometry
    // Also record per-face per-vertex output position indices for bevel face building.

    type FaceVertIdx = number   // index into outPos / 3
    const faceVertices: FaceVertIdx[][] = []

    for (let fi = 0; fi < tris.length; fi++) {
      const [a, b, c] = tris[fi]
      const verts = [a, b, c]
      const faceVerts: FaceVertIdx[] = []
      for (let lv = 0; lv < 3; lv++) {
        const vi   = verts[lv]
        const base = getP(vi)
        base.add(displaced[fi][lv])
        const idx = outPos.length / 3
        outPos.push(base.x, base.y, base.z)
        if (srcUv) outUv.push(srcUv.getX(vi), srcUv.getY(vi))
        else       outUv.push(0, 0)
        faceVerts.push(idx)
      }
      faceVertices.push(faceVerts)
      // Emit triangle
      const base = outIdx.length
      outIdx.push(faceVerts[0], faceVerts[1], faceVerts[2])
    }

    // --- Pass 3: For each hard edge, emit the chamfer polygon connecting the two
    // pulled-back edge positions from adjacent faces.

    for (const key of hardEdges) {
      const faces = edgeFaces.get(key)!
      if (faces.length < 2) continue

      const [wva, wvb] = key.split('_').map(Number)

      // Find the local indices of va/vb in each face by matching weld indices
      const getLocalIdx = (fi: number, wv: number): number =>
        tris[fi].findIndex(v => weld[v] === wv) as 0 | 1 | 2

      const fi0 = faces[0], fi1 = faces[1]
      const li0a = getLocalIdx(fi0, wva), li0b = getLocalIdx(fi0, wvb)
      const li1a = getLocalIdx(fi1, wva), li1b = getLocalIdx(fi1, wvb)

      const p0a = faceVertices[fi0][li0a]   // face 0, vertex at 'va' end
      const p0b = faceVertices[fi0][li0b]   // face 0, vertex at 'vb' end
      const p1a = faceVertices[fi1][li1a]   // face 1, vertex at 'va' end
      const p1b = faceVertices[fi1][li1b]   // face 1, vertex at 'vb' end

      if (segments === 1) {
        // Single chamfer: one quad = 2 triangles
        // Winding: the chamfer face should face outward (between the two original faces)
        outIdx.push(p0a, p1a, p0b)
        outIdx.push(p1a, p1b, p0b)
      } else {
        // Multi-segment bevel: interpolate between the pulled-back positions
        // For each segment, emit a strip row
        const getVec = (idx: number): Vector3 =>
          new Vector3(outPos[idx * 3], outPos[idx * 3 + 1], outPos[idx * 3 + 2])

        const rowCount = segments + 1
        // Build a grid of rowCount rows, 2 columns (va side, vb side)
        // Row 0 = face0 positions, Row segments = face1 positions
        const grid: number[][] = []   // grid[row][0=va, 1=vb] → outPos index

        for (let r = 0; r <= segments; r++) {
          const t = r / segments
          const rowVerts: number[] = []

          for (let side = 0; side < 2; side++) {
            const from = side === 0 ? getVec(p0a) : getVec(p0b)
            const to   = side === 0 ? getVec(p1a) : getVec(p1b)
            const px   = from.x + (to.x - from.x) * t
            const py   = from.y + (to.y - from.y) * t
            const pz   = from.z + (to.z - from.z) * t
            const vIdx = outPos.length / 3
            outPos.push(px, py, pz)
            outUv.push(side === 0 ? 0 : 1, r / segments)
            rowVerts.push(vIdx)
          }
          grid.push(rowVerts)
        }

        // Emit quads between consecutive rows
        for (let r = 0; r < segments; r++) {
          const va0 = grid[r][0],     vb0 = grid[r][1]
          const va1 = grid[r + 1][0], vb1 = grid[r + 1][1]
          outIdx.push(va0, va1, vb0)
          outIdx.push(va1, vb1, vb0)
        }
      }
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
    result.setAttribute('uv',       new BufferAttribute(new Float32Array(outUv),  2))
    result.setIndex(new BufferAttribute(new Uint32Array(outIdx), 1))
    result.computeVertexNormals()
    return result
  }
}
