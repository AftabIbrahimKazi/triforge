import { ProcessNode } from '../../core/ProcessNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type VectorMathMode =
  | 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE'
  | 'SCALE' | 'LENGTH' | 'NORMALIZE'
  | 'DOT_PRODUCT' | 'CROSS_PRODUCT'
  | 'REFLECT' | 'REFRACT'
  | 'ABSOLUTE' | 'MINIMUM' | 'MAXIMUM'
  | 'FLOOR' | 'CEIL' | 'FRACTION' | 'MODULO' | 'SNAP'
  | 'SINE' | 'COSINE' | 'TANGENT'
  | 'DISTANCE'

export interface VectorMathInputs {
  mode:    VectorMathMode
  vector?: OutputSocket | [number, number, number]
  vectorB?: OutputSocket | [number, number, number]
  scale?:  OutputSocket | number
}

/**
 * Vector Math — Blender "Vector Math" node equivalent.
 * Operates on vec3 values with a mode selector.
 *
 * Inputs:  vector, vectorB, scale
 * Outputs: Vector (vector/color), Value (float — for scalar results)
 *
 * @example
 * new VectorMath({ mode: 'NORMALIZE', vector: normal.output('Normal') })
 * new VectorMath({ mode: 'DOT_PRODUCT', vector: a.output('Normal'), vectorB: b.output('Normal') })
 */
export class VectorMath extends ProcessNode {
  get nodeType() { return 'VectorMath' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return {
      label:    'Vector Math',
      category: 'Converter',
      color:    '#4a3a6a',
      cost:     'low',
    }
  }

  private readonly mode: VectorMathMode
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: VectorMathInputs) {
    super('VectorMath')

    if (ShaderConfig.errorLevel !== 'off' && !inputs.mode) {
      ShaderNodeError.throw({
        nodeType: 'VectorMath',
        nodeId:   this.id,
        problem:  'mode is required.',
        fix:      'new VectorMath({ mode: "NORMALIZE", vector: ... })',
      })
    }

    this.mode = inputs.mode

    const vecDefault  = inputs.vector  instanceof Array ? inputs.vector  : [0, 0, 0]
    const vecBDefault = inputs.vectorB instanceof Array ? inputs.vectorB : [0, 0, 0]

    this._inputs = this.createInputs(inputs as unknown as Record<string, unknown>, {
      vector:  ['color', vecDefault],
      vectorB: ['color', vecBDefault],
      scale:   ['float', inputs.scale ?? 1.0],
    })

    if (inputs.vector  && !(inputs.vector  instanceof Array)) this._inputs.vector.connection  = inputs.vector  as OutputSocket
    if (inputs.vectorB && !(inputs.vectorB instanceof Array)) this._inputs.vectorB.connection = inputs.vectorB as OutputSocket

    this._outputs = this.createOutputs({ Vector: 'color', Value: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return '' }

  compileCall(ctx: CompileContext): string {
    const v   = ctx.resolveInput(this._inputs.vector)
    const vb  = ctx.resolveInput(this._inputs.vectorB)
    const s   = ctx.resolveInput(this._inputs.scale)
    const vOut = ctx.outputVar(this, 'Vector')
    const fOut = ctx.outputVar(this, 'Value')

    const scalarModes = ['DOT_PRODUCT', 'LENGTH', 'DISTANCE']
    const isScalar    = scalarModes.includes(this.mode)

    const lines: string[] = []

    if (isScalar) {
      lines.push(`float ${fOut} = ${this.buildScalar(v, vb, s)};`)
      lines.push(`vec3  ${vOut} = vec3(${fOut});`)
    } else {
      lines.push(`vec3  ${vOut} = ${this.buildVector(v, vb, s)};`)
      lines.push(`float ${fOut} = length(${vOut});`)
    }

    return lines.join('\n  ')
  }

  private buildVector(v: string, vb: string, s: string): string {
    switch (this.mode) {
      case 'ADD':       return `(${v} + ${vb})`
      case 'SUBTRACT':  return `(${v} - ${vb})`
      case 'MULTIPLY':  return `(${v} * ${vb})`
      case 'DIVIDE':    return `(vec3(${vb}.x != 0.0 ? ${v}.x / ${vb}.x : 0.0, ${vb}.y != 0.0 ? ${v}.y / ${vb}.y : 0.0, ${vb}.z != 0.0 ? ${v}.z / ${vb}.z : 0.0))`
      case 'SCALE':     return `(${v} * ${s})`
      case 'NORMALIZE': return `normalize(${v})`
      case 'REFLECT':   return `reflect(${v}, normalize(${vb}))`
      case 'REFRACT':   return `refract(normalize(${v}), normalize(${vb}), ${s})`
      case 'CROSS_PRODUCT': return `cross(${v}, ${vb})`
      case 'ABSOLUTE':  return `abs(${v})`
      case 'MINIMUM':   return `min(${v}, ${vb})`
      case 'MAXIMUM':   return `max(${v}, ${vb})`
      case 'FLOOR':     return `floor(${v})`
      case 'CEIL':      return `ceil(${v})`
      case 'FRACTION':  return `fract(${v})`
      case 'MODULO':    return `mod(${v}, ${vb})`
      case 'SNAP':      return `(floor(${v} / ${vb}) * ${vb})`
      case 'SINE':      return `sin(${v})`
      case 'COSINE':    return `cos(${v})`
      case 'TANGENT':   return `tan(${v})`
      default:          return v
    }
  }

  private buildScalar(v: string, vb: string, _s: string): string {
    switch (this.mode) {
      case 'DOT_PRODUCT': return `dot(${v}, ${vb})`
      case 'LENGTH':      return `length(${v})`
      case 'DISTANCE':    return `distance(${v}, ${vb})`
      default:            return '0.0'
    }
  }
}
