import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface PrincipledHairInputs {
  /** Base hair color. Blender: Color. */
  color?:            OutputSocket | string
  /** Longitudinal roughness — scattering along the strand axis. Blender: Roughness. */
  roughness?:        OutputSocket | number
  /** Azimuthal roughness — scattering around the strand. Blender: Radial Roughness. */
  radialRoughness?:  OutputSocket | number
  /** Clear-coat specular intensity. Blender: Coat. */
  coat?:             OutputSocket | number
  /** Index of refraction — affects R-lobe highlight color. Blender: IOR. */
  ior?:              OutputSocket | number
  /** Longitudinal shift of specular lobes. Blender: Offset. */
  offset?:           OutputSocket | number
  /** Per-strand color variation amount [0,1]. Blender: Random Color. */
  randomColor?:      OutputSocket | number
  /** Per-strand roughness variation amount [0,1]. Blender: Random Roughness. */
  randomRoughness?:  OutputSocket | number
  /** Random seed input — connect HairInfo.Random for per-strand variation. */
  random?:           OutputSocket | number
}

/**
 * Principled Hair BSDF — Blender "Principled Hair BSDF" node equivalent.
 *
 * Implements a Kajiya-Kay dual-lobe model suitable for real-time rendering:
 *   • Diffuse:      sin(T, L)  — angle between tangent and light
 *   • R lobe:       primary specular highlight (white, sharp, IOR-tinted)
 *   • TRT lobe:     secondary specular (colored, broader, offset in opposite direction)
 *   • Coat:         clear-coat gloss on top
 *
 * Connect HairInfo.TangentNormal to the internal `tangent` socket and
 * HairInfo.Random to `random` for correct per-strand behavior.
 *
 * Inputs:  color, roughness, radialRoughness, coat, ior, offset,
 *          randomColor, randomRoughness, random, tangent
 * Outputs: BSDF (shader)
 */
export class PrincipledHair extends ProcessNode {
  get nodeType() { return 'PrincipledHair' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Principled Hair BSDF', category: 'Shader', color: '#5a3a1a', cost: 'medium' }
  }

  // Light uniforms guarded by a #define so they survive alongside PrincipledBSDF in the same graph.
  static glslFunction = `
#ifndef _ST_HAIR_LIGHT_UNIFORMS
#define _ST_HAIR_LIGHT_UNIFORMS
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uAmbientColor;
#endif

float _st_hairHash(float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

// Kajiya-Kay dual-lobe hair BSDF.
// T  = strand tangent (unit, world space)
// R  = primary specular exponent = 1 / (roughness^2)
// R2 = secondary specular exponent = 1 / (radialRoughness^2)
vec3 _st_principledHair(
  vec3  color,
  float roughness,
  float radialRoughness,
  float coat,
  float ior,
  float offset,
  float randomColor,
  float randomRoughness,
  float rnd,
  vec3  T
) {
  // Per-strand variation
  float rc = _st_hairHash(rnd * 1.3731 + 0.1);
  float rr = _st_hairHash(rnd * 2.7183 + 0.2);
  color     = mix(color, color * (0.6 + 0.8 * rc), randomColor);
  roughness = clamp(roughness + (rr - 0.5) * randomRoughness * 0.5, 0.02, 1.0);

  vec3  V   = normalize(cameraPosition - vPosition);
  vec3  L   = normalize(uSunDirection);
  vec3  H   = normalize(L + V);
  vec3  N   = normalize(vNormal);

  // Kajiya-Kay diffuse: sin(angle T, L)
  float cosT  = dot(T, L);
  float sinT  = sqrt(max(1.0 - cosT * cosT, 0.0));
  float diff  = sinT * max(dot(N, L) * 0.5 + 0.5, 0.0);  // wrap diffuse

  // R lobe — primary specular, shifted by +offset along normal
  float f0    = pow(clamp((1.0 - ior) / (1.0 + ior), 0.0, 1.0), 2.0);
  vec3  T1    = normalize(T + offset * N);
  float cosTH1 = dot(T1, H);
  float sinTH1 = sqrt(max(1.0 - cosTH1 * cosTH1, 0.0));
  float exp1   = max(1.0 / max(roughness * roughness, 0.001), 1.0);
  float spec1  = pow(sinTH1, exp1);
  vec3  F1     = vec3(f0) + (vec3(1.0) - vec3(f0)) * pow(1.0 - max(dot(H, V), 0.0), 5.0);

  // TRT lobe — secondary specular, shifted by -2*offset, colored
  vec3  T2    = normalize(T - 2.0 * offset * N);
  float cosTH2 = dot(T2, H);
  float sinTH2 = sqrt(max(1.0 - cosTH2 * cosTH2, 0.0));
  float rr2    = clamp(radialRoughness, 0.02, 1.0);
  float exp2   = max(1.0 / max(rr2 * rr2, 0.001), 1.0);
  float spec2  = pow(sinTH2, exp2) * 0.25;

  // Coat gloss
  float cosTHc  = dot(T, H);
  float sinTHc  = sqrt(max(1.0 - cosTHc * cosTHc, 0.0));
  float coatSpec = pow(sinTHc, 128.0) * coat;

  vec3 diffuse  = color * (uSunColor * diff + uAmbientColor);
  vec3 specular = uSunColor * (F1 * spec1 + vec3(coatSpec)) + color * uSunColor * spec2;

  return diffuse + specular;
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: PrincipledHairInputs = {}) {
    super('PrincipledHair')
    this._inputs = this.createInputs(inputs as Record<string, unknown>, {
      color:           ['color',  inputs.color           ?? '#8b6050'],
      roughness:       ['float',  inputs.roughness        ?? 0.3],
      radialRoughness: ['float',  inputs.radialRoughness  ?? 0.5],
      coat:            ['float',  inputs.coat             ?? 0.2],
      ior:             ['float',  inputs.ior              ?? 1.55],
      offset:          ['float',  inputs.offset           ?? 0.04],
      randomColor:     ['float',  inputs.randomColor      ?? 0.1],
      randomRoughness: ['float',  inputs.randomRoughness  ?? 0.0],
      random:          ['float',  inputs.random           ?? 0.0],
      tangent:         ['color',  null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return PrincipledHair.glslFunction }

  // Ensure strandTangent is always available even without HairInfo in the graph
  vertexInjections() {
    return [
      { attrName: 'strandTangent', attrType: 'vec3'  as const, varyingName: 'vStrandTangent' },
      { attrName: 'strandRandom',  attrType: 'float' as const, varyingName: 'vStrandRandom'  },
    ]
  }

  compileCall(ctx: CompileContext): string {
    const color           = ctx.resolveInput(this._inputs.color)
    const roughness       = ctx.resolveInput(this._inputs.roughness)
    const radialRoughness = ctx.resolveInput(this._inputs.radialRoughness)
    const coat            = ctx.resolveInput(this._inputs.coat)
    const ior             = ctx.resolveInput(this._inputs.ior)
    const offset          = ctx.resolveInput(this._inputs.offset)
    const randomColor     = ctx.resolveInput(this._inputs.randomColor)
    const randomRoughness = ctx.resolveInput(this._inputs.randomRoughness)
    const random          = ctx.resolveInput(this._inputs.random)
    const tangent         = this._inputs.tangent.isConnected()
      ? ctx.outputVar(this._inputs.tangent.connection!.node, this._inputs.tangent.connection!.name)
      : 'normalize(vStrandTangent)'  // fallback: read attribute directly if not connected

    return `vec3 ${ctx.outputVar(this, 'BSDF')} = _st_principledHair(${color}, ${roughness}, ${radialRoughness}, ${coat}, ${ior}, ${offset}, ${randomColor}, ${randomRoughness}, ${random}, ${tangent});`
  }
}
