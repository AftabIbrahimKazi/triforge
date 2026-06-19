import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

/**
 * JoinGeometry — merge a list of geometries into one.
 * Blender: Geometry Nodes > Geometry > Join Geometry
 */
export class JoinGeometry extends GeometryNode {
  readonly nodeType = 'JoinGeometry'
  parameters = {}

  constructor(geometries: Array<OutputRef | BufferGeometry>) {
    super()
    this._inputs.geometries = geometries as unknown as SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const list = inputs.geometries as unknown as BufferGeometry[]
    const geos = list.filter((g): g is BufferGeometry => g instanceof BufferGeometry)
    if (geos.length === 0) return { Geometry: null }
    if (geos.length === 1) return { Geometry: geos[0].clone() }

    const merged = mergeGeometries(geos)
    return { Geometry: merged }
  }
}

/** Merge an array of BufferGeometries into one (non-indexed or re-indexed). */
export function mergeGeometries(geos: BufferGeometry[]): BufferGeometry {
  // Convert all to non-indexed for simplicity, then re-index optionally
  const allPos: number[] = []
  const allNor: number[] = []
  const allUvs: number[] = []
  const allIdx: number[] = []
  let vertBase = 0

  for (const geo of geos) {
    const posAttr = geo.getAttribute('position') as BufferAttribute
    const norAttr = geo.getAttribute('normal')   as BufferAttribute | undefined
    const uvAttr  = geo.getAttribute('uv')       as BufferAttribute | undefined
    const index   = geo.getIndex()

    if (index) {
      for (let i = 0; i < index.count; i++) {
        allIdx.push(index.getX(i) + vertBase)
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) allIdx.push(i + vertBase)
    }

    for (let i = 0; i < posAttr.count; i++) {
      allPos.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
      if (norAttr) allNor.push(norAttr.getX(i), norAttr.getY(i), norAttr.getZ(i))
      else         allNor.push(0, 1, 0)
      if (uvAttr)  allUvs.push(uvAttr.getX(i), uvAttr.getY(i))
      else         allUvs.push(0, 0)
    }
    vertBase += posAttr.count
  }

  const out = new BufferGeometry()
  out.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3))
  out.setAttribute('normal',   new BufferAttribute(new Float32Array(allNor), 3))
  out.setAttribute('uv',       new BufferAttribute(new Float32Array(allUvs), 2))
  out.setIndex(allIdx)
  return out
}
