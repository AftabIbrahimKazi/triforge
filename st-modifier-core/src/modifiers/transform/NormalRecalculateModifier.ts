import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

/**
 * Normal Recalculate Modifier — recalculates smooth vertex normals from geometry.
 * Run this after DisplacementModifier or any deform modifier that changes vertex positions,
 * because the normals from the source geometry will no longer match the displaced surface.
 *
 * Equivalent to Blender's "Recalculate Normals" in edit mode.
 * Uses Three.js computeVertexNormals() internally for angle-weighted smooth normals.
 *
 * No parameters — this modifier is purely structural.
 */
export class NormalRecalculateModifier extends BaseModifier {
  get name() { return 'NormalRecalculate' }

  parameters: Record<string, number> = {}

  apply(geometry: BufferGeometry): BufferGeometry {
    const result = geometry.clone()
    result.computeVertexNormals()
    return result
  }
}
