import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface RefractionBSDFInputs {
  color?:     OutputSocket | string
  roughness?: OutputSocket | number
  ior?:       OutputSocket | number
  normal?:    OutputSocket
}

/**
 * Refraction BSDF — Blender "Refraction BSDF" node equivalent.
 * Simulates light bending through a transparent medium.
 * Approximated in real-time using a tinted transmission colour.
 *
 * Inputs:  color, roughness, ior, normal
 * Outputs: BSDF (shader)
 */
export class RefractionBSDF extends ProcessNode {
  get nodeType() { return 'RefractionBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Refraction BSDF', category: 'Shader', color: '#336699', cost: 'medium' }
  }

  static glslFunction = `
vec3 _st_refractionBSDF(vec3 color, float roughness, float ior, vec3 N) {
  vec3  V        = normalize(cameraPosition - vPosition);
  vec3  refDir   = refract(-V, N, 1.0 / ior);
  float fresnel  = pow(1.0 - max(dot(V, N), 0.0), 5.0);
  vec3  refColor = color * (1.0 - fresnel) * (1.0 - roughness * 0.5);
  return refColor;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: RefractionBSDFInputs = {}) {
    super('RefractionBSDF')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:     ['color', '#ffffff'],
      roughness: ['float', inputs.roughness ?? 0.0],
      ior:       ['float', inputs.ior       ?? 1.45],
      normal:    ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return RefractionBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color     = ctx.resolveInput(this._inputs.color)
    const roughness = ctx.resolveInput(this._inputs.roughness)
    const ior       = ctx.resolveInput(this._inputs.ior)
    const normal    = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_refractionBSDF(${color}, ${roughness}, ${ior}, ${normal});`
  }
}
