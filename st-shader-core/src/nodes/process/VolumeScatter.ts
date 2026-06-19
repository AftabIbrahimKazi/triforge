import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface VolumeScatterInputs {
  color?:       OutputSocket | string
  density?:     OutputSocket | number
  anisotropy?:  OutputSocket | number
}

/**
 * Volume Scatter — Blender "Volume Scatter" shader node.
 * Scatters light inside the volume with Henyey-Greenstein phase function.
 * Connect to MaterialOutput.volume.
 *
 * Inputs:  color (color), density (float), anisotropy (float, -1..1)
 * Outputs: Volume (shader)
 */
export class VolumeScatter extends ProcessNode {
  get nodeType() { return 'VolumeScatter' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Volume Scatter', category: 'Shader', color: '#3388cc', cost: 'medium' }
  }

  static glslFunction = `
vec3 _st_volumeScatter(vec3 color, float density, float anisotropy) {
  float g  = clamp(anisotropy, -0.9999, 0.9999);
  float g2 = g * g;
  // HG phase at cosTheta=0 (isotropic approximation for surface shading context)
  float phase = (1.0 - g2) / pow(1.0 + g2, 1.5);
  return color * density * phase;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: VolumeScatterInputs = {}) {
    super('VolumeScatter')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:      ['color', '#ffffff'],
      density:    ['float', inputs.density    ?? 1.0],
      anisotropy: ['float', inputs.anisotropy ?? 0.0],
    })
    this._outputs = this.createOutputs({ Volume: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return VolumeScatter.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color      = ctx.resolveInput(this._inputs.color)
    const density    = ctx.resolveInput(this._inputs.density)
    const anisotropy = ctx.resolveInput(this._inputs.anisotropy)
    return `vec3 ${ctx.outputVar(this, 'Volume')} = _st_volumeScatter(${color}, ${density}, ${anisotropy});`
  }
}
