import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface GlossyBSDFInputs {
  color?:     OutputSocket | string
  roughness?: OutputSocket | number
  normal?:    OutputSocket
}

/**
 * Glossy BSDF — Blender "Glossy BSDF" node equivalent.
 * Pure specular/mirror surface — no diffuse.
 *
 * Inputs:  color, roughness [0-1], normal
 * Outputs: BSDF (shader)
 */
export class GlossyBSDF extends ProcessNode {
  get nodeType() { return 'GlossyBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Glossy BSDF', category: 'Shader', color: '#336699', cost: 'medium' }
  }

  static glslFunction = `
vec3 _st_glossyBSDF(vec3 color, float roughness, vec3 N) {
  vec3  L     = normalize(vec3(1.0, 2.0, 1.0));
  vec3  V     = normalize(cameraPosition - vPosition);
  vec3  H     = normalize(L + V);
  float a     = roughness * roughness;
  float a2    = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float D     = a2 / max(3.14159265 * pow(NdotH * NdotH * (a2 - 1.0) + 1.0, 2.0), 0.0001);
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0001);
  float k     = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  float G     = (NdotL / (NdotL * (1.0 - k) + k)) * (NdotV / (NdotV * (1.0 - k) + k));
  return color * D * G / max(4.0 * NdotL * NdotV, 0.0001) * NdotL;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: GlossyBSDFInputs = {}) {
    super('GlossyBSDF')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:     ['color', '#ffffff'],
      roughness: ['float', inputs.roughness ?? 0.5],
      normal:    ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return GlossyBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color     = ctx.resolveInput(this._inputs.color)
    const roughness = ctx.resolveInput(this._inputs.roughness)
    const normal    = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_glossyBSDF(${color}, ${roughness}, ${normal});`
  }
}
