import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * DistributePointsOnFaces — scatter random points uniformly on a mesh surface.
 * Blender: Geometry Nodes > Point > Distribute Points on Faces
 *
 * Outputs a BufferGeometry with just position + normal attributes (point cloud).
 */
export class DistributePointsOnFaces extends GeometryNode {
  readonly nodeType = 'DistributePointsOnFaces'

  parameters: {
    /** Points per unit area (approximately). Blender: Density. */
    density: number
    /** Fixed point count (used when density <= 0). */
    count:   number
    /** Random seed. Blender: Seed. */
    seed:    number
  }

  constructor(opts: {
    mesh?:    OutputRef | BufferGeometry | null
    density?: number
    count?:   number
    seed?:    number
  } = {}) {
    super()
    this.parameters = {
      density: opts.density ?? 10,
      count:   opts.count   ?? 0,
      seed:    opts.seed    ?? 0,
    }
    if (opts.mesh != null) this._inputs.mesh = opts.mesh as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.mesh as BufferGeometry | null
    if (!src) return { Points: null }

    const { density, count, seed } = this.parameters
    const posAttr = src.getAttribute('position') as BufferAttribute
    const norAttr = src.getAttribute('normal')   as BufferAttribute | undefined
    const index   = src.getIndex()

    // Collect triangles
    const tris: [Vector3, Vector3, Vector3, Vector3][] = [] // [a, b, c, normal]
    const va = new Vector3(), vb = new Vector3(), vc = new Vector3()

    const addTri = (ia: number, ib: number, ic: number) => {
      va.fromBufferAttribute(posAttr, ia)
      vb.fromBufferAttribute(posAttr, ib)
      vc.fromBufferAttribute(posAttr, ic)
      const n = new Vector3().crossVectors(vb.clone().sub(va), vc.clone().sub(va)).normalize()
      tris.push([va.clone(), vb.clone(), vc.clone(), n])
    }

    if (index) {
      for (let i = 0; i < index.count; i += 3) addTri(index.getX(i), index.getX(i+1), index.getX(i+2))
    } else {
      for (let i = 0; i < posAttr.count; i += 3) addTri(i, i+1, i+2)
    }

    // Compute triangle areas and cumulative distribution
    const areas = tris.map(([a,b,c]) =>
      new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).length() * 0.5
    )
    const totalArea = areas.reduce((s, a) => s + a, 0)
    const cumulative = areas.map(((s=0) => (a: number) => s += a)())

    // Determine how many points to place
    const numPoints = count > 0 ? count : Math.max(1, Math.round(density * totalArea))

    // LCG pseudo-random (reproducible)
    let lcg = (seed | 0) ^ 0xdeadbeef
    const rand = () => { lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; return lcg / 0x100000000 }

    const outPos: number[] = [], outNor: number[] = []

    for (let p = 0; p < numPoints; p++) {
      // Pick triangle proportionally to area
      const r = rand() * totalArea
      let ti = cumulative.findIndex(c => c >= r)
      if (ti < 0) ti = tris.length - 1

      // Uniform random point in triangle (barycentric)
      const [a, b, c, n] = tris[ti]
      let u = rand(), v = rand()
      if (u + v > 1) { u = 1 - u; v = 1 - v }
      const w = 1 - u - v
      const px = a.x*w + b.x*u + c.x*v
      const py = a.y*w + b.y*u + c.y*v
      const pz = a.z*w + b.z*u + c.z*v
      outPos.push(px, py, pz)
      outNor.push(n.x, n.y, n.z)
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
    geo.setAttribute('normal',   new BufferAttribute(new Float32Array(outNor), 3))
    return { Points: geo }
  }
}
