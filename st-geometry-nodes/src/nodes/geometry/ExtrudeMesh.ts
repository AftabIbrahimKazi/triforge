import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * ExtrudeMesh — extrude selected faces along their normals.
 * Blender: Geometry Nodes > Mesh > Extrude Mesh
 *
 * Extrudes all faces by `offset` along per-face normals,
 * creating side walls connecting original and extruded faces.
 */
export class ExtrudeMesh extends GeometryNode {
  readonly nodeType = 'ExtrudeMesh'

  parameters: {
    /** Extrusion distance along face normal. Blender: Offset Amount. Default 0.1. */
    offset: number
    /** Offset scale for individual faces [0–1]. Default 1. */
    offsetScale: number
  }

  constructor(opts: {
    geometry?:    OutputRef | BufferGeometry | null
    offset?:      number
    offsetScale?: number
  } = {}) {
    super()
    this.parameters = {
      offset:      opts.offset      ?? 0.1,
      offsetScale: opts.offsetScale ?? 1.0,
    }
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { Geometry: null, Top: null }

    const { offset, offsetScale } = this.parameters
    return { Geometry: extrudeMesh(src, offset * offsetScale), Top: null }
  }
}

function extrudeMesh(src: BufferGeometry, offset: number): BufferGeometry {
  const posAttr = src.getAttribute('position') as BufferAttribute
  const idx     = src.getIndex()

  // Build flat triangle list
  const tris: [number,number,number][] = []
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) tris.push([idx.getX(i), idx.getX(i+1), idx.getX(i+2)])
  } else {
    for (let i = 0; i < posAttr.count; i += 3) tris.push([i, i+1, i+2])
  }

  const getP = (i: number): [number,number,number] =>
    [posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)]

  // Compute per-face normals and extruded positions
  const origCount = posAttr.count
  const outPos: number[] = []

  // Copy original vertices
  for (let i = 0; i < origCount; i++) {
    outPos.push(...getP(i))
  }

  // Accumulate per-vertex normal contributions
  const vertNormals: [number,number,number][] = Array.from({length: origCount}, () => [0,0,0])

  for (const [a,b,c] of tris) {
    const pa = getP(a), pb = getP(b), pc = getP(c)
    const ab: [number,number,number] = [pb[0]-pa[0], pb[1]-pa[1], pb[2]-pa[2]]
    const ac: [number,number,number] = [pc[0]-pa[0], pc[1]-pa[1], pc[2]-pa[2]]
    const nx = ab[1]*ac[2]-ab[2]*ac[1]
    const ny = ab[2]*ac[0]-ab[0]*ac[2]
    const nz = ab[0]*ac[1]-ab[1]*ac[0]
    for (const vi of [a,b,c]) {
      vertNormals[vi][0] += nx; vertNormals[vi][1] += ny; vertNormals[vi][2] += nz
    }
  }

  // Extruded vertex positions (offset along averaged normal)
  for (let i = 0; i < origCount; i++) {
    const [nx,ny,nz] = vertNormals[i]
    const len = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1
    const p = getP(i)
    outPos.push(p[0]+nx/len*offset, p[1]+ny/len*offset, p[2]+nz/len*offset)
  }

  const outIdx: number[] = []

  // Top faces (extruded): use offset vertices (origCount + original index)
  for (const [a,b,c] of tris) {
    outIdx.push(origCount+a, origCount+b, origCount+c)
  }

  // Side walls: for each edge of each original face, create a quad
  for (const [a,b,c] of tris) {
    const edges: [number,number][] = [[a,b],[b,c],[c,a]]
    for (const [x,y] of edges) {
      // Original edge x→y, extruded edge (origCount+x)→(origCount+y)
      outIdx.push(x,      y,            origCount+y)
      outIdx.push(x,      origCount+y,  origCount+x)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
  geo.setIndex(outIdx)
  geo.computeVertexNormals()
  return geo
}
