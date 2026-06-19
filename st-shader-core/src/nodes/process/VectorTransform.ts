import { ProcessNode } from '../../core/ProcessNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type VectorTransformSpace = 'WORLD' | 'OBJECT' | 'CAMERA'
export type VectorTransformType  = 'VECTOR' | 'POINT' | 'NORMAL'

export interface VectorTransformInputs {
  vector?:   OutputSocket
  fromSpace?: VectorTransformSpace
  toSpace?:   VectorTransformSpace
  type?:      VectorTransformType
}

/**
 * Vector Transform — Blender "Vector Transform" node equivalent.
 * Transforms coordinates between World, Object, and Camera spaces.
 *
 * Inputs:  vector, fromSpace, toSpace, type
 * Outputs: Vector (color/vec3)
 */
export class VectorTransform extends ProcessNode {
  get nodeType() { return 'VectorTransform' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Vector Transform', category: 'Vector', color: '#4a3a8a', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_vectorTransform(vec3 v, int fromSpace, int toSpace, int vtype) {
  vec3 result = v;
  // World to Object: multiply by inverse model matrix (approximated)
  if (fromSpace == 0 && toSpace == 1) {
    result = (vec4(v, 0.0) * modelMatrix).xyz;
  } else if (fromSpace == 1 && toSpace == 0) {
    result = (modelMatrix * vec4(v, 0.0)).xyz;
  } else if (toSpace == 2) {
    result = (viewMatrix * vec4(result, 0.0)).xyz;
  } else if (fromSpace == 2) {
    result = (inverse(viewMatrix) * vec4(v, 0.0)).xyz;
  }
  if (vtype == 2) result = normalize(result);
  return result;
}`

  private readonly fromSpace: VectorTransformSpace
  private readonly toSpace:   VectorTransformSpace
  private readonly vtype:     VectorTransformType
  private readonly _inputs:   Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs:  Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: VectorTransformInputs = {}) {
    super('VectorTransform')
    this.fromSpace = inputs.fromSpace ?? 'WORLD'
    this.toSpace   = inputs.toSpace   ?? 'OBJECT'
    this.vtype     = inputs.type      ?? 'VECTOR'
    this._inputs   = this.createInputs(inputs as Record<string, unknown>, { vector: ['color', null] })
    this._outputs  = this.createOutputs({ Vector: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return VectorTransform.glslFunction }

  compileCall(ctx: CompileContext): string {
    const spaceMap: Record<VectorTransformSpace, number> = { WORLD: 0, OBJECT: 1, CAMERA: 2 }
    const typeMap:  Record<VectorTransformType, number>  = { VECTOR: 0, POINT: 1, NORMAL: 2 }
    const vec = ctx.resolveInput(this._inputs.vector)
    return `vec3 ${ctx.outputVar(this, 'Vector')} = _st_vectorTransform(${vec}, ${spaceMap[this.fromSpace]}, ${spaceMap[this.toSpace]}, ${typeMap[this.vtype]});`
  }
}
