import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface SheenBSDFInputs {
  color?:     OutputSocket | string
  roughness?: OutputSocket | number
  normal?:    OutputSocket
}

/**
 * Sheen BSDF — Blender "Sheen BSDF" node equivalent.
 * Simulates fuzzy micro-fibre cloth surfaces — velvet, satin, felt.
 * Uses Ashikhmin sheen model approximation.
 *
 * Inputs:  color, roughness, normal
 * Outputs: BSDF (shader)
 */
export class SheenBSDF extends ProcessNode {
  get nodeType() { return 'SheenBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Sheen BSDF', category: 'Shader', color: '#336699', cost: 'medium' }
  }

  static glslFunction = `
vec3 _st_sheenBSDF(vec3 color, float roughness, vec3 N) {
  vec3  V     = normalize(cameraPosition - vPosition);
  vec3  L     = normalize(vec3(1.0, 2.0, 1.0));
  vec3  H     = normalize(L + V);
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0001);
  float NdotH = max(dot(N, H), 0.0);
  float sinThetaH = sqrt(max(1.0 - NdotH * NdotH, 0.0));
  float r2 = roughness * roughness;
  float sheen = (2.0 + 1.0 / r2) * pow(sinThetaH, 1.0 / r2) / (2.0 * 3.14159);
  return color * sheen * NdotL / max(NdotL + NdotV - NdotL * NdotV, 0.0001) + color * 0.03;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: SheenBSDFInputs = {}) {
    super('SheenBSDF')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:     ['color', '#ffffff'],
      roughness: ['float', inputs.roughness ?? 0.5],
      normal:    ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return SheenBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color     = ctx.resolveInput(this._inputs.color)
    const roughness = ctx.resolveInput(this._inputs.roughness)
    const normal    = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_sheenBSDF(${color}, ${roughness}, ${normal});`
  }
}
