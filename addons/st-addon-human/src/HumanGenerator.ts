import * as THREE from 'three'
import { DEFAULT_PARAMETERS, type HumanParameters } from './core/HumanParameters.js'
import { buildBodyGeometry, type BodyGeometryResult } from './geometry/BodyGeometry.js'
import { buildSkinMaterial, buildEyeMaterial } from './material/SkinMaterial.js'

type ShaderCoreModule = typeof import('@st-shader-core')

export interface HumanGeneratorOptions extends Partial<HumanParameters> {
  /**
   * Optional: pass the imported @st-shader-core module to enable node-based
   * skin shading (SubsurfaceScattering, Bump, PrincipledBSDF nodes).
   *
   * Without this the addon uses a built-in GLSL skin shader that only
   * requires Three.js.
   *
   * @example
   * // With @st-shader-core:
   * import * as ShaderCore from '@st-shader-core'
   * const human = new HumanGenerator({ shaderCore: ShaderCore })
   *
   * // Without — Three.js only:
   * const human = new HumanGenerator()
   */
  shaderCore?: ShaderCoreModule
}

/**
 * HumanGenerator — parametric human mesh.
 *
 * Works standalone with only Three.js.
 * Optionally accepts @st-shader-core for node-based skin shading.
 *
 * @example
 * const human = new HumanGenerator({ height: 1.80, gender: 0.2 })
 * scene.add(human.group)
 *
 * human.parameters.bmi = 0.6
 * human.update()
 */
export class HumanGenerator {
  /** Plain-object parameters — GSAP and st-keyframe animatable. */
  parameters: HumanParameters

  /** THREE.Group containing body + eye meshes. Add to scene. */
  readonly group: THREE.Group

  private _shaderCore: ShaderCoreModule | undefined
  private _bodyMesh: THREE.Mesh
  private _eyeMesh:  THREE.Mesh
  private _geo:      BodyGeometryResult | null = null
  private _skinMat:  THREE.ShaderMaterial | null = null
  private _eyeMat:   THREE.ShaderMaterial | null = null

  constructor(options: HumanGeneratorOptions = {}) {
    const { shaderCore, ...params } = options
    this.parameters  = { ...DEFAULT_PARAMETERS, ...params }
    this._shaderCore = shaderCore
    this.group       = new THREE.Group()
    this._bodyMesh   = new THREE.Mesh()
    this._eyeMesh    = new THREE.Mesh()
    this.group.add(this._bodyMesh, this._eyeMesh)
    this._build()
  }

  /** Rebuild from current parameters (or supply partial overrides). */
  update(params?: Partial<HumanParameters>): void {
    if (params) Object.assign(this.parameters, params)
    this._build()
  }

  /**
   * Switch between built-in GLSL and @st-shader-core node shading at runtime.
   * Pass the imported module to enable nodes, or undefined to revert to built-in.
   */
  setShaderCore(shaderCore: ShaderCoreModule | undefined): void {
    this._shaderCore = shaderCore
    this._buildMaterials()
  }

  /** World-space skeleton joint positions matching current proportions. */
  get skeleton(): BodyGeometryResult['skeleton'] | null {
    return this._geo?.skeleton ?? null
  }

  /** True when using @st-shader-core node-based shading. */
  get usingShaderCore(): boolean {
    return this._shaderCore !== undefined
  }

  toJSON(): HumanParameters {
    return { ...this.parameters }
  }

  fromJSON(data: Partial<HumanParameters>): void {
    Object.assign(this.parameters, data)
    this._build()
  }

  dispose(): void {
    this._bodyMesh.geometry?.dispose()
    this._eyeMesh.geometry?.dispose()
    this._skinMat?.dispose()
    this._eyeMat?.dispose()
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _build(): void {
    this._bodyMesh.geometry?.dispose()
    this._eyeMesh.geometry?.dispose()

    this._geo = buildBodyGeometry(this.parameters)
    this._bodyMesh.geometry = this._geo.body
    this._eyeMesh.geometry  = this._geo.eyes

    this._buildMaterials()

    this._bodyMesh.castShadow = this._bodyMesh.receiveShadow = true
    this._eyeMesh.castShadow  = false
  }

  private _buildMaterials(): void {
    this._skinMat?.dispose()
    this._eyeMat?.dispose()
    this._skinMat = buildSkinMaterial(this.parameters, this._shaderCore)
    this._eyeMat  = buildEyeMaterial(this.parameters, this._shaderCore)
    this._bodyMesh.material = this._skinMat
    this._eyeMesh.material  = this._eyeMat
  }
}
