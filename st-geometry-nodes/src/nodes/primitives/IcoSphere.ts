import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, type Inputs } from '../../core/GeometryNode.js'

/**
 * IcoSphere — icosphere (subdivided icosahedron).
 * Blender: Add > Mesh > Ico Sphere
 */
export class IcoSphere extends GeometryNode {
  readonly nodeType = 'IcoSphere'

  parameters: {
    /** Sphere radius. */
    radius:        number
    /** Subdivision level 0–7. Blender: Subdivisions. */
    subdivisions:  number
  }

  constructor(opts: { radius?: number; subdivisions?: number } = {}) {
    super()
    this.parameters = {
      radius:       opts.radius       ?? 1,
      subdivisions: opts.subdivisions ?? 2,
    }
  }

  _evaluate(_inputs: Inputs): Record<string, BufferGeometry> {
    const { radius, subdivisions } = this.parameters
    const level = Math.max(0, Math.min(7, subdivisions))

    // Base icosahedron
    const t = (1 + Math.sqrt(5)) / 2
    let verts: [number,number,number][] = [
      [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
      [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
      [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1],
    ]
    const norm = ([x,y,z]: [number,number,number]): [number,number,number] => {
      const l = Math.sqrt(x*x+y*y+z*z); return [x/l,y/l,z/l]
    }
    verts = verts.map(norm)

    let faces: [number,number,number][] = [
      [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
      [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
      [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
      [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
    ]

    const midCache = new Map<string, number>()
    const midpoint = (a: number, b: number): number => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      if (midCache.has(key)) return midCache.get(key)!
      const va = verts[a], vb = verts[b]
      verts.push(norm([(va[0]+vb[0])/2, (va[1]+vb[1])/2, (va[2]+vb[2])/2]))
      const idx = verts.length - 1
      midCache.set(key, idx)
      return idx
    }

    for (let i = 0; i < level; i++) {
      const next: [number,number,number][] = []
      for (const [a, b, c] of faces) {
        const ab = midpoint(a, b)
        const bc = midpoint(b, c)
        const ca = midpoint(c, a)
        next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca])
      }
      faces = next
    }

    const pos: number[] = []
    const nor: number[] = []
    const uvs: number[] = []

    for (const [a, b, c] of faces) {
      for (const vi of [a, b, c]) {
        const [x, y, z] = verts[vi]
        pos.push(x * radius, y * radius, z * radius)
        nor.push(x, y, z)
        uvs.push((Math.atan2(z, x) / (Math.PI * 2) + 0.5), (Math.asin(y) / Math.PI + 0.5))
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute('normal',   new BufferAttribute(new Float32Array(nor), 3))
    geo.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs), 2))
    geo.computeVertexNormals()
    return { Geometry: geo }
  }
}
