import {
  Data3DTexture, RGBAFormat, FloatType,
  LinearFilter, ClampToEdgeWrapping,
  Vector3,
} from 'three'

export interface PointDensityOptions {
  /**
   * 3D texture resolution per axis. Default 32.
   * Higher = finer density detail, more GPU memory (res³ × 16 bytes).
   */
  resolution?: number

  /**
   * World-space bounding box to map into the texture.
   * Default: [-2,-2,-2] to [2,2,2].
   */
  boundsMin?: [number, number, number]
  boundsMax?: [number, number, number]

  /**
   * Gaussian splat radius in world units. Default 0.3.
   * Each point smears its density across neighbouring voxels within this radius.
   */
  radius?: number

  /**
   * Colour of the density field. Default [1,1,1].
   */
  color?: [number, number, number]
}

/**
 * PointDensity — builds a live `THREE.Data3DTexture` from a point cloud
 * (particle positions, fluid particles, or any Float32Array of xyz triples).
 *
 * Blender equivalent: the PointDensity shader node — samples a volumetric
 * density field built from object point cloud data to drive surface shading.
 *
 * Usage:
 * 1. Create once: `const pd = new PointDensity({ resolution: 32 })`
 * 2. Call each frame: `pd.update(particleSystem.getPositions())`
 * 3. Inject into a material uniform: `mat.uniforms.uPointDensity = { value: pd.texture }`
 * 4. In your GLSL: `float density = texture(uPointDensity, worldToUV(pos)).r`
 *
 * @example
 * const pd = new PointDensity({ resolution: 32, radius: 0.4, boundsMin: [-2,-2,-2], boundsMax: [2,2,2] })
 * // in animate():
 * pd.update(fluid.getPositions())
 * mat.uniforms.uPointDensity.value = pd.texture
 */
export class PointDensity {
  readonly texture: Data3DTexture

  parameters: {
    resolution: number
    radius:     number
    color:      [number, number, number]
  }

  private readonly _res:      number
  private readonly _bMin:     Vector3
  private readonly _bMax:     Vector3
  private readonly _bSize:    Vector3
  private readonly _data:     Float32Array<ArrayBuffer>  // rgba, res³ voxels

  constructor(opts: PointDensityOptions = {}) {
    const res   = opts.resolution ?? 32
    const bMin  = opts.boundsMin  ?? [-2, -2, -2]
    const bMax  = opts.boundsMax  ?? [ 2,  2,  2]

    this._res   = res
    this._bMin  = new Vector3(...bMin)
    this._bMax  = new Vector3(...bMax)
    this._bSize = new Vector3().subVectors(this._bMax, this._bMin)
    this._data  = new Float32Array(res * res * res * 4) as unknown as Float32Array<ArrayBuffer>

    this.parameters = {
      resolution: res,
      radius:     opts.radius ?? 0.3,
      color:      opts.color  ?? [1, 1, 1],
    }

    this.texture = new Data3DTexture(this._data, res, res, res)
    this.texture.format  = RGBAFormat
    this.texture.type    = FloatType
    this.texture.minFilter = LinearFilter
    this.texture.magFilter = LinearFilter
    this.texture.wrapS   = ClampToEdgeWrapping
    this.texture.wrapT   = ClampToEdgeWrapping
    this.texture.wrapR   = ClampToEdgeWrapping
    this.texture.needsUpdate = true
  }

  /**
   * Rebuild the density texture from a flat Float32Array of xyz positions.
   * Pass `particleSystem.getPositions()` or `FLIPSimulator.getPositions()` directly.
   * Call each frame when particle positions change.
   */
  update(positions: Float32Array | number[]): void {
    const res    = this._res
    const data   = this._data
    const radius = this.parameters.radius
    const [cr, cg, cb] = this.parameters.color

    // Clear
    data.fill(0)

    const invSizeX = res / this._bSize.x
    const invSizeY = res / this._bSize.y
    const invSizeZ = res / this._bSize.z
    const r2       = radius * radius

    const n = Math.floor(positions.length / 3)
    for (let p = 0; p < n; p++) {
      const wx = positions[p*3]
      const wy = positions[p*3+1]
      const wz = positions[p*3+2]

      // Map to voxel space
      const vx = (wx - this._bMin.x) * invSizeX
      const vy = (wy - this._bMin.y) * invSizeY
      const vz = (wz - this._bMin.z) * invSizeZ

      // Splat into a small neighbourhood
      const vrad = radius * invSizeX  // approx voxel radius
      const r0x  = Math.max(0, Math.floor(vx - vrad))
      const r1x  = Math.min(res - 1, Math.ceil(vx + vrad))
      const r0y  = Math.max(0, Math.floor(vy - vrad))
      const r1y  = Math.min(res - 1, Math.ceil(vy + vrad))
      const r0z  = Math.max(0, Math.floor(vz - vrad))
      const r1z  = Math.min(res - 1, Math.ceil(vz + vrad))

      for (let iz = r0z; iz <= r1z; iz++)
      for (let iy = r0y; iy <= r1y; iy++)
      for (let ix = r0x; ix <= r1x; ix++) {
        const dwx = (ix / invSizeX + this._bMin.x) - wx
        const dwy = (iy / invSizeY + this._bMin.y) - wy
        const dwz = (iz / invSizeZ + this._bMin.z) - wz
        const d2  = dwx*dwx + dwy*dwy + dwz*dwz
        if (d2 > r2) continue
        const weight = 1 - d2 / r2   // linear falloff
        const idx    = (iz * res * res + iy * res + ix) * 4
        data[idx]   += weight * cr
        data[idx+1] += weight * cg
        data[idx+2] += weight * cb
        data[idx+3] += weight
      }
    }

    this.texture.needsUpdate = true
  }

  /**
   * Returns a GLSL helper snippet to sample this texture in a ShaderMaterial.
   * Inject into fragmentShader and call `samplePointDensity(worldPos)`.
   *
   * @param uniformName - Name of the sampler3D uniform. Default 'uPointDensity'.
   */
  /**
   * Returns a GLSL snippet (for GLSL 3 / WebGL 2) declaring the sampler3D
   * uniform and a helper function to sample it from world position.
   *
   * Requires `glslVersion: THREE.GLSL3` on the ShaderMaterial.
   */
  glslSampler(uniformName = 'uPointDensity'): string {
    const bMin  = this._bMin
    const bSize = this._bSize
    return `
uniform sampler3D ${uniformName};
vec4 samplePointDensity(vec3 worldPos) {
  vec3 uv = (worldPos - vec3(${bMin.x.toFixed(4)}, ${bMin.y.toFixed(4)}, ${bMin.z.toFixed(4)}))
          / vec3(${bSize.x.toFixed(4)}, ${bSize.y.toFixed(4)}, ${bSize.z.toFixed(4)});
  uv = clamp(uv, 0.0, 1.0);
  return texture(${uniformName}, uv);
}`.trim()
  }
}
