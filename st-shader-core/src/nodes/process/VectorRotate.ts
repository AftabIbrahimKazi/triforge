import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type VectorRotateMode = 'AXIS_ANGLE' | 'X_AXIS' | 'Y_AXIS' | 'Z_AXIS' | 'EULER_XYZ'

export interface VectorRotateInputs {
  vector?: OutputSocket
  center?: OutputSocket | [number, number, number]
  axis?:   OutputSocket | [number, number, number]
  angle?:  OutputSocket | number  // radians
  mode?:   VectorRotateMode
}

/**
 * Vector Rotate — Blender "Vector Rotate" node equivalent.
 * Rotates a vector around an axis or by Euler angles.
 *
 * Inputs:  vector, center, axis, angle (radians)
 * Outputs: Vector (color/vec3)
 */
export class VectorRotate extends ProcessNode {
  get nodeType() { return 'VectorRotate' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Vector Rotate', category: 'Vector', color: '#4a3a8a', cost: 'low' }
  }

  static glslFunction = `
vec3 _st_rotateAxisAngle(vec3 v, vec3 axis, float angle) {
  float c = cos(angle), s = sin(angle);
  axis = normalize(axis);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}`

  private readonly mode: VectorRotateMode
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: VectorRotateInputs = {}) {
    super('VectorRotate')
    this.mode    = inputs.mode ?? 'AXIS_ANGLE'
    this._inputs = this.createInputs(inputs as unknown as Record<string, unknown>, {
      vector: ['color', null],
      center: ['color', null],
      axis:   ['color', null],
      angle:  ['float', inputs.angle ?? 0.0],
    })
    this._outputs = this.createOutputs({ Vector: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return VectorRotate.glslFunction }

  compileCall(ctx: CompileContext): string {
    const vec   = ctx.resolveInput(this._inputs.vector)
    const angle = ctx.resolveInput(this._inputs.angle)
    const out   = ctx.outputVar(this, 'Vector')

    switch (this.mode) {
      case 'X_AXIS':
        return `vec3 ${out} = _st_rotateAxisAngle(${vec}, vec3(1,0,0), ${angle});`
      case 'Y_AXIS':
        return `vec3 ${out} = _st_rotateAxisAngle(${vec}, vec3(0,1,0), ${angle});`
      case 'Z_AXIS':
        return `vec3 ${out} = _st_rotateAxisAngle(${vec}, vec3(0,0,1), ${angle});`
      default: {
        const axis = ctx.resolveInput(this._inputs.axis)
        return `vec3 ${out} = _st_rotateAxisAngle(${vec}, ${axis}, ${angle});`
      }
    }
  }
}
