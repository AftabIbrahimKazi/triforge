import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface PrincipledBSDFInputs {
  baseColor?: OutputSocket | string
  metallic?:  OutputSocket | number
  roughness?: OutputSocket | number
  ior?:       OutputSocket | number
  alpha?:     OutputSocket | number
  normal?:    OutputSocket
}

/**
 * Principled BSDF — Blender "Principled BSDF" node equivalent.
 *
 * Inputs:  baseColor, metallic, roughness, ior, alpha, normal
 * Outputs: BSDF (shader)
 */
export class PrincipledBSDF extends ProcessNode {
  get nodeType() { return 'PrincipledBSDF' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Principled BSDF', category: 'Shader', color: '#336699', cost: 'medium', costNote: 'Schlick Fresnel + GGX — heavier on mobile.' }
  }

  static glslFunction = `
// Set these on material.uniforms after compile()
#ifndef _ST_HAIR_LIGHT_UNIFORMS
#define _ST_HAIR_LIGHT_UNIFORMS
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uAmbientColor;
#endif

vec3 _st_schlick(vec3 F0, float c) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - c, 0.0, 1.0), 5.0);
}
float _st_ggx(float NdotH, float r) {
  float a = r * r, a2 = a * a;
  float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / max(3.14159 * d * d, 1e-7);
}
float _st_geo(float NdotX, float r) {
  float k = (r + 1.0) * (r + 1.0) / 8.0;
  return NdotX / max(NdotX * (1.0 - k) + k, 1e-7);
}
vec3 _st_principledBSDF(vec3 base, float metallic, float roughness, float ior, float alpha, vec3 N) {
  vec3  V     = normalize(cameraPosition - vPosition);
  vec3  L     = normalize(uSunDirection);
  vec3  H     = normalize(L + V);
  float r     = max(roughness, 0.04);
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 1e-4);
  float NdotH = max(dot(N, H), 0.0);
  float HdotV = max(dot(H, V), 0.0);
  float f0s   = pow((1.0 - ior) / (1.0 + ior), 2.0);
  vec3  F0    = mix(vec3(f0s), base, metallic);
  vec3  F     = _st_schlick(F0, HdotV);
  float D     = _st_ggx(NdotH, r);
  float G     = _st_geo(NdotL, r) * _st_geo(NdotV, r);
  vec3  spec  = (D * G * F) / max(4.0 * NdotV * NdotL, 1e-7);
  vec3  kD    = (1.0 - F) * (1.0 - metallic);
  vec3  ambient = uAmbientColor * base;
  return ambient + (kD * base / 3.14159 + spec * uSunColor) * NdotL;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: PrincipledBSDFInputs = {}) {
    super('PrincipledBSDF')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      baseColor: ['color',  '#ffffff'],
      metallic:  ['float',  0.0],
      roughness: ['float',  0.5],
      ior:       ['float',  1.5],
      alpha:     ['float',  1.0],
      normal:    ['color', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return this.glslFunction ?? PrincipledBSDF.glslFunction }

  compileCall(ctx: CompileContext): string {
    const normal = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_principledBSDF(${ctx.resolveInput(this._inputs.baseColor)}, ${ctx.resolveInput(this._inputs.metallic)}, ${ctx.resolveInput(this._inputs.roughness)}, ${ctx.resolveInput(this._inputs.ior)}, ${ctx.resolveInput(this._inputs.alpha)}, ${normal});`
  }
}
