import { BufferGeometry, BufferAttribute, Triangle, Vector3 } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface ShrinkwrapModifierOptions {
  offset?: number
  factor?: number
}

/**
 * Shrinkwrap Modifier — Blender "Shrinkwrap" modifier equivalent.
 * Projects each vertex of the source geometry onto the nearest point on a
 * target surface (brute-force BVH-lite over all triangles).
 *
 * parameters.offset: distance above the surface after projection
 * parameters.factor: blend [0–1] between original position and projected position
 *
 * Constructor: new ShrinkwrapModifier(targetGeometry, options?)
 */
export class ShrinkwrapModifier extends BaseModifier {
  get name() { return 'Shrinkwrap' }

  parameters: Record<string, number>

  private readonly _target: BufferGeometry

  constructor(target: BufferGeometry, options: ShrinkwrapModifierOptions = {}) {
    super()
    this._target = target
    this.parameters = {
      offset: options.offset ?? 0.0,
      factor: Math.max(0, Math.min(1, options.factor ?? 1.0)),
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const factor = Math.max(0, Math.min(1, this.parameters.factor))
    const offset = this.parameters.offset

    const srcPos  = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcUv   = geometry.getAttribute('uv')
    const vCount  = srcPos.count

    // Pre-build target triangle list
    const tgtPos = this._target.getAttribute('position')
    const tgtIdx = this._target.getIndex()
    const tgtVCount = tgtPos.count

    // Build flat triangle list for target
    const tris: [number, number, number][] = []
    if (tgtIdx) {
      const ia = tgtIdx.array
      for (let i = 0; i < ia.length; i += 3) tris.push([ia[i], ia[i + 1], ia[i + 2]])
    } else {
      for (let i = 0; i < tgtVCount; i += 3) tris.push([i, i + 1, i + 2])
    }

    const outPos:  number[] = []
    const outNorm: number[] = []
    const outUv:   number[] = []

    const tri      = new Triangle()
    const tA       = new Vector3()
    const tB       = new Vector3()
    const tC       = new Vector3()
    const closest  = new Vector3()
    const best     = new Vector3()
    const triNorm  = new Vector3()
    const origPt   = new Vector3()
    const projected = new Vector3()

    for (let v = 0; v < vCount; v++) {
      origPt.set(srcPos.getX(v), srcPos.getY(v), srcPos.getZ(v))

      let bestDist = Infinity

      for (const [ai, bi, ci] of tris) {
        tA.set(tgtPos.getX(ai), tgtPos.getY(ai), tgtPos.getZ(ai))
        tB.set(tgtPos.getX(bi), tgtPos.getY(bi), tgtPos.getZ(bi))
        tC.set(tgtPos.getX(ci), tgtPos.getY(ci), tgtPos.getZ(ci))
        tri.set(tA, tB, tC)
        tri.closestPointToPoint(origPt, closest)
        const d = origPt.distanceToSquared(closest)
        if (d < bestDist) {
          bestDist = d
          best.copy(closest)
        }
      }

      // Compute surface normal at closest point (face normal of target mesh at best)
      // Use the best-matching triangle normal
      let bestTriNorm: Vector3 | null = null
      if (tris.length > 0) {
        bestDist = Infinity
        for (const [ai, bi, ci] of tris) {
          tA.set(tgtPos.getX(ai), tgtPos.getY(ai), tgtPos.getZ(ai))
          tB.set(tgtPos.getX(bi), tgtPos.getY(bi), tgtPos.getZ(bi))
          tC.set(tgtPos.getX(ci), tgtPos.getY(ci), tgtPos.getZ(ci))
          tri.set(tA, tB, tC)
          tri.closestPointToPoint(origPt, closest)
          const d = origPt.distanceToSquared(closest)
          if (d < bestDist) {
            bestDist = d
            tri.getNormal(triNorm)
            bestTriNorm = triNorm.clone()
          }
        }
      }

      // Projected position = best point + normal * offset
      if (bestTriNorm) {
        projected.copy(best).addScaledVector(bestTriNorm, offset)
      } else {
        projected.copy(best)
      }

      // Lerp between original and projected by factor
      const px = origPt.x + (projected.x - origPt.x) * factor
      const py = origPt.y + (projected.y - origPt.y) * factor
      const pz = origPt.z + (projected.z - origPt.z) * factor

      outPos.push(px, py, pz)

      if (srcNorm) outNorm.push(srcNorm.getX(v), srcNorm.getY(v), srcNorm.getZ(v))
      if (srcUv)   outUv.push(srcUv.getX(v), srcUv.getY(v))
    }

    // Copy index if present
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(outPos), 3))
    if (srcNorm) result.setAttribute('normal', new BufferAttribute(new Float32Array(outNorm), 3))
    if (srcUv)   result.setAttribute('uv',     new BufferAttribute(new Float32Array(outUv),   2))

    const srcIdx = geometry.getIndex()
    if (srcIdx) result.setIndex(new BufferAttribute(new Uint32Array(srcIdx.array), 1))

    result.computeVertexNormals()
    return result
  }
}
