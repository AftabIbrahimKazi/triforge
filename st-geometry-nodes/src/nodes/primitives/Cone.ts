import { GeometryNode, type Inputs, type SocketValue } from '../../core/GeometryNode.js'
import { Cylinder } from './Cylinder.js'

/**
 * Cone — cone with optional cap.
 * Blender: Add > Mesh > Cone
 * Implemented as Cylinder with radiusTop = 0.
 */
export class Cone extends GeometryNode {
  readonly nodeType = 'Cone'

  parameters: {
    vertices: number
    radius:   number
    depth:    number
    capFill:  string
  }

  constructor(opts: { vertices?: number; radius?: number; depth?: number; capFill?: string } = {}) {
    super()
    this.parameters = {
      vertices: opts.vertices ?? 32,
      radius:   opts.radius   ?? 1,
      depth:    opts.depth    ?? 2,
      capFill:  opts.capFill  ?? 'NGON',
    }
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const { vertices, radius, depth, capFill } = this.parameters
    const cyl = new Cylinder({ vertices, radiusTop: 0, radiusBottom: radius, depth, capFill })
    return cyl._evaluate(inputs)
  }
}
