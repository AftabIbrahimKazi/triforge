import { WebGLRenderer, Scene, Camera, PCFSoftShadowMap, ACESFilmicToneMapping, ShaderMaterial } from 'three'
import { PathTracerRenderer, PathTracerRendererOptions } from './PathTracerRenderer.js'
import { LightPathController } from './LightPathController.js'

export type RenderMode = 'raster' | 'pathtracer'

export interface RenderManagerOptions extends PathTracerRendererOptions {
  /** Initial render mode (default 'raster') */
  mode?: RenderMode
}

export type ModeChangeCallback = (mode: RenderMode, samples: number) => void

/**
 * RenderManager — single entry point for raster ↔ path-tracer toggle.
 *
 * @example
 * const manager = new RenderManager(renderer, scene, camera)
 * await manager.init()
 *
 * // Toggle anytime
 * manager.setMode('pathtracer')
 * manager.setMode('raster')
 *
 * // In animation loop — replaces renderer.render()
 * manager.render()
 *
 * // Optional: listen for mode/sample changes
 * manager.onModeChange = (mode, samples) => updateUI(mode, samples)
 */
export class RenderManager {
  readonly renderer: WebGLRenderer
  readonly scene:    Scene
  readonly camera:   Camera

  private _mode: RenderMode
  private _pt:   PathTracerRenderer
  private _initialized = false

  /** LightPath multi-pass controller. Register materials with it to drive LightPath uniforms. */
  readonly lightPath: LightPathController

  /** Called each frame with current mode and accumulated sample count */
  onModeChange: ModeChangeCallback | null = null

  constructor(
    renderer: WebGLRenderer,
    scene:    Scene,
    camera:   Camera,
    options:  RenderManagerOptions = {},
  ) {
    this.renderer  = renderer
    this.scene     = scene
    this.camera    = camera
    this._mode     = options.mode ?? 'raster'
    this._pt       = new PathTracerRenderer(renderer, options)
    this.lightPath = new LightPathController(renderer)

    // Ensure renderer is set up for quality rasterization
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type    = PCFSoftShadowMap
    renderer.toneMapping       = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
  }

  get mode():    RenderMode { return this._mode }
  get pathTracer(): PathTracerRenderer { return this._pt }

  /**
   * Must be called once before first render in path-tracer mode.
   * Builds the scene BVH — async, but safe to call upfront.
   */
  async init(): Promise<void> {
    await this._pt.setScene(this.scene, this.camera)
    this._initialized = true
  }

  /**
   * Switch between 'raster' and 'pathtracer'.
   * Switching to pathtracer initializes if not already done.
   */
  async setMode(mode: RenderMode): Promise<void> {
    if (this._mode === mode) return
    this._mode = mode
    if (mode === 'pathtracer' && !this._initialized) {
      await this._pt.setScene(this.scene, this.camera)
      this._initialized = true
    }
    if (mode === 'pathtracer') {
      this._pt.reset()
    }
    this.onModeChange?.(mode, 0)
  }

  /**
   * Register a compiled ShaderMaterial (from st-shader-core) that uses the
   * LightPath node. The LightPathController will drive its uniforms each frame.
   *
   * @example
   * const mat = myMaterialOutput.compile()
   * manager.registerLightPathMaterial(mat)
   * manager.render() // now drives LightPath uniforms each frame
   */
  registerLightPathMaterial(mat: ShaderMaterial): void {
    this.lightPath.registerMaterial(mat)
  }

  /**
   * Call each frame instead of renderer.render().
   * In raster mode: runs LightPath multi-pass render if any materials are registered,
   *   otherwise standard renderer.render().
   * In pathtracer mode: path-tracer sample accumulation.
   */
  render(): void {
    if (this._mode === 'pathtracer' && this._initialized) {
      const samples = this._pt.render()
      this.onModeChange?.(this._mode, samples)
    } else {
      this.lightPath.render(this.scene, this.camera)
    }
  }

  /**
   * Call after changing scene geometry or materials so the path tracer
   * rebuilds its BVH and resets accumulation.
   */
  async rebuildScene(): Promise<void> {
    await this._pt.setScene(this.scene, this.camera)
    this._initialized = true
  }

  /** Returns 0 in raster mode, 1 when path tracer is active. */
  getLightPathMode(): 0 | 1 {
    return this._mode === 'pathtracer' ? 1 : 0
  }

  dispose(): void {
    this._pt.dispose()
  }
}
