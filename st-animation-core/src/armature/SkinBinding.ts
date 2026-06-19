import { BufferGeometry, BufferAttribute, Vector3, Matrix4 } from 'three'
import type { Armature } from './Armature.js'

export interface SkinWeight {
  /** Bone name. */
  bone: string
  /** Weight [0, 1]. Weights per vertex should sum to 1. */
  weight: number
}

/**
 * SkinBinding — applies armature bone transforms to a mesh via vertex weights.
 * Blender: Vertex Groups (one per bone) + Armature modifier.
 *
 * This is a CPU-side implementation (updates position/normal attributes each frame).
 * For GPU skinning, export bone matrices and use THREE.SkinnedMesh instead.
 *
 * Usage:
 *   const skin = new SkinBinding(armature, geometry, weights)
 *   // weights: Float32Array of [boneIndex0, weight0, boneIndex1, weight1, ...] per vertex
 *   // Or use the higher-level bindWeights(vertexWeights) helper
 *   skin.apply()   // call every frame after armature.update()
 */
export class SkinBinding {
  private _armature: Armature
  private _geometry: BufferGeometry
  /** Per-vertex weights: array of SkinWeight[] indexed by vertex. */
  private _weights: SkinWeight[][]
  /** Bind-pose inverse matrices (snapshot at construction time). */
  private _bindInverses: Map<string, Matrix4>
  /** Original (bind-pose) positions. */
  private _bindPositions: Float32Array
  private _bindNormals: Float32Array | null

  constructor(armature: Armature, geometry: BufferGeometry, weights: SkinWeight[][]) {
    this._armature    = armature
    this._geometry    = geometry
    this._weights     = weights

    // Snapshot bind-pose matrices
    armature.update()
    this._bindInverses = new Map()
    for (const name of armature.boneNames) {
      this._bindInverses.set(name, armature.pose[name].worldMatrix.clone().invert())
    }

    const pos = geometry.getAttribute('position') as BufferAttribute
    this._bindPositions = new Float32Array(pos.array)

    const nrm = geometry.getAttribute('normal') as BufferAttribute | undefined
    this._bindNormals = nrm ? new Float32Array(nrm.array) : null
  }

  /**
   * Apply current armature pose to the geometry.
   * Call every frame after `armature.update()`.
   */
  apply(): void {
    const pos     = this._geometry.getAttribute('position') as BufferAttribute
    const nrmAttr = this._geometry.getAttribute('normal')  as BufferAttribute | undefined
    const n       = pos.count

    for (let vi = 0; vi < n; vi++) {
      const ws = this._weights[vi]
      if (!ws || ws.length === 0) continue

      const bp = this._bindPositions
      const bx = bp[vi*3], by = bp[vi*3+1], bz = bp[vi*3+2]
      let ox = 0, oy = 0, oz = 0

      for (const { bone, weight } of ws) {
        if (weight === 0) continue
        const bindInv = this._bindInverses.get(bone)
        const world   = this._armature.pose[bone].worldMatrix
        if (!bindInv || !world) continue

        // skinMatrix = world × bindInverse
        const skin = world.clone().multiply(bindInv)
        ox += (skin.elements[0]*bx + skin.elements[4]*by + skin.elements[8]*bz  + skin.elements[12]) * weight
        oy += (skin.elements[1]*bx + skin.elements[5]*by + skin.elements[9]*bz  + skin.elements[13]) * weight
        oz += (skin.elements[2]*bx + skin.elements[6]*by + skin.elements[10]*bz + skin.elements[14]) * weight
      }

      pos.setXYZ(vi, ox, oy, oz)

      // Transform normals (upper 3×3 of skin matrix, no translation)
      if (nrmAttr && this._bindNormals) {
        const bn = this._bindNormals
        const nx = bn[vi*3], ny = bn[vi*3+1], nz = bn[vi*3+2]
        let nnx = 0, nny = 0, nnz = 0

        for (const { bone, weight } of ws) {
          if (weight === 0) continue
          const bindInv = this._bindInverses.get(bone)
          const world   = this._armature.pose[bone].worldMatrix
          if (!bindInv || !world) continue
          const skin = world.clone().multiply(bindInv)
          nnx += (skin.elements[0]*nx + skin.elements[4]*ny + skin.elements[8]*nz)  * weight
          nny += (skin.elements[1]*nx + skin.elements[5]*ny + skin.elements[9]*nz)  * weight
          nnz += (skin.elements[2]*nx + skin.elements[6]*ny + skin.elements[10]*nz) * weight
        }

        const nLen = Math.sqrt(nnx*nnx + nny*nny + nnz*nnz) || 1
        nrmAttr.setXYZ(vi, nnx/nLen, nny/nLen, nnz/nLen)
      }
    }

    pos.needsUpdate = true
    if (nrmAttr) nrmAttr.needsUpdate = true
  }
}

/**
 * Compute automatic envelope-style skin weights.
 * Each vertex is assigned to the nearest bone (distance to bone segment) with weight 1.
 * For smoother results, use `computeHeatWeights` or supply manual weights.
 */
export function computeEnvelopeWeights(
  geometry: BufferGeometry,
  armature: Armature,
): SkinWeight[][] {
  const pos   = geometry.getAttribute('position') as BufferAttribute
  const n     = pos.count
  const bones = armature.bones
  const weights: SkinWeight[][] = []

  for (let vi = 0; vi < n; vi++) {
    const vx = pos.getX(vi), vy = pos.getY(vi), vz = pos.getZ(vi)
    const v  = new Vector3(vx, vy, vz)
    let   bestBone = bones[0].name
    let   bestDist = Infinity

    for (const bone of bones) {
      // Distance from vertex to bone segment (head → tail)
      const h  = bone.head, t = bone.tail
      const ab = t.clone().sub(h)
      const av = v.clone().sub(h)
      const t2 = Math.max(0, Math.min(1, av.dot(ab) / (ab.dot(ab) || 1)))
      const closest = h.clone().addScaledVector(ab, t2)
      const d = v.distanceTo(closest)
      if (d < bestDist) { bestDist = d; bestBone = bone.name }
    }

    weights.push([{ bone: bestBone, weight: 1 }])
  }

  return weights
}
