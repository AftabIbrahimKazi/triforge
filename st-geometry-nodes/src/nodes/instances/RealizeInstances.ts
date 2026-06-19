import { BufferGeometry, BufferAttribute } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'
import { mergeGeometries } from '../geometry/JoinGeometry.js'

/**
 * RealizeInstances — flatten instanced geometry into a single mesh.
 * Blender: Geometry Nodes > Instances > Realize Instances
 *
 * Takes a BufferGeometry array (as produced by InstanceOnPoints) and merges
 * them into one single manifold geometry. After realization, instances are
 * editable as regular geometry.
 */
export class RealizeInstances extends GeometryNode {
  readonly nodeType = 'RealizeInstances'
  parameters = {}

  constructor(opts: { geometry?: OutputRef | BufferGeometry | BufferGeometry[] | null } = {}) {
    super()
    if (opts.geometry != null) this._inputs.geometry = opts.geometry as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const src = inputs.geometry

    if (!src) return { Geometry: null }

    // Already a flat BufferGeometry — return as-is
    if (src instanceof BufferGeometry) return { Geometry: src }

    // Array of geometries — merge them
    if (Array.isArray(src)) {
      const geos = (src as unknown[]).filter((g): g is BufferGeometry => g instanceof BufferGeometry)
      if (geos.length === 0) return { Geometry: null }
      if (geos.length === 1) return { Geometry: geos[0].clone() }
      return { Geometry: mergeGeometries(geos) }
    }

    return { Geometry: null }
  }
}
