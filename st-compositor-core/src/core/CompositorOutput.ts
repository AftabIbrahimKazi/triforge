import {
  WebGLRenderer, Scene, Camera, Vector2,
  WebGLRenderTarget, LinearFilter, RGBAFormat, HalfFloatType,
} from 'three'
import type { BasePass, PassRegistry } from './BasePass.js'
import type { CompositorBackend }      from './CompositorBackend.js'

export interface CompositorOutputOptions {
  /**
   * Post-processing backend.
   * 'three'  (default) — three/addons EffectComposer, no extra install needed.
   * 'pmndrs'           — pmndrs/postprocessing. Run: npm install postprocessing
   */
  backend?:  CompositorBackend
  renderer:  WebGLRenderer
  scene:     Scene
  camera:    Camera
}

/**
 * CompositorOutput — terminal node of the compositor graph.
 *
 * Equivalent to Blender's Compositor → Composite node.
 * Collects all passes, compiles them into an EffectComposer,
 * and exposes render() which replaces renderer.render() in the loop.
 *
 * Backend is 'three' by default. To use pmndrs/postprocessing:
 *   const comp = new CompositorOutput({ backend: 'pmndrs', renderer, scene, camera })
 *   // requires: npm install postprocessing
 *
 * Usage:
 *   const comp = new CompositorOutput({ renderer, scene, camera })
 *   comp.add(new Bloom({ strength: 1.2 }))
 *      .add(new ChromaticAberration({ offset: 0.002 }))
 *   await comp.compile()
 *
 *   // In animation loop — replaces renderer.render(scene, camera)
 *   comp.render()
 *
 *   // On resize
 *   comp.setSize(innerWidth, innerHeight)
 */
export class CompositorOutput {
  readonly backend: CompositorBackend

  private _renderer: WebGLRenderer
  private _scene:    Scene
  private _camera:   Camera
  private _passes:   BasePass[] = []
  private _composer: ComposerLike | null = null
  private _compiled  = false

  constructor(opts: CompositorOutputOptions) {
    this.backend   = opts.backend ?? 'three'
    this._renderer = opts.renderer
    this._scene    = opts.scene
    this._camera   = opts.camera
  }

  /** Add a pass node. Chainable. Resets compiled state. */
  add(pass: BasePass): this {
    this._passes.push(pass)
    this._compiled = false
    return this
  }

  /** Remove a pass node. Chainable. Resets compiled state. */
  remove(pass: BasePass): this {
    this._passes = this._passes.filter(p => p !== pass)
    this._compiled = false
    return this
  }

  /** All currently registered passes (read-only view). */
  get passes(): readonly BasePass[] { return this._passes }

  /** Whether compile() has been called successfully. */
  get isCompiled(): boolean { return this._compiled }

  /**
   * Compile the pass chain into an EffectComposer.
   * Must be called once before render(). Re-call after adding/removing passes.
   */
  async compile(): Promise<void> {
    this._composer?.dispose()
    this._composer = null
    this._compiled = false

    if (this.backend === 'pmndrs') {
      this._composer = await this._compilePmndrs()
    } else {
      this._composer = await this._compileThree()
    }

    this._compiled = true
  }

  /**
   * Render one frame through the compositor chain.
   * Replaces renderer.render(scene, camera) in the animation loop.
   * Falls back to plain render if compile() has not been called.
   */
  render(): void {
    if (this._compiled && this._composer) {
      this._composer.render()
    } else {
      this._renderer.render(this._scene, this._camera)
    }
  }

  /** Call on window resize to keep the render target in sync. */
  setSize(width: number, height: number): void {
    this._renderer.setSize(width, height)
    this._composer?.setSize(width, height)
  }

  dispose(): void {
    this._composer?.dispose()
    this._composer = null
    this._compiled = false
  }

  // ── Three.js backend ──────────────────────────────────────────────────────

  private async _compileThree(): Promise<ComposerLike> {
    // Dynamically import three/addons so this package has no hard dependency
    // on a specific addons path — works with CDN importmap and npm alike.
    let EC:         new (r: WebGLRenderer, t?: WebGLRenderTarget) => ComposerLike
    let RenderPass: new (s: Scene, c: Camera) => unknown
    let OutputPass: new () => unknown

    try {
      const [ecMod, rpMod, opMod] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js' as string),
        import('three/addons/postprocessing/RenderPass.js'     as string),
        import('three/addons/postprocessing/OutputPass.js'     as string),
      ])
      EC         = (ecMod as Record<string, unknown>)['EffectComposer'] as typeof EC
      RenderPass = (rpMod as Record<string, unknown>)['RenderPass']     as typeof RenderPass
      OutputPass = (opMod as Record<string, unknown>)['OutputPass']     as typeof OutputPass
    } catch {
      throw new Error(
        '@st-compositor-core: Could not load three/addons postprocessing modules.\n' +
        'Make sure "three/addons/" is in your importmap or install three with examples/jsm.\n' +
        'Example importmap entry:\n' +
        '  "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"'
      )
    }

    const activePasses = this._passes.filter(p => p.enabled)

    // Load all required per-pass three/addons modules into one registry object
    const registry = await this._loadThreePassModules(activePasses)

    const size = new Vector2()
    this._renderer.getSize(size)

    const target = new WebGLRenderTarget(size.x, size.y, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format:    RGBAFormat,
      type:      HalfFloatType,
    })

    const composer = new EC(this._renderer, target)
    const addPass  = (p: unknown) =>
      (composer as unknown as { addPass(x: unknown): void }).addPass(p)

    // RenderPass first — renders the scene into the first buffer
    addPass(new RenderPass(this._scene, this._camera))

    // Inject renderer, scene, camera so passes (DepthOfField, SSAO, SSR) can access them
    ;(registry as Record<string, unknown>)['_renderer'] = this._renderer
    ;(registry as Record<string, unknown>)['_scene']    = this._scene
    ;(registry as Record<string, unknown>)['_camera']   = this._camera

    // User passes
    for (const pass of activePasses) {
      const built = pass._buildThree(size.x, size.y, registry)
      if (built !== null) addPass(built)
    }

    // OutputPass last — required since Three.js r152 to write to screen correctly
    addPass(new OutputPass())

    return composer
  }

  private async _loadThreePassModules(passes: BasePass[]): Promise<PassRegistry> {
    const registry: PassRegistry = {}
    const needed = new Set<string>()

    for (const pass of passes) {
      for (const dep of pass._threePassDeps()) {
        needed.add(dep)
      }
    }

    await Promise.all(
      [...needed].map(async dep => {
        try {
          const mod = await import(
            `three/addons/postprocessing/${dep}.js` as string
          ) as Record<string, unknown>
          Object.assign(registry, mod)
        } catch {
          // Pass will throw its own clear error in _buildThree() if dep is missing
        }
      })
    )

    return registry
  }

  // ── pmndrs backend ────────────────────────────────────────────────────────

  private async _compilePmndrs(): Promise<ComposerLike> {
    let pkg: Record<string, unknown>

    try {
      pkg = await import('postprocessing' as string) as Record<string, unknown>
    } catch {
      throw new Error(
        '@st-compositor-core: backend "pmndrs" requires the "postprocessing" package.\n' +
        'Run: npm install postprocessing'
      )
    }

    const EC         = pkg['EffectComposer'] as new (r: WebGLRenderer) => ComposerLike
    const RenderPass = pkg['RenderPass']     as new (s: Scene, c: Camera) => unknown
    const EffectPass = pkg['EffectPass']     as new (c: Camera, ...e: unknown[]) => unknown

    const composer = new EC(this._renderer)
    const addPass  = (p: unknown) =>
      (composer as unknown as { addPass(x: unknown): void }).addPass(p)

    addPass(new RenderPass(this._scene, this._camera))

    const activePasses = this._passes.filter(p => p.enabled)
    const effects:    unknown[] = []
    const standalone: unknown[] = []

    for (const pass of activePasses) {
      // Inject camera into registry so passes that need it (e.g. DepthOfField) can access it
      const reg: PassRegistry & { _camera?: Camera; _scene?: Scene } = {
        ...pkg as PassRegistry,
        _camera: this._camera,
        _scene:  this._scene,
      }
      const built = pass._buildPmndrs(reg)
      if (pass._isPmndrsEffect) {
        effects.push(built)
      } else {
        standalone.push(built)
      }
    }

    if (effects.length > 0) {
      addPass(new EffectPass(this._camera, ...effects))
    }
    for (const sp of standalone) addPass(sp)

    return composer
  }
}

// ── Internal interface ────────────────────────────────────────────────────────

interface ComposerLike {
  render():                      void
  setSize(w: number, h: number): void
  dispose():                     void
}
