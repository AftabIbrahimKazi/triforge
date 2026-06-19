import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * MergeByDistance — weld vertices closer than `distance`.
 * Blender: Geometry Nodes > Mesh > Merge by Distance
 */
export class MergeByDistance extends GeometryNode {
  readonly nodeType = 'MergeByDistance'

  parameters: {
    /** Merge distance threshold. Blender: Distance. */
    distance: number
  }

  constructor(opts: {
    geometry?: OutputRef | BufferGeometry | null
    distance?: number
  } = {}) {
    super()
    this.parameters = { distance: opts.distance ?? 0.001 }
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry as BufferGeometry | null
    if (!src) return { Geometry: null }

    const { distance } = this.parameters
    const d2   = distance * distance
    const posAttr = src.getAttribute('position') as BufferAttribute
    const uvAttr  = src.getAttribute('uv')       as BufferAttribute | undefined
    const index   = src.getIndex()
    const n       = posAttr.count

    // Map each vertex to a representative (the first vertex within distance)
    const rep = new Int32Array(n)
    for (let i = 0; i < n; i++) rep[i] = i

    for (let i = 0; i < n; i++) {
      if (rep[i] !== i) continue
      const ax = posAttr.getX(i), ay = posAttr.getY(i), az = posAttr.getZ(i)
      for (let j = i + 1; j < n; j++) {
        if (rep[j] !== j) continue
        const dx = posAttr.getX(j) - ax
        const dy = posAttr.getY(j) - ay
        const dz = posAttr.getZ(j) - az
        if (dx*dx + dy*dy + dz*dz < d2) rep[j] = i
      }
    }

    // Build compact vertex list
    const remap = new Int32Array(n).fill(-1)
    const newPos: number[] = [], newUvs: number[] = []
    let nextIdx = 0

    for (let i = 0; i < n; i++) {
      if (rep[i] === i) {
        remap[i] = nextIdx++
        newPos.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
        if (uvAttr) newUvs.push(uvAttr.getX(i), uvAttr.getY(i))
      }
    }
    for (let i = 0; i < n; i++) {
      if (rep[i] !== i) remap[i] = remap[rep[i]]
    }

    // Remap index
    const newIdx: number[] = []
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = remap[index.getX(i)], b = remap[index.getX(i+1)], c = remap[index.getX(i+2)]
        if (a !== b && b !== c && a !== c) newIdx.push(a, b, c)
      }
    } else {
      for (let i = 0; i < n; i += 3) {
        const a = remap[i], b = remap[i+1], c = remap[i+2]
        if (a !== b && b !== c && a !== c) newIdx.push(a, b, c)
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(newPos), 3))
    if (uvAttr) geo.setAttribute('uv', new BufferAttribute(new Float32Array(newUvs), 2))
    geo.setIndex(newIdx)
    geo.computeVertexNormals()
    return { Geometry: geo }
  }
}
