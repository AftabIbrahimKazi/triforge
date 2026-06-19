import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface VolumeAbsorptionInputs {
  color?:   OutputSocket | string
  density?: OutputSocket | number
}

/**
 * Volume Absorption — Blender "Volume Absorption" shader node.
 * Absorbs light as it passes through the volume.
 * Connect to MaterialOutput.volume.
 *
 * Inputs:  color (color), density (float)
 * Outputs: Volume (shader)
 */
export class VolumeAbsorption extends ProcessNode {
  get nodeType() { return 'VolumeAbsorption' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Volume Absorption', category: 'Shader', color: '#2255aa', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_volumeAbsorption(vec3 color, float density) {
  return color * density;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: VolumeAbsorptionInputs = {}) {
    super('VolumeAbsorption')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:   ['color', '#000000'],
      density: ['float', inputs.density ?? 1.0],
    })
    this._outputs = this.createOutputs({ Volume: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return VolumeAbsorption.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color   = ctx.resolveInput(this._inputs.color)
    const density = ctx.resolveInput(this._inputs.density)
    return `vec3 ${ctx.outputVar(this, 'Volume')} = _st_volumeAbsorption(${color}, ${density});`
  }
}
