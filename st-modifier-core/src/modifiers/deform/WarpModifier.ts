import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface WarpModifierOptions {
  /** Center of the warp influence (source point). */
  fromX?: number; fromY?: number; fromZ?: number
  /** Target point — vertices near fromPoint are pulled toward this. */
  toX?:   number; toY?:   number; toZ?:   number
  /** Radius of influence — vertices outside this radius are unaffected. */
  radius?: number
  /** Warp strength [0, 1]. */
  strength?: number
}

/**
 * Warp Modifier — Blender "Warp" modifier equivalent.
 * Pulls vertices near a source point toward a target point.
 * Influence falls off smoothly beyond the radius.
 *
 * parameters.fromX/Y/Z: source point
 * parameters.toX/Y/Z:   target point
 * parameters.radius:    influence radius
 * parameters.strength:  warp intensity [0, 1]
 */
export class WarpModifier extends BaseModifier {
  get name() { return 'Warp' }

  parameters: Record<string, number>

  constructor(options: WarpModifierOptions = {}) {
    super()
    this.parameters = {
      fromX:    options.fromX    ?? 0,
      fromY:    options.fromY    ?? 0,
      fromZ:    options.fromZ    ?? 0,
      toX:      options.toX      ?? 1,
      toY:      options.toY      ?? 0,
      toZ:      options.toZ      ?? 0,
      radius:   options.radius   ?? 1.0,
      strength: options.strength ?? 1.0,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const { fromX, fromY, fromZ, toX, toY, toZ, radius, strength } = this.parameters

    const srcPos = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcUv   = geometry.getAttribute('uv')
    const srcIdx  = geometry.getIndex()
    const vCount  = srcPos.count

    const outPos = new Float32Array(vCount * 3)

    const dx = toX - fromX, dy = toY - fromY, dz = toZ - fromZ

    for (let v = 0; v < vCount; v++) {
      const px = srcPos.getX(v), py = srcPos.getY(v), pz = srcPos.getZ(v)

      // Distance from vertex to source point
      const ex = px - fromX, ey = py - fromY, ez = pz - fromZ
      const dist = Math.sqrt(ex*ex + ey*ey + ez*ez)

      // Smooth falloff within radius
      const t = Math.max(0, 1 - dist / Math.max(radius, 1e-6))
      const influence = t * t * (3 - 2 * t) * strength  // smoothstep

      outPos[v*3]   = px + dx * influence
      outPos[v*3+1] = py + dy * influence
      outPos[v*3+2] = pz + dz * influence
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(outPos, 3))
    if (srcNorm) result.setAttribute('normal', srcNorm.clone())
    if (srcUv)   result.setAttribute('uv',     srcUv.clone())
    if (srcIdx)  result.setIndex(srcIdx.clone())
    result.computeVertexNormals()
    return result
  }
}
