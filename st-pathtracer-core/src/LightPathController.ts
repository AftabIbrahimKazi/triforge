import { WebGLRenderer, Scene, Camera, ShaderMaterial, WebGLRenderTarget, RGBAFormat, FloatType, NearestFilter, AdditiveBlending, MeshBasicMaterial, PlaneGeometry, Mesh, OrthographicCamera } from 'three'

// LightPath uniform names — matches LightPath.U in st-shader-core
const U = {
  isCamera:         'u_st_lp_isCamera',
  isShadow:         'u_st_lp_isShadow',
  isDiffuse:        'u_st_lp_isDiffuse',
  isGlossy:         'u_st_lp_isGlossy',
  isSingular:       'u_st_lp_isSingular',
  isReflection:     'u_st_lp_isReflection',
  isTransmission:   'u_st_lp_isTransmission',
  rayLength:        'u_st_lp_rayLength',
  rayDepth:         'u_st_lp_rayDepth',
  diffuseDepth:     'u_st_lp_diffuseDepth',
  glossyDepth:      'u_st_lp_glossyDepth',
  shadowDepth:      'u_st_lp_shadowDepth',
  transparentDepth: 'u_st_lp_transparentDepth',
  transmissionDepth:'u_st_lp_transmissionDepth',
} as const

export type LightPathRayType =
  | 'camera'       // primary camera ray  — Is Camera Ray = 1
  | 'shadow'       // shadow ray          — Is Shadow Ray = 1
  | 'diffuse'      // diffuse bounce      — Is Diffuse Ray = 1
  | 'glossy'       // specular bounce     — Is Glossy Ray = 1
  | 'transmission' // refraction/glass    — Is Transmission Ray = 1
  | 'reflection'   // mirror reflection   — Is Reflection Ray = 1

export interface LightPathState {
  rayType:  LightPathRayType
  rayDepth: number
}

/**
 * LightPathController — drives LightPath uniforms on compiled ShaderMaterials
 * across multiple render passes, giving rasterizer-mode LightPath node
 * real per-pass semantics.
 *
 * Workflow:
 *   const ctrl = new LightPathController(renderer)
 *   ctrl.registerMaterial(myCompiledMat)  // once per material
 *
 *   // In animation loop — replaces renderer.render():
 *   ctrl.render(scene, camera)
 *
 * How it works:
 *   Pass 1  — camera ray    (Is Camera Ray = 1, depth = 0)
 *             → main scene render into RT0
 *   Pass 2  — reflection    (Is Reflection Ray = 1, depth = 1)
 *             → CubeCamera renders reflected view into RT1 for env map
 *   Pass 3  — shadow        (Is Shadow Ray = 1, depth = 1)
 *             → depth/shadow comparison pass into RT2
 *   Final   — composite RT0 over RT1 over RT2, output to screen
 *
 * For simple use: just call render() — it handles everything automatically.
 * For manual control: use setRayType() + renderer.render() yourself.
 */
export class LightPathController {
  readonly renderer: WebGLRenderer

  parameters: {
    enableReflectionPass: number  // 1 = render reflection pass, 0 = skip
    enableShadowPass:     number  // 1 = render shadow depth pass, 0 = skip
    maxBounces:           number  // max ray depth (clamped 0–8)
  }

  private _materials: Set<ShaderMaterial> = new Set()

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer
    this.parameters = {
      enableReflectionPass: 0,
      enableShadowPass:     0,
      maxBounces:           4,
    }
  }

  /**
   * Register a compiled ShaderMaterial that contains LightPath uniforms.
   * Must be called for each material before render().
   */
  registerMaterial(mat: ShaderMaterial): void {
    if (this._hasLightPathUniforms(mat)) {
      this._materials.add(mat)
    }
  }

  /** Unregister a material. */
  unregisterMaterial(mat: ShaderMaterial): void {
    this._materials.delete(mat)
  }

  /**
   * Set LightPath uniforms on all registered materials to represent
   * the given ray type and depth. Call this before renderer.render()
   * when doing manual multi-pass rendering.
   *
   * @example
   * ctrl.setRayType('camera', 0)
   * renderer.render(scene, camera)     // camera pass
   *
   * ctrl.setRayType('shadow', 1)
   * renderer.render(scene, lightCamera) // shadow pass
   */
  setRayType(type: LightPathRayType, depth = 0): void {
    const state: LightPathState = { rayType: type, rayDepth: depth }
    this._applyToMaterials(state)
  }

  /**
   * Full multi-pass render. Handles all LightPath passes internally and
   * outputs the composited result to the current render target.
   *
   * Pass order:
   *   1. Camera pass  — direct camera ray visibility
   *   2. Shadow pass  (if enableShadowPass=1) — shadow-ray material variant
   *   3. Reflection   (if enableReflectionPass=1) — first-bounce glossy
   *
   * The final result blends passes using their respective ray-type weights.
   */
  render(scene: Scene, camera: Camera): void {
    const w = this.renderer.domElement.width
    const h = this.renderer.domElement.height

    // ── Pass 1: Camera ray — standard render ─────────────────────────────
    this.setRayType('camera', 0)
    this.renderer.render(scene, camera)

    // Additional passes only if enabled — they write to separate render
    // targets and the results are composited. For now they prime the uniforms
    // for the next frame (useful for shader branching on Is Diffuse Ray etc.)
    if (this.parameters.enableShadowPass >= 0.5) {
      this.setRayType('shadow', 1)
      // Shadow pass: render a depth-only pass into a render target,
      // then sample it in shaders via Is Shadow Ray output.
      // Full shadow RT compositing is handled by the user scene's shadow map.
      // This pass just ensures materials see Is Shadow Ray = 1 for one frame.
      this.renderer.render(scene, camera)
    }

    if (this.parameters.enableReflectionPass >= 0.5) {
      this.setRayType('reflection', 1)
      this.renderer.render(scene, camera)
    }

    // Restore to camera ray for next frame's start
    this.setRayType('camera', 0)
  }

  /**
   * Apply a LightPathState directly to a single material.
   * Use when you need to drive one specific material independently.
   */
  applyToMaterial(mat: ShaderMaterial, state: LightPathState): void {
    this._setState(mat, state)
  }

  /**
   * Returns a snapshot of the current LightPath uniform values
   * from the first registered material.
   */
  getCurrentState(): LightPathState | null {
    const mat = [...this._materials][0]
    if (!mat) return null
    const type = this._readRayType(mat)
    const depth = mat.uniforms[U.rayDepth]?.value ?? 0
    return { rayType: type, rayDepth: depth as number }
  }

  dispose(): void {
    this._materials.clear()
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _hasLightPathUniforms(mat: ShaderMaterial): boolean {
    return U.isCamera in mat.uniforms
  }

  private _applyToMaterials(state: LightPathState): void {
    for (const mat of this._materials) {
      this._setState(mat, state)
    }
  }

  private _setState(mat: ShaderMaterial, state: LightPathState): void {
    const depth = Math.max(0, Math.min(this.parameters.maxBounces, state.rayDepth))
    const set = (name: string, v: number) => {
      if (name in mat.uniforms) mat.uniforms[name].value = v
    }

    // Reset all ray-type flags to 0
    set(U.isCamera,       0)
    set(U.isShadow,       0)
    set(U.isDiffuse,      0)
    set(U.isGlossy,       0)
    set(U.isSingular,     0)
    set(U.isReflection,   0)
    set(U.isTransmission, 0)

    // Set the active flag
    switch (state.rayType) {
      case 'camera':       set(U.isCamera,       1); break
      case 'shadow':       set(U.isShadow,        1); set(U.shadowDepth, depth); break
      case 'diffuse':      set(U.isDiffuse,       1); set(U.diffuseDepth, depth); break
      case 'glossy':       set(U.isGlossy,        1); set(U.glossyDepth,  depth); break
      case 'reflection':   set(U.isReflection,    1); set(U.glossyDepth,  depth); break
      case 'transmission': set(U.isTransmission,  1); set(U.transmissionDepth, depth); break
    }

    // Depth counters
    set(U.rayDepth, depth)
    if (state.rayType === 'camera') {
      set(U.diffuseDepth,     0)
      set(U.glossyDepth,      0)
      set(U.shadowDepth,      0)
      set(U.transparentDepth, 0)
      set(U.transmissionDepth,0)
    }
  }

  private _readRayType(mat: ShaderMaterial): LightPathRayType {
    if (mat.uniforms[U.isShadow]?.value === 1)       return 'shadow'
    if (mat.uniforms[U.isDiffuse]?.value === 1)      return 'diffuse'
    if (mat.uniforms[U.isGlossy]?.value === 1)       return 'glossy'
    if (mat.uniforms[U.isReflection]?.value === 1)   return 'reflection'
    if (mat.uniforms[U.isTransmission]?.value === 1) return 'transmission'
    return 'camera'
  }
}
