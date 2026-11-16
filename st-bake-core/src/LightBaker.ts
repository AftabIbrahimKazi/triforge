import { Color, DataTexture, FloatType, LinearFilter, RGBAFormat } from 'three'
import type { Material, Mesh } from 'three'

import { BuiltInIntersector } from './intersect/BuiltInIntersector.js'
import { makeRandom } from './random.js'
import { dilate, rasterizeMesh, textureSizeFor } from './raster.js'
import { buildSoup } from './scene.js'
import { Shader } from './shading.js'
import type {
  BakeProgress, IntersectorFactory, SkyFunction, SunSpec, TriangleSoup, Vec3,
} from './types.js'

const CHANNELS = 4
const COORDS = 3
const DEFAULT_ALBEDO = 0.8
const DEFAULT_SAMPLES = 64
const DEFAULT_MAX_TEXELS = 1024
const DEFAULT_SEED = 1337
const MAX_SAMPLES = 65536
const MAX_TEXELS_LIMIT = 8192
const MIN_DIRECTION_LENGTH = 1e-6
const DEFAULT_YIELD_MS = 12

export interface LightBakerOptions {
  sun: SunSpec
  sky: SkyFunction
  texelsPerMeter: number
  samples?: number
  maxTexels?: number
  seed?: number
  albedo?: (mesh: Mesh) => Vec3
  createIntersector?: IntersectorFactory
}

export interface LightBakerParameters {
  texelsPerMeter: number
  samples: number
  maxTexels: number
  seed: number
  sunIntensity: number
}

export type BakeResult = Map<Mesh, DataTexture>

function materialColor(mesh: Mesh): Vec3 {
  const material: Material | Material[] = mesh.material
  const first = Array.isArray(material) ? material[0] : material
  if (first && 'color' in first && first.color instanceof Color) {
    return [first.color.r, first.color.g, first.color.b]
  }
  return [DEFAULT_ALBEDO, DEFAULT_ALBEDO, DEFAULT_ALBEDO]
}

function requireFiniteVec3(value: Vec3, label: string): void {
  if (value.length !== COORDS || !value.every(Number.isFinite)) {
    throw new RangeError(`LightBaker: ${label} must be three finite numbers`)
  }
}

export class LightBaker {
  readonly parameters: LightBakerParameters
  sunDirection: Vec3
  sunColor: Vec3
  sky: SkyFunction
  private readonly meshes: readonly Mesh[]
  private readonly albedo: (mesh: Mesh) => Vec3
  private readonly createIntersector: IntersectorFactory

  constructor(meshes: readonly Mesh[], options: LightBakerOptions) {
    this.meshes = meshes
    this.parameters = {
      texelsPerMeter: options.texelsPerMeter,
      samples: options.samples ?? DEFAULT_SAMPLES,
      maxTexels: options.maxTexels ?? DEFAULT_MAX_TEXELS,
      seed: options.seed ?? DEFAULT_SEED,
      sunIntensity: options.sun.intensity,
    }
    this.sunDirection = options.sun.direction
    this.sunColor = options.sun.color
    this.sky = options.sky
    this.albedo = options.albedo ?? materialColor
    this.createIntersector = options.createIntersector ?? ((soup) => new BuiltInIntersector(soup))
  }

  bake(): BakeResult {
    const steps = this.run()
    for (let step = steps.next(); ; step = steps.next()) {
      if (step.done) return step.value
    }
  }

  async bakeAsync(
    onProgress?: (progress: BakeProgress) => void,
    yieldEveryMs: number = DEFAULT_YIELD_MS,
  ): Promise<BakeResult> {
    const steps = this.run()
    let sliceStart = performance.now()
    for (let step = steps.next(); ; step = steps.next()) {
      if (step.done) return step.value
      onProgress?.(step.value)
      if (performance.now() - sliceStart >= yieldEveryMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        sliceStart = performance.now()
      }
    }
  }

  private validate(): Vec3 {
    const { texelsPerMeter, samples, maxTexels, seed, sunIntensity } = this.parameters
    if (!Number.isFinite(texelsPerMeter) || texelsPerMeter <= 0) {
      throw new RangeError('LightBaker: texelsPerMeter must be a positive finite number')
    }
    if (!Number.isInteger(samples) || samples < 1 || samples > MAX_SAMPLES) {
      throw new RangeError(`LightBaker: samples must be an integer from 1 to ${MAX_SAMPLES}`)
    }
    if (!Number.isInteger(maxTexels) || maxTexels < 1 || maxTexels > MAX_TEXELS_LIMIT) {
      throw new RangeError(`LightBaker: maxTexels must be an integer from 1 to ${MAX_TEXELS_LIMIT}`)
    }
    if (!Number.isFinite(seed)) throw new RangeError('LightBaker: seed must be finite')
    if (!Number.isFinite(sunIntensity) || sunIntensity < 0) {
      throw new RangeError('LightBaker: sunIntensity must be a non-negative finite number')
    }
    requireFiniteVec3(this.sunDirection, 'sun direction')
    requireFiniteVec3(this.sunColor, 'sun color')
    const length = Math.hypot(...this.sunDirection)
    if (length < MIN_DIRECTION_LENGTH) throw new RangeError('LightBaker: sun direction must not be zero')
    return [this.sunDirection[0] / length, this.sunDirection[1] / length, this.sunDirection[2] / length]
  }

  private albedoTable(): Float32Array {
    const table = new Float32Array(this.meshes.length * COORDS)
    this.meshes.forEach((mesh, index) => {
      const value = this.albedo(mesh)
      requireFiniteVec3(value, 'albedo')
      table.set(value, index * COORDS)
    })
    return table
  }

  private *run(): Generator<BakeProgress, BakeResult, void> {
    const sunDirection = this.validate()
    const result: BakeResult = new Map()
    if (this.meshes.length === 0) return result

    const soup: TriangleSoup = buildSoup(this.meshes)
    const intersector = this.createIntersector(soup)
    const { texelsPerMeter, maxTexels, samples, seed, sunIntensity } = this.parameters
    const albedo = this.albedoTable()

    for (let meshIndex = 0; meshIndex < this.meshes.length; meshIndex++) {
      const range = soup.meshRanges[meshIndex]
      const size = textureSizeFor(soup, range, texelsPerMeter, maxTexels)
      if (size === 0) {
        throw new RangeError(`LightBaker: mesh #${meshIndex} has no usable lightmap UV area`)
      }
      const grid = rasterizeMesh(soup, range, size)
      const data = new Float32Array(size * size * CHANNELS)
      const shader = new Shader({
        soup, intersector, albedo, sunDirection, sunColor: this.sunColor, sunIntensity,
        sky: this.sky, samples, random: makeRandom(seed, meshIndex),
      })

      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          const texel = j * size + i
          if (!grid.covered[texel]) continue
          shader.shade(
            grid.positions[texel * 3], grid.positions[texel * 3 + 1], grid.positions[texel * 3 + 2],
            grid.triangles[texel], data, texel * CHANNELS,
          )
        }
        yield { meshIndex, meshCount: this.meshes.length, rowsDone: j + 1, rowsTotal: size }
      }
      dilate(data, grid.covered, size, size)

      const texture = new DataTexture(data, size, size, RGBAFormat, FloatType)
      texture.minFilter = LinearFilter
      texture.magFilter = LinearFilter
      texture.generateMipmaps = false
      texture.needsUpdate = true
      result.set(this.meshes[meshIndex], texture)
    }
    return result
  }
}
