import type { CompositorBackend } from './CompositorBackend.js'

/**
 * Registry resolved by CompositorOutput at compile time.
 * Contains three/addons or pmndrs constructors keyed by class name,
 * plus injected scene/camera under '_scene' and '_camera'.
 */
export type PassRegistry = Record<string, unknown>

/**
 * Base class for all compositor pass nodes.
 *
 * Each subclass represents one Blender compositor node equivalent.
 * Subclasses implement _buildThree() and optionally _buildPmndrs().
 *
 * All scalar inputs live in the public `parameters` object so they are
 * reachable by GSAP / st-keyframe.
 */
export abstract class BasePass {
  abstract readonly passType: string

  /** All scalar inputs — GSAP-animatable. */
  abstract parameters: Record<string, number>

  /** Whether this pass is active. Inactive passes are skipped during compile. */
  enabled = true

  /**
   * Build a Three.js pass object.
   * Called by CompositorOutput with the resolved three/addons constructors.
   * @param width  Render target width
   * @param height Render target height
   * @param reg    Resolved three/addons constructors (e.g. { UnrealBloomPass, ... })
   */
  abstract _buildThree(width: number, height: number, reg: PassRegistry): unknown

  /**
   * Build a pmndrs/postprocessing Effect or Pass.
   * Override in subclasses that support the pmndrs backend.
   * Default throws a clear error.
   * @param reg  Resolved postprocessing constructors
   */
  _buildPmndrs(_reg: PassRegistry): unknown {
    throw new Error(
      `${this.passType}: pmndrs backend is not supported for this pass. ` +
      `Use backend: 'three' or choose a pass that supports pmndrs.`
    )
  }

  /**
   * True when _buildPmndrs() returns a pmndrs Effect (merged into EffectPass).
   * False when it returns a standalone Pass added directly to the composer.
   */
  get _isPmndrsEffect(): boolean { return false }

  /**
   * Names of three/addons postprocessing module files this pass needs loaded.
   * e.g. ['UnrealBloomPass', 'ShaderPass']
   * CompositorOutput reads this to pre-load the registry before calling _buildThree().
   */
  _threePassDeps(): string[] { return [] }
}
