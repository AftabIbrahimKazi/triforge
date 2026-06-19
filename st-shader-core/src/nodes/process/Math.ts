import { ProcessNode } from '../../core/ProcessNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type MathMode =
  // Basic
  | 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE'
  | 'POWER' | 'LOGARITHM' | 'SQRT' | 'INV_SQRT' | 'ABSOLUTE'
  // Rounding
  | 'ROUND' | 'FLOOR' | 'CEIL' | 'TRUNCATE' | 'FRACTION'
  // Comparison
  | 'MINIMUM' | 'MAXIMUM' | 'LESS_THAN' | 'GREATER_THAN' | 'CLAMP' | 'SNAP'
  // Trig
  | 'SINE' | 'COSINE' | 'TANGENT' | 'ARCSINE' | 'ARCCOSINE' | 'ARCTANGENT' | 'ARCTAN2'
  // Special
  | 'MODULO' | 'WRAP' | 'PINGPONG' | 'SMOOTH_MIN' | 'SMOOTH_MAX'

export interface MathInputs {
  mode:   MathMode
  a?:     OutputSocket | number
  b?:     OutputSocket | number
  c?:     OutputSocket | number  // used by WRAP, SMOOTH_MIN, SMOOTH_MAX
  clamp?: boolean                // clamp output to [0,1]
}

/**
 * Math — Blender "Math" node equivalent.
 * Single node with mode selector covering all arithmetic, trig, and comparison ops.
 *
 * Inputs:  a, b (floats or connected sockets), c for ternary ops
 * Outputs: Value (float)
 *
 * @example
 * new Math({ mode: 'ADD',   a: noise.output('Fac'), b: 0.5 })
 * new Math({ mode: 'CLAMP', a: noise.output('Fac') })
 * new Math({ mode: 'SINE',  a: noise.output('Fac') })
 */
export class Math extends ProcessNode {
  get nodeType() { return 'Math' }
  static instanceSpecificDef = true  // each instance emits its own operation

  get metadata(): NodeMetadata {
    return {
      label:    'Math',
      category: 'Converter',
      color:    '#4a3a6a',
      cost:     'low',
    }
  }

  private readonly mode:  MathMode
  private readonly clamp: boolean
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: MathInputs) {
    super('Math')

    if (ShaderConfig.errorLevel !== 'off' && !inputs.mode) {
      ShaderNodeError.throw({
        nodeType: 'Math',
        nodeId:   this.id,
        problem:  'mode is required.',
        fix:      'new Math({ mode: "ADD", a: ..., b: ... })',
      })
    }

    this.mode  = inputs.mode
    this.clamp = inputs.clamp ?? false

    this._inputs  = this.createInputs(inputs as unknown as Record<string, unknown>, {
      a: ['float', inputs.a ?? 0.0],
      b: ['float', inputs.b ?? 0.0],
      c: ['float', inputs.c ?? 0.5],
    })
    this._outputs = this.createOutputs({ Value: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string { return '' }

  compileCall(ctx: CompileContext): string {
    const a   = ctx.resolveInput(this._inputs.a)
    const b   = ctx.resolveInput(this._inputs.b)
    const c   = ctx.resolveInput(this._inputs.c)
    const out = ctx.outputVar(this, 'Value')

    const expr = this.buildExpr(a, b, c)
    const final = this.clamp ? `clamp(${expr}, 0.0, 1.0)` : expr
    return `float ${out} = ${final};`
  }

  private buildExpr(a: string, b: string, c: string): string {
    switch (this.mode) {
      // Basic
      case 'ADD':        return `(${a} + ${b})`
      case 'SUBTRACT':   return `(${a} - ${b})`
      case 'MULTIPLY':   return `(${a} * ${b})`
      case 'DIVIDE':     return `(${b} != 0.0 ? ${a} / ${b} : 0.0)`
      case 'POWER':      return `pow(max(${a}, 0.0), ${b})`
      case 'LOGARITHM':  return `(${a} > 0.0 && ${b} > 0.0 ? log(${a}) / log(${b}) : 0.0)`
      case 'SQRT':       return `sqrt(max(${a}, 0.0))`
      case 'INV_SQRT':   return `(${a} > 0.0 ? 1.0 / sqrt(${a}) : 0.0)`
      case 'ABSOLUTE':   return `abs(${a})`
      // Rounding
      case 'ROUND':      return `floor(${a} + 0.5)`
      case 'FLOOR':      return `floor(${a})`
      case 'CEIL':       return `ceil(${a})`
      case 'TRUNCATE':   return `trunc(${a})`
      case 'FRACTION':   return `fract(${a})`
      // Comparison
      case 'MINIMUM':    return `min(${a}, ${b})`
      case 'MAXIMUM':    return `max(${a}, ${b})`
      case 'LESS_THAN':  return `(${a} < ${b} ? 1.0 : 0.0)`
      case 'GREATER_THAN': return `(${a} > ${b} ? 1.0 : 0.0)`
      case 'CLAMP':      return `clamp(${a}, ${b}, ${c})`
      case 'SNAP':       return `(${b} != 0.0 ? floor(${a} / ${b}) * ${b} : 0.0)`
      // Trig
      case 'SINE':       return `sin(${a})`
      case 'COSINE':     return `cos(${a})`
      case 'TANGENT':    return `tan(${a})`
      case 'ARCSINE':    return `asin(clamp(${a}, -1.0, 1.0))`
      case 'ARCCOSINE':  return `acos(clamp(${a}, -1.0, 1.0))`
      case 'ARCTANGENT': return `atan(${a})`
      case 'ARCTAN2':    return `atan(${a}, ${b})`
      // Special
      case 'MODULO':     return `(${b} != 0.0 ? mod(${a}, ${b}) : 0.0)`
      case 'WRAP':       return `(${c} != 0.0 ? mod(${a} - ${b}, ${c} - ${b}) + ${b} : ${b})`
      case 'PINGPONG':   return `(${b} != 0.0 ? abs(fract((${a} - ${b}) / (${b} * 2.0)) * ${b} * 2.0 - ${b}) : 0.0)`
      case 'SMOOTH_MIN': return `(exp(-${c} * ${a}) + exp(-${c} * ${b}) > 0.0 ? -log(exp(-${c} * ${a}) + exp(-${c} * ${b})) / max(${c}, 0.0001) : min(${a}, ${b}))`
      case 'SMOOTH_MAX': return `(exp(${c} * ${a}) + exp(${c} * ${b}) > 0.0 ? log(exp(${c} * ${a}) + exp(${c} * ${b})) / max(${c}, 0.0001) : max(${a}, ${b}))`
      default:           return `${a}`
    }
  }
}
