import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Particle Info — Blender "Particle Info" input node equivalent.
 * Reads per-particle data written into vertex attributes by particle renderers.
 *
 * Geometry requirements (from st-particle-core BillboardRenderer / InstanceRenderer):
 *   attribute float particleIndex   — particle index in pool [0, N)
 *   attribute float particleAge     — normalised age [0, 1]
 *   attribute float particleRandom  — per-particle stable random value [0, 1]
 *
 * Outputs:
 *   Index  (float) — particle index (normalised to [0, 1] via index/count)
 *   Age    (float) — normalised lifetime: 0 = just born, 1 = about to die
 *   Random (float) — per-particle stable random value in [0, 1]
 */
export class ParticleInfo extends InputNode {
  get nodeType() { return 'ParticleInfo' }

  get metadata(): NodeMetadata {
    return { label: 'Particle Info', category: 'Input', color: '#3b5c3b', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('ParticleInfo')
    this._outputs = this.createOutputs({
      Index:  'float',
      Age:    'float',
      Random: 'float',
    })
  }

  getOutputSockets() { return this._outputs }

  vertexInjections() {
    return [
      { attrName: 'particleIndex',  attrType: 'float' as const, varyingName: 'vParticleIndex'  },
      { attrName: 'particleAge',    attrType: 'float' as const, varyingName: 'vParticleAge'    },
      { attrName: 'particleRandom', attrType: 'float' as const, varyingName: 'vParticleRandom' },
    ]
  }

  compileCall(ctx: CompileContext): string {
    return [
      `float ${ctx.outputVar(this, 'Index')}  = vParticleIndex;`,
      `float ${ctx.outputVar(this, 'Age')}    = vParticleAge;`,
      `float ${ctx.outputVar(this, 'Random')} = vParticleRandom;`,
    ].join('\n  ')
  }
}
