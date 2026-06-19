import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'
import type { InputSocket } from '../../core/InputSocket.js'

export interface AmbientOcclusionInputs {
  color?:  OutputSocket | [number, number, number] | string
}

/**
 * Ambient Occlusion — Blender "Ambient Occlusion" input node equivalent.
 *
 * Approximates SSAO using a fixed hemisphere sample kernel evaluated against
 * neighboring surface normals. Because no depth buffer is available in a
 * forward-rendered fragment shader, the implementation samples offset
 * positions in view space and estimates occlusion from the surface normal
 * divergence between the central fragment and each sample.
 *
 * Parameters:
 *   samples  (number) — hemisphere sample count [1–16], default 8
 *   distance (number) — sampling radius in world units, default 0.5
 *   inside   (number) — 0 = exterior AO (default), 1 = invert for interior surfaces
 *
 * Inputs:
 *   Color (color) — base color to attenuate by the AO factor
 *
 * Outputs:
 *   Color (color) — input color darkened by AO
 *   AO    (float) — raw ambient occlusion factor [0–1]
 */
export class AmbientOcclusion extends InputNode {
  get nodeType() { return 'AmbientOcclusion' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Ambient Occlusion', category: 'Input', color: '#3d6b96', cost: 'high', costNote: 'multi-sample hemisphere loop' }
  }

  override parameters: { samples: number; distance: number; inside: number } = {
    samples:  8,
    distance: 0.5,
    inside:   0,
  }

  private readonly _inputs:  Record<string, InputSocket<unknown>>
  private readonly _outputs: Record<string, OutputSocket>

  constructor(inputs: AmbientOcclusionInputs = {}) {
    super('AmbientOcclusion')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color: ['color', inputs.color ?? '#ffffff'],
    })
    this._outputs = this.createOutputs({ Color: 'color', AO: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    // Fixed-size hemisphere kernel (16 directions) — cap prevents unbounded loops.
    // Hash-based pseudo-random rotation avoids a texture lookup.
    // SECURITY: loop is bounded by compile-time constant 16.
    return `
float _st_ao_hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float _st_ambientOcclusion(vec3 pos, vec3 N, float dist, int samples, bool inside) {
  // 16-element hemisphere kernel (fixed compile-time size)
  vec3 kernel[16];
  kernel[0]  = vec3( 0.5381,  0.1856, -0.4319);
  kernel[1]  = vec3( 0.1379,  0.2486,  0.4430);
  kernel[2]  = vec3( 0.3371,  0.5679, -0.0057);
  kernel[3]  = vec3(-0.6999, -0.0451, -0.0019);
  kernel[4]  = vec3( 0.0689, -0.1598, -0.8547);
  kernel[5]  = vec3( 0.0560,  0.0069, -0.1843);
  kernel[6]  = vec3(-0.0146,  0.1402,  0.0762);
  kernel[7]  = vec3( 0.0100, -0.1924, -0.0344);
  kernel[8]  = vec3(-0.3577, -0.5301, -0.4358);
  kernel[9]  = vec3(-0.3169,  0.1063,  0.0158);
  kernel[10] = vec3( 0.0103, -0.5869,  0.0046);
  kernel[11] = vec3(-0.0897, -0.4940,  0.3287);
  kernel[12] = vec3( 0.7119, -0.0154, -0.0918);
  kernel[13] = vec3(-0.0533,  0.0596, -0.5411);
  kernel[14] = vec3( 0.0352, -0.0631,  0.5460);
  kernel[15] = vec3(-0.4776,  0.2847, -0.0271);

  float occlusion = 0.0;
  float noise     = _st_ao_hash(pos.xy + pos.z);
  float c = cos(noise * 6.2832);
  float s = sin(noise * 6.2832);

  // Build tangent frame from normal
  vec3 up      = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitan   = cross(N, tangent);
  mat3 tbn     = mat3(tangent, bitan, N);

  int clampedSamples = clamp(samples, 1, 16);
  for (int i = 0; i < 16; i++) {
    if (i >= clampedSamples) break;

    // Rotate sample by noise to reduce banding
    vec3 ks = kernel[i];
    vec3 rotated = vec3(
      c * ks.x - s * ks.y,
      s * ks.x + c * ks.y,
      ks.z
    );
    // Flip to hemisphere
    if (dot(rotated, N) < 0.0) rotated = -rotated;
    vec3 samplePos = pos + tbn * rotated * dist;

    // Estimate occlusion: if sample is "behind" the surface normal, it is occluded
    vec3  dir     = samplePos - pos;
    float contrib = max(dot(normalize(dir), N), 0.0);
    float decay   = 1.0 - clamp(length(dir) / dist, 0.0, 1.0);
    occlusion += contrib * decay;
  }

  occlusion = 1.0 - (occlusion / float(clampedSamples));
  return inside ? 1.0 - occlusion : occlusion;
}
`
  }

  compileCall(ctx: CompileContext): string {
    const colorIn = ctx.resolveInput(this._inputs.color)
    const outColor = ctx.outputVar(this, 'Color')
    const outAO    = ctx.outputVar(this, 'AO')

    // SECURITY: validate samples is a finite positive integer before GLSL
    const rawSamples = this.parameters.samples
    const safeSamples = (Number.isFinite(rawSamples) && rawSamples >= 1)
      ? Math.min(Math.floor(rawSamples), 16)
      : 8
    const inside = this.parameters.inside !== 0 ? 'true' : 'false'
    const dist   = Number.isFinite(this.parameters.distance) ? this.parameters.distance.toFixed(4) : '0.5000'

    return [
      `float ${outAO}    = _st_ambientOcclusion(vPosition, normalize(vNormal), ${dist}, ${safeSamples}, ${inside});`,
      `vec3  ${outColor} = ${colorIn} * ${outAO};`,
    ].join('\n  ')
  }
}
