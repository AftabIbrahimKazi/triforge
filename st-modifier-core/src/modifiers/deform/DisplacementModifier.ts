import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

/** Noise/height callback — any function that maps a 3D point to a scalar displacement value. */
export type NoiseFunction = (x: number, y: number, z: number) => number

export interface DisplacementModifierOptions {
  /** Displacement magnitude. */
  strength?:      number
  /** Midlevel: 0.5 means the surface sits at the midpoint of the noise range. */
  midlevel?:      number
  /**
   * Noise/height function: (x, y, z) => value in [0, 1].
   * Completely decoupled — pass any noise library, st-shader-core CPU noise, or a custom function.
   * @example (x, y, z) => (Math.sin(x * 4) * 0.5 + 0.5)
   * @example (x, y, z) => simplexNoise.noise3D(x, y, z) * 0.5 + 0.5
   */
  noiseFunction?: NoiseFunction
}

/**
 * Displacement Modifier — Blender "Displace" modifier equivalent.
 * Pushes each vertex along its normal by a distance driven by a noise function.
 *
 * The noiseFunction callback is deliberately decoupled — it accepts any source:
 * a math expression, simplex noise, Perlin noise, a texture sample, or a
 * CPU-side equivalent from st-shader-core. This keeps st-modifier-core independent.
 *
 * parameters.strength: displacement magnitude
 * parameters.midlevel: 0 = only positive displacement, 0.5 = centered, 1 = only negative
 *
 * Run SubdivisionModifier first for smooth results.
 */
export class DisplacementModifier extends BaseModifier {
  get name() { return 'Displace' }

  parameters: Record<string, number>
  noiseFunction: NoiseFunction

  constructor(options: DisplacementModifierOptions = {}) {
    super()
    this.parameters    = {
      strength: options.strength ?? 1.0,
      midlevel: options.midlevel ?? 0.5,
    }
    this.noiseFunction = options.noiseFunction ?? (() => 0.5)
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const strength = this.parameters.strength
    const midlevel = this.parameters.midlevel

    const srcPos  = geometry.getAttribute('position')
    const srcNorm = geometry.getAttribute('normal')
    const srcUv   = geometry.getAttribute('uv')
    const srcIdx  = geometry.getIndex()
    const vCount  = srcPos.count

    const outPos = new Float32Array(vCount * 3)

    for (let v = 0; v < vCount; v++) {
      const px = srcPos.getX(v), py = srcPos.getY(v), pz = srcPos.getZ(v)
      const nx = srcNorm ? srcNorm.getX(v) : 0
      const ny = srcNorm ? srcNorm.getY(v) : 1
      const nz = srcNorm ? srcNorm.getZ(v) : 0

      const noiseVal = Math.max(0, Math.min(1, this.noiseFunction(px, py, pz)))
      const disp     = (noiseVal - midlevel) * strength

      outPos[v*3]   = px + nx * disp
      outPos[v*3+1] = py + ny * disp
      outPos[v*3+2] = pz + nz * disp
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
