import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Hair Info — Blender "Hair Info" input node equivalent.
 * Reads per-vertex strand data written by st-hair-core buildTubeGeometry /
 * buildRibbonGeometry into the strandTangent and strandRandom attributes.
 *
 * Geometry requirements (tube or ribbon from st-hair-core):
 *   attribute vec3  strandTangent — tangent along strand axis at this vertex
 *   attribute float strandRandom  — per-strand uniform random value [0,1]
 *   vUv.y                         — 0 at root, 1 at tip
 *
 * Outputs:
 *   IsStrand      (float) — always 1.0 (use to mix with surface shader)
 *   Intercept     (float) — 0.0 at root → 1.0 at tip
 *   Length        (float) — 1.0 (normalised; actual length lives in the generator)
 *   TangentNormal (color) — unit tangent direction along the strand
 *   Random        (float) — per-strand random value in [0, 1]
 */
export class HairInfo extends InputNode {
  get nodeType() { return 'HairInfo' }

  get metadata(): NodeMetadata {
    return { label: 'Hair Info', category: 'Input', color: '#5a3a1a', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('HairInfo')
    this._outputs = this.createOutputs({
      IsStrand:      'float',
      Intercept:     'float',
      Length:        'float',
      TangentNormal: 'color',
      Random:        'float',
    })
  }

  getOutputSockets() { return this._outputs }

  vertexInjections() {
    return [
      { attrName: 'strandTangent', attrType: 'vec3'  as const, varyingName: 'vStrandTangent' },
      { attrName: 'strandRandom',  attrType: 'float' as const, varyingName: 'vStrandRandom'  },
    ]
  }

  compileCall(ctx: CompileContext): string {
    return [
      `float ${ctx.outputVar(this, 'IsStrand')}      = 1.0;`,
      `float ${ctx.outputVar(this, 'Intercept')}     = vUv.y;`,
      `float ${ctx.outputVar(this, 'Length')}        = 1.0;`,
      `vec3  ${ctx.outputVar(this, 'TangentNormal')} = normalize(vStrandTangent);`,
      `float ${ctx.outputVar(this, 'Random')}        = vStrandRandom;`,
    ].join('\n  ')
  }
}
