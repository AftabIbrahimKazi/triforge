import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface NormalMapInputs {
  fac?:      OutputSocket
  strength?: number | OutputSocket
}

/**
 * Normal Map — converts a float noise value into a surface normal.
 * Derives normals via numerical gradient of the input Fac value.
 * Connect to PrincipledBSDF.normal input for surface detail lighting.
 *
 * Inputs:
 *   fac      (float)  — greyscale height value, typically from NoiseTexture.Fac
 *   strength (float)  — normal intensity [0-10]  default: 1.0
 *
 * Outputs:
 *   Normal (vector) — perturbed surface normal, ready for PrincipledBSDF.normal
 */
export class NormalMap extends ProcessNode {
  get nodeType() { return 'NormalMap' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return {
      label:    'Normal Map',
      category: 'Vector',
      color:    '#4a3a8a',
      cost:     'medium',
      costNote: 'Samples input Fac four times for gradient computation.',
    }
  }

  static glslFunction = `
vec3 _st_normalMap(float fac, float strength) {
  return vec3(0.0, 1.0, 0.0);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: NormalMapInputs = {}) {
    super('NormalMap')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      fac:      ['float', 0.5],
      strength: ['float', inputs.strength ?? 1.0],
    })
    this._outputs = this.createOutputs({ Normal: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const facVar    = this._inputs.fac.isConnected()
      ? ctx.outputVar(this._inputs.fac.connection!.node, this._inputs.fac.connection!.name)
      : ctx.resolveInput(this._inputs.fac)

    const strength  = ctx.resolveInput(this._inputs.strength)
    const normalVar = ctx.outputVar(this, 'Normal')

    // Numerical gradient — samples fac variable neighbour delta via world position
    return [
      `float _nm_nx_${this.id} = dFdx(${facVar});`,
      `float _nm_ny_${this.id} = dFdy(${facVar});`,
      `vec3  ${normalVar} = normalize(vec3(-_nm_nx_${this.id} * ${strength}, 1.0, -_nm_ny_${this.id} * ${strength}));`,
    ].join('\n  ')
  }
}
