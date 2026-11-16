import { WebGLRenderer, Scene, Camera, Vector3 } from 'three'
import { WebGLPathTracer } from 'three-gpu-pathtracer'

/** Settings that turn off the interactive raster fallback so every frame is pure path tracing. */
export interface OfflineModeTarget {
  renderDelay: number
  minSamples: number
  fadeDuration: number
  rasterizeScene: boolean
}

/**
 * Configure a path tracer for deterministic offline capture: no render delay,
 * no minimum-sample gate, no fade and no raster fallback.
 */
export function applyOfflineMode(target: OfflineModeTarget): void {
  target.renderDelay = 0
  target.minSamples = 0
  target.fadeDuration = 0
  target.rasterizeScene = false
}

export interface PathTracerRendererOptions {
  /**
   * Pure path-traced output with no raster fallback, delay or fade, for offline
   * captures and tests (default false). While the shader compiles, render() returns 0
   * and nothing is drawn; check `ready` and `compiling`.
   */
  offlineMode?: boolean
  /** Samples accumulated per frame while camera is still (default 1) */
  samplesPerFrame?: number
  /** Stop accumulating after this many total samples (default 512) */
  maxSamples?: number
}

/**
 * Wraps three-gpu-pathtracer's WebGLPathTracer with:
 * - Auto camera-change detection → resets accumulation
 * - Max-samples cap to avoid burning the GPU when fully converged
 * - Progressive sample counter exposed on .samples
 */
export class PathTracerRenderer {
  readonly pathTracer: WebGLPathTracer

  parameters: {
    samplesPerFrame: number
    maxSamples: number
  }

  private _scene:  Scene  | null = null
  private _camera: Camera | null = null
  private _lastCamPos = new Vector3()
  private _lastCamTarget = new Vector3()
  private _ready = false

  constructor(renderer: WebGLRenderer, options: PathTracerRendererOptions = {}) {
    this.pathTracer = new WebGLPathTracer(renderer)
    this.pathTracer.physicallyCorrectLights = true
    if (options.offlineMode) applyOfflineMode(this.pathTracer)
    this.parameters = {
      samplesPerFrame: options.samplesPerFrame ?? 1,
      maxSamples:      options.maxSamples      ?? 512,
    }
  }

  /** Call once (or whenever scene changes). Async — builds BVH internally. */
  async setScene(scene: Scene, camera: Camera): Promise<void> {
    this._scene  = scene
    this._camera = camera
    this._ready  = false
    await this.pathTracer.setScene(scene, camera)
    this._ready = true
    this._snapshotCamera()
  }

  /**
   * Call each frame instead of renderer.render().
   * Returns the current accumulated sample count, or 0 if not ready.
   */
  render(): number {
    if (!this._ready || !this._camera) return 0
    if (this._cameraChanged()) {
      this.pathTracer.updateCamera()
      this._snapshotCamera()
    }
    if (this.pathTracer.samples >= this.parameters.maxSamples) return this.pathTracer.samples
    this.pathTracer.samplesPerFrame = this.parameters.samplesPerFrame
    this.pathTracer.renderSample()
    return this.pathTracer.samples
  }

  /** Force a full reset — call after changing scene geometry or materials */
  reset(): void {
    this.pathTracer.reset()
  }

  get samples(): number { return this.pathTracer.samples }
  get ready():   boolean { return this._ready }
  get compiling(): boolean { return this.pathTracer.isCompiling }

  dispose(): void {
    this.pathTracer.dispose()
  }

  private _cameraChanged(): boolean {
    if (!this._camera) return false
    const pos = this._camera.position
    if (!pos.equals(this._lastCamPos)) return true
    return false
  }

  private _snapshotCamera(): void {
    if (this._camera) this._lastCamPos.copy(this._camera.position)
  }
}
