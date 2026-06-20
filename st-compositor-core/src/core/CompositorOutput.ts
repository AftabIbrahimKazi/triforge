import {
  WebGLRenderer, Scene, Camera, Vector2,
  WebGLRenderTarget, LinearFilter, RGBAFormat, HalfFloatType,
} from 'three'
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass }      from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass }      from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { FilmPass }        from 'three/examples/jsm/postprocessing/FilmPass.js'
import { BokehPass }       from 'three/examples/jsm/postprocessing/BokehPass.js'
import { SSAOPass }        from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { SSRPass }         from 'three/examples/jsm/postprocessing/SSRPass.js'
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
      this._composer = this._compileThree()
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

  private _compileThree(): ComposerLike {
    const activePasses = this._passes.filter(p => p.enabled)

    // Registry built from static imports — compatible with Vite, Webpack, Rollup, esbuild
    const registry: PassRegistry = {
      ShaderPass,
      UnrealBloomPass,
      FilmPass,
      BokehPass,
      SSAOPass,
      SSRPass,
      RenderPass,
    }

    const size = new Vector2()
    this._renderer.getSize(size)

    const target = new WebGLRenderTarget(size.x, size.y, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format:    RGBAFormat,
      type:      HalfFloatType,
    })

    const composer = new EffectComposer(this._renderer, target)
    const addPass  = (p: unknown) =>
      (composer as unknown as { addPass(x: unknown): void }).addPass(p)

    addPass(new RenderPass(this._scene, this._camera))

    ;(registry as Record<string, unknown>)['_renderer'] = this._renderer
    ;(registry as Record<string, unknown>)['_scene']    = this._scene
    ;(registry as Record<string, unknown>)['_camera']   = this._camera

    for (const pass of activePasses) {
      const built = pass._buildThree(size.x, size.y, registry)
      if (built !== null) addPass(built)
    }

    // Required since Three.js r152 to write to screen correctly
    addPass(new OutputPass())

    return composer
  }

  // ── pmndrs backend ────────────────────────────────────────────────────────

  private async _compilePmndrs(): Promise<ComposerLike> {
    let pkg: Record<string, unknown>

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pkg = await (Function('m', 'return import(m)') as (m: string) => Promise<any>)('postprocessing') as Record<string, unknown>
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
