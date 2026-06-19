import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface DiffuseBSDFInputs {
  color?:    OutputSocket | string
  roughness?: OutputSocket | number
  normal?:   OutputSocket
}

/**
 * Diffuse BSDF — Blender "Diffuse BSDF" node equivalent.
 * Pure Lambertian diffuse surface — flat matte, no specular highlights.
 *
 * Inputs:  color, roughness, normal
 * Outputs: BSDF (shader)
 */
export class DiffuseBSDF extends ProcessNode {
  get nodeType() { return 'DiffuseBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Diffuse BSDF', category: 'Shader', color: '#336699', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_diffuseBSDF(vec3 color, float roughness, vec3 N) {
  vec3  L       = normalize(vec3(1.0, 2.0, 1.0));
  float NdotL   = max(dot(N, L), 0.0);
  float diffuse = NdotL / 3.14159265;
  vec3  ambient = color * 0.15;
  return ambient + color * (diffuse * (1.0 - roughness * 0.5));
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: DiffuseBSDFInputs = {}) {
    super('DiffuseBSDF')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:     ['color', '#ffffff'],
      roughness: ['float', inputs.roughness ?? 0.0],
      normal:    ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return DiffuseBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color     = ctx.resolveInput(this._inputs.color)
    const roughness = ctx.resolveInput(this._inputs.roughness)
    const normal    = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_diffuseBSDF(${color}, ${roughness}, ${normal});`
  }
}
