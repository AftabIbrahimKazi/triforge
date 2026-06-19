import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * ConvexHull — compute the convex hull of a point cloud or geometry.
 * Blender: Geometry Nodes > Geometry > Convex Hull
 *
 * Uses an incremental gift-wrapping approach (O(n²) — suitable for typical mesh counts).
 * Output is a closed manifold triangle mesh.
 */
export class ConvexHull extends GeometryNode {
  readonly nodeType = 'ConvexHull'
  parameters = {}

  constructor(opts: { geometry?: OutputRef | BufferGeometry | null } = {}) {
    super()
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { 'Convex Hull': null }

    const posAttr = src.getAttribute('position') as BufferAttribute
    const pts: [number, number, number][] = []
    for (let i = 0; i < posAttr.count; i++) {
      pts.push([posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)])
    }

    const hull = buildConvexHull(pts)
    return { 'Convex Hull': hull }
  }
}

// ── Incremental convex hull ────────────────────────────────────────────────────

type Pt = [number, number, number]
type Face = [number, number, number]

function sub(a: Pt, b: Pt): Pt { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]] }
function cross(a: Pt, b: Pt): Pt {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
}
function dot(a: Pt, b: Pt) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2] }

function buildConvexHull(pts: Pt[]): BufferGeometry {
  if (pts.length < 4) return emptyGeo()

  // Deduplicate
  const uniq: Pt[] = []
  const seen = new Set<string>()
  for (const p of pts) {
    const k = `${p[0].toFixed(6)},${p[1].toFixed(6)},${p[2].toFixed(6)}`
    if (!seen.has(k)) { seen.add(k); uniq.push(p) }
  }
  if (uniq.length < 4) return emptyGeo()

  // Build initial tetrahedron
  const faces: Face[] = []
  const tet = initialTetrahedron(uniq)
  if (!tet) return emptyGeo()

  faces.push(...tet)

  // Incrementally add each point
  for (let i = 4; i < uniq.length; i++) {
    const p = uniq[i]
    // Find visible faces
    const visible = new Set<number>()
    for (let fi = 0; fi < faces.length; fi++) {
      const [a, b, c] = faces[fi]
      const n = cross(sub(uniq[b], uniq[a]), sub(uniq[c], uniq[a]))
      if (dot(n, sub(p, uniq[a])) > 1e-10) visible.add(fi)
    }
    if (visible.size === 0) continue

    // Horizon edges: edges shared by exactly one visible face
    const edgeCount = new Map<string, [number,number]>()
    for (const fi of visible) {
      const [a,b,c] = faces[fi]
      for (const [x,y] of [[a,b],[b,c],[c,a]] as [number,number][]) {
        const k = x < y ? `${x}_${y}` : `${y}_${x}`
        edgeCount.set(k, [x, y])
      }
    }
    const horizon: [number,number][] = []
    for (const [k, e] of edgeCount) {
      // Count how many visible faces contain this edge
      let cnt = 0
      for (const fi of visible) {
        const [a,b,c] = faces[fi]
        const fk1 = a<b?`${a}_${b}`:`${b}_${a}`
        const fk2 = b<c?`${b}_${c}`:`${c}_${b}`
        const fk3 = c<a?`${c}_${a}`:`${a}_${c}`
        if (k===fk1||k===fk2||k===fk3) cnt++
      }
      if (cnt === 1) horizon.push(e)
    }

    // Remove visible faces
    const remaining: Face[] = []
    for (let fi = 0; fi < faces.length; fi++) {
      if (!visible.has(fi)) remaining.push(faces[fi])
    }
    faces.length = 0; faces.push(...remaining)

    // Add new faces from horizon to p (with correct winding)
    const pi = uniq.length  // we'll add p below
    uniq.push(p)
    for (const [x, y] of horizon) {
      // Ensure outward normal
      const n = cross(sub(uniq[y], uniq[x]), sub(uniq[pi], uniq[x]))
      const centroid: Pt = [
        (uniq[x][0]+uniq[y][0]+uniq[pi][0])/3,
        (uniq[x][1]+uniq[y][1]+uniq[pi][1])/3,
        (uniq[x][2]+uniq[y][2]+uniq[pi][2])/3,
      ]
      // Use any interior point of the tetrahedron as reference
      const ref = uniq[tet[0][0]]
      if (dot(n, sub(centroid, ref)) > 0) {
        faces.push([x, y, pi])
      } else {
        faces.push([y, x, pi])
      }
    }
  }

  // Build geometry
  const pos = new Float32Array(uniq.length * 3)
  for (let i = 0; i < uniq.length; i++) {
    pos[i*3]=uniq[i][0]; pos[i*3+1]=uniq[i][1]; pos[i*3+2]=uniq[i][2]
  }
  const idx = new Uint32Array(faces.length * 3)
  for (let i = 0; i < faces.length; i++) {
    idx[i*3]=faces[i][0]; idx[i*3+1]=faces[i][1]; idx[i*3+2]=faces[i][2]
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setIndex(new BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return geo
}

function initialTetrahedron(pts: Pt[]): Face[] | null {
  // Find 4 non-coplanar points
  const a = 0
  let b = -1
  for (let i = 1; i < pts.length; i++) {
    if (dot(sub(pts[i], pts[a]), sub(pts[i], pts[a])) > 1e-10) { b = i; break }
  }
  if (b < 0) return null
  let c = -1
  for (let i = 0; i < pts.length; i++) {
    if (i === a || i === b) continue
    const n = cross(sub(pts[b], pts[a]), sub(pts[i], pts[a]))
    if (dot(n,n) > 1e-10) { c = i; break }
  }
  if (c < 0) return null
  let d = -1
  const n = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a]))
  for (let i = 0; i < pts.length; i++) {
    if (i === a || i === b || i === c) continue
    if (Math.abs(dot(n, sub(pts[i], pts[a]))) > 1e-10) { d = i; break }
  }
  if (d < 0) return null

  // Ensure consistent outward winding
  const center: Pt = [
    (pts[a][0]+pts[b][0]+pts[c][0]+pts[d][0])/4,
    (pts[a][1]+pts[b][1]+pts[c][1]+pts[d][1])/4,
    (pts[a][2]+pts[b][2]+pts[c][2]+pts[d][2])/4,
  ]
  const fixWinding = (f: Face): Face => {
    const [i,j,k] = f
    const fn = cross(sub(pts[j],pts[i]), sub(pts[k],pts[i]))
    return dot(fn, sub(center, pts[i])) < 0 ? f : [i,k,j]
  }
  return [
    fixWinding([a,b,c]),
    fixWinding([a,b,d]),
    fixWinding([a,c,d]),
    fixWinding([b,c,d]),
  ]
}

function emptyGeo(): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(0), 3))
  return g
}
