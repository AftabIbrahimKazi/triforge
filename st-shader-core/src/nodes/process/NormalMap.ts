import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface NormalMapInputs {
  color?:    OutputSocket
  strength?: number | OutputSocket
}

/**
 * Normal Map — Blender "Normal Map" node equivalent.
 * Decodes a tangent-space normal texture (RGB → vector, [0,1] → [-1,1]) and
 * rotates it into world space using a derivative-based cotangent frame, so no
 * explicit vertex tangent attribute is required.
 *
 * Connect ImageTexture.Color (sampling a non-color / linear normal map texture)
 * to `color`. Connect the result to PrincipledBSDF.normal.
 *
 * Inputs:
 *   color    (color) — sampled RGB normal texture, still in [0,1] range
 *   strength (float) — normal intensity, default: 1.0
 *
 * Outputs:
 *   Normal (color) — world-space perturbed normal, ready for PrincipledBSDF.normal
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
      costNote: 'Builds a derivative-based TBN frame per fragment.',
    }
  }

  static glslFunction = `
vec3 _st_normalMap(vec3 sampledColor, float strength, vec3 N, vec3 P, vec2 uv) {
  vec3 n = sampledColor * 2.0 - 1.0;
  n.xy *= strength;

  // Derivative-based cotangent frame (Schüler) — no vertex tangent attribute needed.
  vec3 dp1  = dFdx(P);
  vec3 dp2  = dFdy(P);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);

  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

  float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
  mat3 TBN = mat3(T * invmax, B * invmax, N);
  return normalize(TBN * n);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: NormalMapInputs = {}) {
    super('NormalMap')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:    ['color', [0.5, 0.5, 1.0]],
      strength: ['float', inputs.strength ?? 1.0],
    })
    this._outputs = this.createOutputs({ Normal: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return NormalMap.glslFunction }

  compileCall(ctx: CompileContext): string {
    const color    = ctx.resolveInput(this._inputs.color)
    const strength = ctx.resolveInput(this._inputs.strength)
    const normalVar = ctx.outputVar(this, 'Normal')

    return `vec3 ${normalVar} = _st_normalMap(${color}, ${strength}, normalize(vNormal), vPosition, vUv);`
  }
}
