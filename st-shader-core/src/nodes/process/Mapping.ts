import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type MappingMode = 'TEXTURE' | 'POINT' | 'VECTOR' | 'NORMAL'

export interface MappingInputs {
  mode?:     MappingMode
  vector?:   OutputSocket
  location?: [number, number, number]
  rotation?: [number, number, number]  // degrees
  scale?:    [number, number, number]
}

/**
 * Mapping — Blender "Mapping" node equivalent.
 * Transforms UV/vector coordinates: translate, rotate, scale.
 *
 * Inputs:  vector, location, rotation (degrees), scale
 * Outputs: Vector (vector/color)
 */
export class Mapping extends ProcessNode {
  get nodeType() { return 'Mapping' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Mapping', category: 'Vector', color: '#4a3a8a', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_rotateX(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z);
}
vec3 _st_rotateY(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}
vec3 _st_rotateZ(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
}`

  private readonly mode: MappingMode
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: MappingInputs = {}) {
    super('Mapping')
    this.mode = inputs.mode ?? 'TEXTURE'
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector:   ['color', null],
      location: ['color', inputs.location ?? [0, 0, 0]],
      rotation: ['color', inputs.rotation ?? [0, 0, 0]],
      scale:    ['color', inputs.scale    ?? [1, 1, 1]],
    })
    this._outputs = this.createOutputs({ Vector: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Mapping.glslFunction }

  compileCall(ctx: CompileContext): string {
    const v     = ctx.resolveInput(this._inputs.vector)
    const loc   = ctx.resolveInput(this._inputs.location)
    const rot   = ctx.resolveInput(this._inputs.rotation)
    const scl   = ctx.resolveInput(this._inputs.scale)
    const out   = ctx.outputVar(this, 'Vector')
    const toRad = (Math.PI / 180).toFixed(6)

    return [
      `vec3 _mp_v_${this.id} = ${v};`,
      `vec3 _mp_r_${this.id} = ${rot} * ${toRad};`,
      `_mp_v_${this.id} = _mp_v_${this.id} - ${loc};`,
      `_mp_v_${this.id} = _st_rotateX(_mp_v_${this.id}, _mp_r_${this.id}.x);`,
      `_mp_v_${this.id} = _st_rotateY(_mp_v_${this.id}, _mp_r_${this.id}.y);`,
      `_mp_v_${this.id} = _st_rotateZ(_mp_v_${this.id}, _mp_r_${this.id}.z);`,
      `_mp_v_${this.id} = _mp_v_${this.id} * ${scl};`,
      `vec3 ${out} = _mp_v_${this.id};`,
    ].join('\n  ')
  }
}
