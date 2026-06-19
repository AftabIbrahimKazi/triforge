import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Light Path — Blender "Light Path" input node equivalent.
 *
 * Outputs the ray type currently being rendered, driven by externally-set
 * uniforms. In rasterizer mode the uniforms default to camera-ray values
 * (Is Camera Ray = 1, all others = 0).
 *
 * To drive a full multi-pass render where shadow/bounce contributions are
 * separated, use LightPathController from @st-pathtracer-core, which sets
 * these uniforms before each render pass.
 *
 * Uniform names are available on LightPath.U for external use.
 *
 * Outputs (all float):
 *   Is Camera Ray, Is Shadow Ray, Is Diffuse Ray, Is Glossy Ray,
 *   Is Singular Ray, Is Reflection Ray, Is Transmission Ray,
 *   Ray Length, Ray Depth, Diffuse Depth, Glossy Depth,
 *   Shadow Depth, Transparent Depth, Transmission Depth
 */
export class LightPath extends InputNode {
  get nodeType() { return 'LightPath' }

  get metadata(): NodeMetadata {
    return { label: 'Light Path', category: 'Input', color: '#5a3d7a', cost: 'low' }
  }

  readonly parameters: Record<string, never> = {}

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  /**
   * Canonical uniform names used by LightPath.
   * LightPathController sets these on the compiled ShaderMaterial.
   */
  static readonly U = {
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

  constructor() {
    super('LightPath')
    this._outputs = this.createOutputs({
      'Is Camera Ray':       'float',
      'Is Shadow Ray':       'float',
      'Is Diffuse Ray':      'float',
      'Is Glossy Ray':       'float',
      'Is Singular Ray':     'float',
      'Is Reflection Ray':   'float',
      'Is Transmission Ray': 'float',
      'Ray Length':          'float',
      'Ray Depth':           'float',
      'Diffuse Depth':       'float',
      'Glossy Depth':        'float',
      'Shadow Depth':        'float',
      'Transparent Depth':   'float',
      'Transmission Depth':  'float',
    })
  }

  getOutputSockets() { return this._outputs }

  /**
   * Register all LightPath uniforms with their rasterizer defaults.
   * CompileContext picks these up and includes them in the compiled
   * material's uniforms object so LightPathController can set them.
   * Default: Is Camera Ray = 1.0, all others = 0.0.
   */
  extraUniforms(): Record<string, number> {
    const U = LightPath.U
    return {
      [U.isCamera]:          1.0,
      [U.isShadow]:          0.0,
      [U.isDiffuse]:         0.0,
      [U.isGlossy]:          0.0,
      [U.isSingular]:        0.0,
      [U.isReflection]:      0.0,
      [U.isTransmission]:    0.0,
      [U.rayLength]:         0.0,
      [U.rayDepth]:          0.0,
      [U.diffuseDepth]:      0.0,
      [U.glossyDepth]:       0.0,
      [U.shadowDepth]:       0.0,
      [U.transparentDepth]:  0.0,
      [U.transmissionDepth]: 0.0,
    }
  }

  compileDefs(): string { return '' }

  compileCall(ctx: CompileContext): string {
    const U = LightPath.U
    return [
      `float ${ctx.outputVar(this, 'Is Camera Ray')}       = ${U.isCamera};`,
      `float ${ctx.outputVar(this, 'Is Shadow Ray')}       = ${U.isShadow};`,
      `float ${ctx.outputVar(this, 'Is Diffuse Ray')}      = ${U.isDiffuse};`,
      `float ${ctx.outputVar(this, 'Is Glossy Ray')}       = ${U.isGlossy};`,
      `float ${ctx.outputVar(this, 'Is Singular Ray')}     = ${U.isSingular};`,
      `float ${ctx.outputVar(this, 'Is Reflection Ray')}   = ${U.isReflection};`,
      `float ${ctx.outputVar(this, 'Is Transmission Ray')} = ${U.isTransmission};`,
      `float ${ctx.outputVar(this, 'Ray Length')}          = ${U.rayLength};`,
      `float ${ctx.outputVar(this, 'Ray Depth')}           = ${U.rayDepth};`,
      `float ${ctx.outputVar(this, 'Diffuse Depth')}       = ${U.diffuseDepth};`,
      `float ${ctx.outputVar(this, 'Glossy Depth')}        = ${U.glossyDepth};`,
      `float ${ctx.outputVar(this, 'Shadow Depth')}        = ${U.shadowDepth};`,
      `float ${ctx.outputVar(this, 'Transparent Depth')}   = ${U.transparentDepth};`,
      `float ${ctx.outputVar(this, 'Transmission Depth')}  = ${U.transmissionDepth};`,
    ].join('\n  ')
  }
}
