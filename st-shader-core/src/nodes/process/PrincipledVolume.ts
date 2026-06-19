import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface PrincipledVolumeInputs {
  color?:             OutputSocket | string
  density?:           OutputSocket | number
  anisotropy?:        OutputSocket | number
  absorptionColor?:   OutputSocket | string
  emissionColor?:     OutputSocket | string
  emissionStrength?:  OutputSocket | number
  blackbodyIntensity?: OutputSocket | number
  temperature?:       OutputSocket | number
}

/**
 * Principled Volume — Blender "Principled Volume" shader node.
 * Combines scatter, absorption, and emission into a single volume shader.
 * Connect to MaterialOutput.volume.
 *
 * Inputs:  color, density, anisotropy, absorptionColor, emissionColor,
 *          emissionStrength, blackbodyIntensity, temperature
 * Outputs: Volume (shader)
 */
export class PrincipledVolume extends ProcessNode {
  get nodeType() { return 'PrincipledVolume' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Principled Volume', category: 'Shader', color: '#1a6688', cost: 'high' }
  }

  static glslFunction = `
vec3 _st_principledVolume(
  vec3  scatterColor,   float density,
  float anisotropy,     vec3  absorptionColor,
  vec3  emissionColor,  float emissionStrength,
  float blackbodyIntensity, float temperature
) {
  float g  = clamp(anisotropy, -0.9999, 0.9999);
  float g2 = g * g;
  float phase = (1.0 - g2) / pow(1.0 + g2, 1.5);

  vec3 scatter    = scatterColor * density * phase;
  vec3 absorption = absorptionColor * density;
  vec3 emission   = emissionColor * emissionStrength;

  // Simplified blackbody tint: blend toward hot white at high temperature
  float tNorm = clamp((temperature - 800.0) / 4200.0, 0.0, 1.0);
  vec3  bb    = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.95, 0.8), tNorm);
  emission   += bb * blackbodyIntensity * density;

  return scatter + emission - absorption * 0.5;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: PrincipledVolumeInputs = {}) {
    super('PrincipledVolume')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:              ['color', '#ffffff'],
      density:            ['float', inputs.density            ?? 1.0],
      anisotropy:         ['float', inputs.anisotropy         ?? 0.0],
      absorptionColor:    ['color', '#000000'],
      emissionColor:      ['color', '#000000'],
      emissionStrength:   ['float', inputs.emissionStrength   ?? 0.0],
      blackbodyIntensity: ['float', inputs.blackbodyIntensity ?? 0.0],
      temperature:        ['float', inputs.temperature        ?? 1000.0],
    })
    this._outputs = this.createOutputs({ Volume: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return PrincipledVolume.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color             = ctx.resolveInput(this._inputs.color)
    const density           = ctx.resolveInput(this._inputs.density)
    const anisotropy        = ctx.resolveInput(this._inputs.anisotropy)
    const absorptionColor   = ctx.resolveInput(this._inputs.absorptionColor)
    const emissionColor     = ctx.resolveInput(this._inputs.emissionColor)
    const emissionStrength  = ctx.resolveInput(this._inputs.emissionStrength)
    const blackbodyIntensity = ctx.resolveInput(this._inputs.blackbodyIntensity)
    const temperature       = ctx.resolveInput(this._inputs.temperature)
    return `vec3 ${ctx.outputVar(this, 'Volume')} = _st_principledVolume(${color}, ${density}, ${anisotropy}, ${absorptionColor}, ${emissionColor}, ${emissionStrength}, ${blackbodyIntensity}, ${temperature});`
  }
}
