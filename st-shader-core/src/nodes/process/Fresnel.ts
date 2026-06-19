import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface FresnelInputs {
  ior?:    number | OutputSocket
  normal?: OutputSocket
}

/**
 * Fresnel — outputs reflectance based on viewing angle.
 * Equivalent to Blender's "Fresnel" input node.
 *
 * At grazing angles (looking across the surface) → value near 1.0 (reflects sky)
 * Looking straight down at the surface           → value near 0.0 (sees through)
 *
 * Inputs:
 *   ior    (float)  — index of refraction   default: 1.45
 *   normal (vector) — surface normal override, defaults to geometry normal
 *
 * Outputs:
 *   Fac (float) — fresnel reflectance [0-1]
 */
export class Fresnel extends ProcessNode {
  get nodeType() { return 'Fresnel' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return {
      label:    'Fresnel',
      category: 'Input',
      color:    '#3d6b96',
      cost:     'low',
    }
  }

  static glslFunction = `
float _st_fresnel(float ior, vec3 N) {
  vec3  V  = normalize(cameraPosition - vPosition);
  float F0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
  float c  = max(dot(V, N), 0.0);
  return F0 + (1.0 - F0) * pow(1.0 - c, 5.0);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: FresnelInputs = {}) {
    super('Fresnel')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      ior:    ['float', inputs.ior ?? 1.33],
      normal: ['color', null],
    })
    this._outputs = this.createOutputs({ Fac: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Fresnel.glslFunction }

  compileCall(ctx: CompileContext): string {
    const ior    = ctx.resolveInput(this._inputs.ior)
    const normal = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    const outVar = ctx.outputVar(this, 'Fac')
    return `float ${outVar} = _st_fresnel(${ior}, ${normal});`
  }
}
