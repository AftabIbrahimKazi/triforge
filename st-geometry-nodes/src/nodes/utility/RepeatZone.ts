import { GeometryNode } from '../../core/GeometryNode.js'
import type { Inputs, OutputRef, SocketValue } from '../../core/GeometryNode.js'
import type { BufferGeometry } from 'three'

/**
 * Body function called once per iteration.
 *
 * @param geometry  The geometry produced by the previous iteration (or the
 *                  initial geometry on iteration 0).
 * @param index     Zero-based iteration index.
 * @param total     Total number of iterations.
 * @returns         The geometry to carry into the next iteration.
 */
export type RepeatBody = (
  geometry: BufferGeometry,
  index:    number,
  total:    number,
) => BufferGeometry

export interface RepeatZoneInputs {
  /** Starting geometry (required). */
  geometry:   OutputRef
  /** Number of times to repeat the body. Default: 1. */
  iterations?: number
  /**
   * The loop body.  Receives the geometry from the previous iteration and
   * must return the geometry for the next iteration.
   *
   * Inside the body you can:
   *   • Create and evaluate a geometry node subgraph using GeometryLiteral
   *   • Use st-modifier-core's ModifierStack directly
   *   • Manipulate the BufferGeometry with plain Three.js code
   *
   * @example
   * body: (geo, i, total) => {
   *   const displaced = new SetPosition({
   *     geometry: new GeometryLiteral(geo).output('Geometry'),
   *     offset: [0, Math.sin(i * 0.5) * 0.05, 0],
   *   })
   *   return displaced.output('Geometry').evaluate() as BufferGeometry
   * }
   */
  body:        RepeatBody
}

/**
 * RepeatZone — Blender Geometry Nodes "Repeat Zone" equivalent.
 *
 * Executes a body function N times, threading the geometry output of each
 * iteration into the next.  Unlocks iterative geometry algorithms that a
 * static DAG cannot express:
 *
 *   • Fractal geometry (iterative subdivision + displacement)
 *   • Mesh relaxation (Laplacian smoothing passes)
 *   • Procedural growth (L-systems, coral, crystal structures)
 *   • Any algorithm that needs to visit geometry N times with state
 *
 * @example — fractal subdivision + noise displacement
 * const fractal = new RepeatZone({
 *   geometry: new IcoSphere({ radius: 1, subdivisions: 1 }).output('Geometry'),
 *   iterations: 4,
 *   body: (geo, i, total) => {
 *     const sub = new SubdivisionSurface({
 *       geometry: new GeometryLiteral(geo).output('Geometry'),
 *       level: 1,
 *     })
 *     const displaced = new SetPosition({
 *       geometry: sub.output('Geometry'),
 *       offset: (vi, n) => {
 *         const s = Math.pow(0.5, i + 1) * 0.3
 *         return [
 *           (Math.random() - 0.5) * s,
 *           (Math.random() - 0.5) * s,
 *           (Math.random() - 0.5) * s,
 *         ]
 *       },
 *     })
 *     return displaced.output('Geometry').evaluate() as BufferGeometry
 *   },
 * })
 *
 * const geo = fractal.output('Geometry').evaluate()
 */
export class RepeatZone extends GeometryNode {
  readonly nodeType = 'RepeatZone'
  parameters        = {}

  private readonly _iterations: number
  private readonly _body:       RepeatBody

  constructor(inputs: RepeatZoneInputs) {
    super()
    this._iterations    = Math.max(1, inputs.iterations ?? 1)
    this._body          = inputs.body
    this._inputs['geometry'] = inputs.geometry
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    let geo = inputs['geometry'] as BufferGeometry

    if (!geo) {
      throw new Error('RepeatZone: "geometry" input is required and must resolve to a BufferGeometry.')
    }

    for (let i = 0; i < this._iterations; i++) {
      geo = this._body(geo, i, this._iterations)

      if (!(geo && geo.isBufferGeometry)) {
        throw new Error(
          `RepeatZone: body() iteration ${i} did not return a BufferGeometry. ` +
          `Make sure you call .evaluate() on any OutputRef inside the body.`
        )
      }
    }

    return { Geometry: geo }
  }
}
