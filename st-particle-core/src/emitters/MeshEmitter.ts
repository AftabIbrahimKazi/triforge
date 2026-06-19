import { Vector3, BufferGeometry, Texture } from 'three'
import { BaseEmitter, BaseEmitterOptions } from '../core/BaseEmitter.js'
import type { Particle }     from '../core/Particle.js'
import type { SeededRandom } from '../core/SeededRandom.js'

export interface MeshEmitterOptions extends BaseEmitterOptions {
  /**
   * Name of a Float32BufferAttribute (values in [0, 1] per vertex) that
   * drives emission density — like Blender's Source → Vertex Group → Density.
   * Stored as a string, NOT in parameters, because strings are not
   * GSAP-animatable. Use weightStrength (in parameters) to blend.
   */
  weightAttribute?: string
  /**
   * Name of a Float32BufferAttribute (values in [0, 1] per vertex) that
   * scales particle size at spawn — like Blender's Source → Vertex Group → Size.
   * Use sizeStrength (in parameters) to blend between no effect and full effect.
   */
  sizeAttribute?: string
  /** 0–1 blend: 0 = no size attribute effect, 1 = full effect. Default 1. */
  sizeStrength?: number
}

/**
 * MeshEmitter — emits particles from the surface of a BufferGeometry.
 *
 * Emit From modes (Blender: Emit From):
 *   verts  — spawn at a random vertex position
 *   faces  — spawn at a random point on a random triangle face
 *   volume — spawn at a random point inside the mesh bounding box
 *
 * Even Distribution (Blender: Even Distribution):
 *   false — pick a random face regardless of area
 *   true  — pick faces weighted by area so large faces emit more
 *
 * Source Vertex Groups (Blender: Source → Vertex Group → Density):
 *   Set weightAttribute to the name of a Float32BufferAttribute ([0,1]).
 *   Adjust weightStrength (parameters) to blend from uniform to full weighting.
 *
 * Also reads the `foam` Float32BufferAttribute if present —
 * used by OceanModifier geometry to weight emission toward wave crests.
 */
export class MeshEmitter extends BaseEmitter {
  private _faceCDF: Float32Array = new Float32Array(0)  // cumulative area for weighted sampling
  private _geoVersion = -1

  /**
   * Name of the per-vertex Float32BufferAttribute used as emission density weights.
   * Not in parameters — strings are not GSAP-animatable.
   */
  weightAttribute: string | null = null

  /**
   * Name of the per-vertex Float32BufferAttribute used to scale particle size at spawn.
   * Not in parameters — strings are not GSAP-animatable.
   */
  sizeAttribute: string | null = null

  /**
   * THREE.Texture whose red channel drives emission density (UV-sampled per face).
   * Not in parameters — object references are not GSAP-animatable.
   * When set, red channel value at each face's UV centroid is used as a per-face weight.
   * null = uniform (or weightAttribute-only) distribution.
   */
  densityTexture: Texture | null = null

  private _lastWeightAttribute: string | null = null
  private _lastDensityTexture:  Texture | null = null

  constructor(opts: MeshEmitterOptions = {}) {
    super(opts)
    this.parameters.weightStrength = 1
    this.parameters.sizeStrength   = opts.sizeStrength ?? 1
    this.weightAttribute = opts.weightAttribute ?? null
    this.sizeAttribute   = opts.sizeAttribute   ?? null
  }

  spawn(particle: Particle, geometry: BufferGeometry | null, rng: SeededRandom): void {
    if (!geometry) return

    const mode = this.parameters.emitFrom  // 0=verts, 1=faces, 2=volume

    if (mode === 0) {
      this._spawnFromVert(particle, geometry, rng)
    } else if (mode === 1) {
      this._spawnFromFace(particle, geometry, rng)
    } else {
      this._spawnFromVolume(particle, geometry, rng)
    }
  }

  private _spawnFromVert(particle: Particle, geo: BufferGeometry, rng: SeededRandom): void {
    const pos  = geo.getAttribute('position')
    const norm = geo.getAttribute('normal')
    if (!pos) return

    const idx = Math.floor(rng.next() * pos.count)
    particle.position.fromBufferAttribute(pos, idx)

    const normal  = norm ? new Vector3().fromBufferAttribute(norm, idx).normalize() : new Vector3(0, 1, 0)
    const tangent = this._makeTangent(normal)
    this.applyVelocity(particle, normal, tangent, rng)
    this._applySizeAttribute(particle, geo, idx, idx, idx, 0, 0, 1)
  }

  private _spawnFromFace(particle: Particle, geo: BufferGeometry, rng: SeededRandom): void {
    const pos  = geo.getAttribute('position')
    const norm = geo.getAttribute('normal')
    const idx  = geo.getIndex()
    if (!pos) return

    let triCount: number
    let getTriVerts: (i: number) => [number, number, number]

    if (idx) {
      triCount = Math.floor(idx.count / 3)
      getTriVerts = (i) => [idx.getX(i * 3), idx.getX(i * 3 + 1), idx.getX(i * 3 + 2)]
    } else {
      triCount = Math.floor(pos.count / 3)
      getTriVerts = (i) => [i * 3, i * 3 + 1, i * 3 + 2]
    }

    if (triCount === 0) return

    const evenDist = this.parameters.evenDistribution > 0
    let triIndex: number

    if (evenDist) {
      // Rebuild CDF if geometry or texture/weight inputs changed
      const weightAttr = this.weightAttribute
      if (
        this._faceCDF.length !== triCount ||
        weightAttr !== this._lastWeightAttribute ||
        this.densityTexture !== this._lastDensityTexture
      ) {
        const weightBuf = weightAttr ? geo.getAttribute(weightAttr) : null
        const uvBuf     = this.densityTexture ? geo.getAttribute('uv') : null
        this._buildCDF(pos, triCount, getTriVerts, weightBuf ?? undefined, uvBuf ?? undefined)
        this._lastWeightAttribute = weightAttr
        this._lastDensityTexture  = this.densityTexture
      }
      triIndex = this._sampleCDF(rng.next())
    } else {
      triIndex = Math.floor(rng.next() * triCount)
    }

    const [a, b, c] = getTriVerts(triIndex)

    const vA = new Vector3().fromBufferAttribute(pos, a)
    const vB = new Vector3().fromBufferAttribute(pos, b)
    const vC = new Vector3().fromBufferAttribute(pos, c)

    // Uniform random point on triangle (barycentric)
    let r1 = rng.next(), r2 = rng.next()
    if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2 }
    particle.position
      .copy(vA)
      .addScaledVector(vB.sub(vA), r1)
      .addScaledVector(vC.sub(new Vector3().fromBufferAttribute(pos, a)), r2)

    const normal = norm
      ? new Vector3().fromBufferAttribute(norm, a).normalize()
      : new Vector3().crossVectors(
          new Vector3().fromBufferAttribute(pos, b).sub(new Vector3().fromBufferAttribute(pos, a)),
          new Vector3().fromBufferAttribute(pos, c).sub(new Vector3().fromBufferAttribute(pos, a)),
        ).normalize()

    const tangent = this._makeTangent(normal)
    this.applyVelocity(particle, normal, tangent, rng)
    this._applySizeAttribute(particle, geo, a, b, c, r1, r2, 1 - r1 - r2)
  }

  private _spawnFromVolume(particle: Particle, geo: BufferGeometry, rng: SeededRandom): void {
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    particle.position.set(
      rng.range(bb.min.x, bb.max.x),
      rng.range(bb.min.y, bb.max.y),
      rng.range(bb.min.z, bb.max.z),
    )
    const normal  = new Vector3(0, 1, 0)
    const tangent = new Vector3(1, 0, 0)
    this.applyVelocity(particle, normal, tangent, rng)
  }

  private _buildCDF(
    pos: ReturnType<BufferGeometry['getAttribute']>,
    triCount: number,
    getTriVerts: (i: number) => [number, number, number],
    weightBuf?: ReturnType<BufferGeometry['getAttribute']>,
    uvBuf?:     ReturnType<BufferGeometry['getAttribute']>,
  ): void {
    this._faceCDF = new Float32Array(triCount)
    let total = 0
    const vA = new Vector3(), vB = new Vector3(), vC = new Vector3()
    const strength = this.parameters.weightStrength

    for (let i = 0; i < triCount; i++) {
      const [a, b, c] = getTriVerts(i)
      vA.fromBufferAttribute(pos, a)
      vB.fromBufferAttribute(pos, b)
      vC.fromBufferAttribute(pos, c)
      const area = vB.sub(vA).cross(vC.sub(vA)).length() * 0.5

      let weight = 1

      if (weightBuf && strength > 0) {
        const avgW = (weightBuf.getX(a) + weightBuf.getX(b) + weightBuf.getX(c)) / 3
        weight = 1 - strength + strength * avgW
      }

      if (this.densityTexture && uvBuf) {
        const u = (uvBuf.getX(a) + uvBuf.getX(b) + uvBuf.getX(c)) / 3
        const v = (uvBuf.getY(a) + uvBuf.getY(b) + uvBuf.getY(c)) / 3
        weight *= this._sampleTexture(u, v)
      }

      total += area * weight
      this._faceCDF[i] = total
    }
    if (total > 0) {
      for (let i = 0; i < triCount; i++) this._faceCDF[i] /= total
    }
  }

  /**
   * Sample the red channel of densityTexture at normalised UV (u,v).
   * Returns a value in [0, 1]. Falls back to 1.0 if the texture has no
   * readable image data.
   */
  private _sampleTexture(u: number, v: number): number {
    const tex = this.densityTexture
    if (!tex) return 1.0

    const img = tex.image as Record<string, unknown> | null | undefined
    if (!img) return 1.0

    // DataTexture / ImageData: has data (TypedArray), width, height
    const data   = img['data'] as (Uint8Array | Uint8ClampedArray | Float32Array) | undefined
    const width  = img['width']  as number | undefined
    const height = img['height'] as number | undefined

    if (data && width && height) {
      const x = Math.max(0, Math.min(width  - 1, Math.floor(u * width)))
      const y = Math.max(0, Math.min(height - 1, Math.floor((1 - v) * height)))
      const idx = (y * width + x) * 4   // RGBA
      if (data instanceof Float32Array) {
        return Math.max(0, Math.min(1, data[idx]))
      }
      return data[idx] / 255
    }

    // HTMLCanvasElement
    if (typeof (img as { getContext?: unknown })['getContext'] === 'function') {
      const canvas = img as unknown as HTMLCanvasElement
      const ctx    = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        const x  = Math.max(0, Math.min(canvas.width  - 1, Math.floor(u * canvas.width)))
        const y  = Math.max(0, Math.min(canvas.height - 1, Math.floor((1 - v) * canvas.height)))
        const px = ctx.getImageData(x, y, 1, 1).data
        return px[0] / 255
      }
    }

    return 1.0
  }

  private _sampleCDF(r: number): number {
    let lo = 0, hi = this._faceCDF.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this._faceCDF[mid] < r) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /**
   * Apply the sizeAttribute multiplier to particle.size at spawn time.
   * a/b/c are vertex indices; w0/w1/w2 are barycentric weights (must sum to 1).
   */
  private _applySizeAttribute(
    particle: Particle,
    geo:      BufferGeometry,
    a: number, b: number, c: number,
    w0: number, w1: number, w2: number,
  ): void {
    if (!this.sizeAttribute) return
    const attr = geo.getAttribute(this.sizeAttribute)
    if (!attr) return
    const strength = this.parameters.sizeStrength
    const sampled  = attr.getX(a) * w0 + attr.getX(b) * w1 + attr.getX(c) * w2
    particle.size *= 1 - strength + strength * sampled
  }

  private _makeTangent(normal: Vector3): Vector3 {
    const up = Math.abs(normal.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
    return new Vector3().crossVectors(normal, up).normalize()
  }
}
