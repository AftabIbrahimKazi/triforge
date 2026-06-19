import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface GlassBSDFInputs {
  color?:     OutputSocket | string
  roughness?: OutputSocket | number
  ior?:       OutputSocket | number
  normal?:    OutputSocket
}

/**
 * Glass BSDF — Blender "Glass BSDF" node equivalent.
 * Combines specular reflection and refraction — physically-based glass.
 *
 * Inputs:  color, roughness, ior, normal
 * Outputs: BSDF (shader)
 */
export class GlassBSDF extends ProcessNode {
  get nodeType() { return 'GlassBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Glass BSDF', category: 'Shader', color: '#336699', cost: 'medium' }
  }

  static glslFunction = `
vec3 _st_glassBSDF(vec3 color, float roughness, float ior, vec3 N) {
  vec3  V       = normalize(cameraPosition - vPosition);
  vec3  L       = normalize(vec3(1.0, 2.0, 1.0));
  vec3  H       = normalize(L + V);
  float F0      = pow((1.0 - ior) / (1.0 + ior), 2.0);
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, N), 0.0), 5.0);
  float NdotH   = max(dot(N, H), 0.0);
  float a2      = roughness * roughness * roughness * roughness;
  float D       = a2 / max(3.14159 * pow(NdotH * NdotH * (a2 - 1.0) + 1.0, 2.0), 0.0001);
  vec3  spec    = vec3(1.0) * D * fresnel;
  vec3  refr    = color * (1.0 - fresnel) * (1.0 - roughness * 0.3);
  return spec + refr;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: GlassBSDFInputs = {}) {
    super('GlassBSDF')
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
  compileDefs()      { return GlassBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color     = ctx.resolveInput(this._inputs.color)
    const roughness = ctx.resolveInput(this._inputs.roughness)
    const ior       = ctx.resolveInput(this._inputs.ior)
    const normal    = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_glassBSDF(${color}, ${roughness}, ${ior}, ${normal});`
  }
}
