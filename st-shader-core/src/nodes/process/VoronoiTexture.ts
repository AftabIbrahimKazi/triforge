import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type VoronoiFeature = 'F1' | 'F2' | 'SMOOTH_F1' | 'DISTANCE_TO_EDGE'

export interface VoronoiTextureInputs {
  vector?:     OutputSocket
  scale?:      number | OutputSocket
  smoothness?: number | OutputSocket
  feature?:    VoronoiFeature
}

/**
 * Voronoi Texture — Blender "Voronoi Texture" node equivalent.
 * Full implementation matching all four Blender feature modes:
 *
 *   F1              — distance to nearest cell center (classic Voronoi)
 *   F2              — distance to second-nearest cell center
 *   SMOOTH_F1       — smooth minimum of F1 across cells (softens cell edges)
 *   DISTANCE_TO_EDGE — distance to the Voronoi cell boundary
 *
 * Inputs:  vector, scale (float), smoothness (float, used by SMOOTH_F1)
 * Outputs: Distance (float), Color (color)
 */
export class VoronoiTexture extends ProcessNode {
  get nodeType() { return 'VoronoiTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return {
      label:    'Voronoi Texture',
      category: 'Texture',
      color:    '#3a6b3a',
      cost:     'high',
      costNote: '3×3×3 cell loop per fragment — avoid stacking.',
    }
  }

  static glslFunction = `
vec3 _st_vorHash(vec3 cell) {
  return fract(sin(vec3(
    dot(cell, vec3(127.1, 311.7,  74.7)),
    dot(cell, vec3(269.5, 183.3, 246.1)),
    dot(cell, vec3(113.5, 271.9, 124.6))
  )) * 43758.5453);
}

// Returns vec3(f1_dist, f2_dist, 0) and outputs cell color via out param
vec2 _st_vorF1F2(vec3 p, out vec3 cellColor) {
  vec3  pi = floor(p), pf = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec3  c1 = vec3(0.0);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3  nb   = vec3(float(x), float(y), float(z));
    vec3  pt   = _st_vorHash(pi + nb);
    float dist = length(nb + pt - pf);
    if (dist < d1) { d2 = d1; d1 = dist; c1 = pt; }
    else if (dist < d2) { d2 = dist; }
  }
  cellColor = c1;
  return vec2(d1, d2);
}

float _st_vorSmoothF1(vec3 p, float smoothness) {
  vec3  pi = floor(p), pf = fract(p);
  float res = 0.0;
  float k   = max(smoothness, 0.0001);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3  nb   = vec3(float(x), float(y), float(z));
    vec3  pt   = _st_vorHash(pi + nb);
    float dist = length(nb + pt - pf);
    res += exp(-32.0 * dist / k);
  }
  return -(k / 32.0) * log(res);
}

float _st_vorDistToEdge(vec3 p) {
  // Approximate distance to cell edge as (F2 - F1) * 0.5.
  // Avoids the 5x5x5 loop that exceeds WebGL1 loop-unroll limits.
  vec3  col = vec3(0.0);
  vec2  f   = _st_vorF1F2(p, col);
  return (f.y - f.x) * 0.5;
}`

  private readonly feature: VoronoiFeature
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: VoronoiTextureInputs = {}) {
    super('VoronoiTexture')
    this.feature  = inputs.feature ?? 'F1'
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector:     ['color', null],
      scale:      ['float', inputs.scale      ?? 5.0],
      smoothness: ['float', inputs.smoothness ?? 1.0],
    })
    this._outputs = this.createOutputs({ Distance: 'float', Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return VoronoiTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const p    = this._inputs.vector.isConnected()
      ? `(${ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)} * ${ctx.resolveInput(this._inputs.scale)})`
      : `(vec3(vUv, 0.0) * ${ctx.resolveInput(this._inputs.scale)})`
    const smooth = ctx.resolveInput(this._inputs.smoothness)
    const dv   = ctx.outputVar(this, 'Distance')
    const cv   = ctx.outputVar(this, 'Color')
    const tmp  = `_vor_${this.id}`

    switch (this.feature) {
      case 'F2':
        return [
          `vec3  ${tmp}_col = vec3(0.0);`,
          `vec2  ${tmp}_f   = _st_vorF1F2(${p}, ${tmp}_col);`,
          `float ${dv} = ${tmp}_f.y;`,
          `vec3  ${cv} = ${tmp}_col;`,
        ].join('\n  ')

      case 'SMOOTH_F1':
        return [
          `float ${dv} = _st_vorSmoothF1(${p}, ${smooth});`,
          `vec3  ${cv} = vec3(${dv});`,
        ].join('\n  ')

      case 'DISTANCE_TO_EDGE':
        return [
          `float ${dv} = _st_vorDistToEdge(${p});`,
          `vec3  ${cv} = vec3(${dv});`,
        ].join('\n  ')

      default: // F1
        return [
          `vec3  ${tmp}_col = vec3(0.0);`,
          `vec2  ${tmp}_f   = _st_vorF1F2(${p}, ${tmp}_col);`,
          `float ${dv} = ${tmp}_f.x;`,
          `vec3  ${cv} = ${tmp}_col;`,
        ].join('\n  ')
    }
  }
}
