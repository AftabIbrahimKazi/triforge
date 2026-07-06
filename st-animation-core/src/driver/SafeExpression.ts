/**
 * SafeExpression — a small, self-contained math-expression compiler used by
 * ExpressionDriver instead of `new Function()` (which is banned ecosystem-wide:
 * a Function body runs in global scope, so a hostile expression string — e.g.
 * one loaded from a scene file — would be arbitrary code execution).
 *
 * Supports exactly the surface Blender scripted-expression drivers need:
 *   numbers, + - * / % ** parentheses, unary -/+/!,
 *   comparisons (< <= > >= == !=), && || , ternary ?:,
 *   whitelisted Math functions (sin, cos, abs, floor, ...), Math constants
 *   (PI, E, ...), and named scalar variables supplied at eval time.
 *
 * The expression is parsed ONCE into a closure tree (no string work or
 * allocation at eval time), so per-frame evaluation cost is comparable to the
 * previous Function-based approach.
 */

export type CompiledExpression = (scope: Record<string, number>) => number

type EvalFn = (scope: Record<string, number>) => number

// Whitelisted Math members. Anything not listed is a compile error.
const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs, acos: Math.acos, acosh: Math.acosh, asin: Math.asin,
  asinh: Math.asinh, atan: Math.atan, atan2: Math.atan2, atanh: Math.atanh,
  cbrt: Math.cbrt, ceil: Math.ceil, cos: Math.cos, cosh: Math.cosh,
  exp: Math.exp, expm1: Math.expm1, floor: Math.floor, fround: Math.fround,
  hypot: Math.hypot, log: Math.log, log10: Math.log10, log1p: Math.log1p,
  log2: Math.log2, max: Math.max, min: Math.min, pow: Math.pow,
  random: Math.random, round: Math.round, sign: Math.sign, sin: Math.sin,
  sinh: Math.sinh, sqrt: Math.sqrt, tan: Math.tan, tanh: Math.tanh,
  trunc: Math.trunc,
}

const MATH_CONSTANTS: Record<string, number> = {
  PI: Math.PI, E: Math.E, LN2: Math.LN2, LN10: Math.LN10,
  LOG2E: Math.LOG2E, LOG10E: Math.LOG10E, SQRT1_2: Math.SQRT1_2, SQRT2: Math.SQRT2,
}

interface Token {
  type: 'number' | 'identifier' | 'operator'
  value: string
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue }

    if ((ch >= '0' && ch <= '9') || (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      let j = i
      while (j < src.length && /[0-9.eE]/.test(src[j])) {
        // allow exponent sign directly after e/E
        if ((src[j] === 'e' || src[j] === 'E') && (src[j + 1] === '+' || src[j + 1] === '-')) j++
        j++
      }
      tokens.push({ type: 'number', value: src.slice(i, j) })
      i = j
      continue
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      tokens.push({ type: 'identifier', value: src.slice(i, j) })
      i = j
      continue
    }

    // multi-char operators first
    const three = src.slice(i, i + 3)
    const two = src.slice(i, i + 2)
    if (two === '**' || two === '<=' || two === '>=' || two === '==' || two === '!=' || two === '&&' || two === '||') {
      // '===' / '!==' are accepted as their loose forms for convenience
      if (three === '===' || three === '!==') {
        tokens.push({ type: 'operator', value: three.slice(0, 2) })
        i += 3
      } else {
        tokens.push({ type: 'operator', value: two })
        i += 2
      }
      continue
    }
    if ('+-*/%()<>?:,!'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch })
      i++
      continue
    }

    throw new Error(`SafeExpression: unexpected character "${ch}" at position ${i}`)
  }
  return tokens
}

/**
 * Recursive-descent parser producing a closure tree. Precedence (low → high):
 * ternary → || → && → equality → comparison → additive → multiplicative →
 * unary → exponent → call/primary.
 */
class Parser {
  private pos = 0
  constructor(private readonly tokens: Token[], private readonly knownVariables: ReadonlySet<string>) {}

  parse(): EvalFn {
    const fn = this.parseTernary()
    if (this.pos !== this.tokens.length) {
      throw new Error(`SafeExpression: unexpected token "${this.tokens[this.pos].value}"`)
    }
    return fn
  }

  private peek(): Token | undefined { return this.tokens[this.pos] }

  private eatOperator(value: string): boolean {
    const t = this.peek()
    if (t && t.type === 'operator' && t.value === value) { this.pos++; return true }
    return false
  }

  private expectOperator(value: string): void {
    if (!this.eatOperator(value)) {
      throw new Error(`SafeExpression: expected "${value}"`)
    }
  }

  private parseTernary(): EvalFn {
    const cond = this.parseOr()
    if (this.eatOperator('?')) {
      const thenFn = this.parseTernary()
      this.expectOperator(':')
      const elseFn = this.parseTernary()
      return (s) => (cond(s) !== 0 ? thenFn(s) : elseFn(s))
    }
    return cond
  }

  private parseOr(): EvalFn {
    let left = this.parseAnd()
    while (this.eatOperator('||')) {
      const right = this.parseAnd()
      const l = left
      left = (s) => (l(s) !== 0 || right(s) !== 0 ? 1 : 0)
    }
    return left
  }

  private parseAnd(): EvalFn {
    let left = this.parseEquality()
    while (this.eatOperator('&&')) {
      const right = this.parseEquality()
      const l = left
      left = (s) => (l(s) !== 0 && right(s) !== 0 ? 1 : 0)
    }
    return left
  }

  private parseEquality(): EvalFn {
    let left = this.parseComparison()
    for (;;) {
      if (this.eatOperator('==')) {
        const right = this.parseComparison(); const l = left
        left = (s) => (l(s) === right(s) ? 1 : 0)
      } else if (this.eatOperator('!=')) {
        const right = this.parseComparison(); const l = left
        left = (s) => (l(s) !== right(s) ? 1 : 0)
      } else return left
    }
  }

  private parseComparison(): EvalFn {
    let left = this.parseAdditive()
    for (;;) {
      if (this.eatOperator('<=')) {
        const right = this.parseAdditive(); const l = left
        left = (s) => (l(s) <= right(s) ? 1 : 0)
      } else if (this.eatOperator('>=')) {
        const right = this.parseAdditive(); const l = left
        left = (s) => (l(s) >= right(s) ? 1 : 0)
      } else if (this.eatOperator('<')) {
        const right = this.parseAdditive(); const l = left
        left = (s) => (l(s) < right(s) ? 1 : 0)
      } else if (this.eatOperator('>')) {
        const right = this.parseAdditive(); const l = left
        left = (s) => (l(s) > right(s) ? 1 : 0)
      } else return left
    }
  }

  private parseAdditive(): EvalFn {
    let left = this.parseMultiplicative()
    for (;;) {
      if (this.eatOperator('+')) {
        const right = this.parseMultiplicative(); const l = left
        left = (s) => l(s) + right(s)
      } else if (this.eatOperator('-')) {
        const right = this.parseMultiplicative(); const l = left
        left = (s) => l(s) - right(s)
      } else return left
    }
  }

  private parseMultiplicative(): EvalFn {
    let left = this.parseUnary()
    for (;;) {
      if (this.eatOperator('*')) {
        const right = this.parseUnary(); const l = left
        left = (s) => l(s) * right(s)
      } else if (this.eatOperator('/')) {
        const right = this.parseUnary(); const l = left
        left = (s) => l(s) / right(s)
      } else if (this.eatOperator('%')) {
        const right = this.parseUnary(); const l = left
        left = (s) => l(s) % right(s)
      } else return left
    }
  }

  private parseUnary(): EvalFn {
    if (this.eatOperator('-')) {
      const operand = this.parseUnary()
      return (s) => -operand(s)
    }
    if (this.eatOperator('+')) {
      return this.parseUnary()
    }
    if (this.eatOperator('!')) {
      const operand = this.parseUnary()
      return (s) => (operand(s) === 0 ? 1 : 0)
    }
    return this.parseExponent()
  }

  private parseExponent(): EvalFn {
    const base = this.parsePrimary()
    // right-associative
    if (this.eatOperator('**')) {
      const exp = this.parseUnary()
      return (s) => Math.pow(base(s), exp(s))
    }
    return base
  }

  private parsePrimary(): EvalFn {
    const token = this.peek()
    if (!token) throw new Error('SafeExpression: unexpected end of expression')

    if (token.type === 'number') {
      this.pos++
      const value = Number(token.value)
      if (!Number.isFinite(value)) throw new Error(`SafeExpression: invalid number "${token.value}"`)
      return () => value
    }

    if (this.eatOperator('(')) {
      const inner = this.parseTernary()
      this.expectOperator(')')
      return inner
    }

    if (token.type === 'identifier') {
      this.pos++
      const name = token.value

      // Function call?
      if (this.eatOperator('(')) {
        const fn = MATH_FUNCTIONS[name]
        if (!fn) throw new Error(`SafeExpression: unknown function "${name}"`)
        const args: EvalFn[] = []
        if (!this.eatOperator(')')) {
          do { args.push(this.parseTernary()) } while (this.eatOperator(','))
          this.expectOperator(')')
        }
        // Specialize common arities to avoid per-eval array allocation.
        if (args.length === 0) return () => fn()
        if (args.length === 1) { const a0 = args[0]; return (s) => fn(a0(s)) }
        if (args.length === 2) { const a0 = args[0], a1 = args[1]; return (s) => fn(a0(s), a1(s)) }
        return (s) => fn(...args.map((a) => a(s)))
      }

      if (name in MATH_CONSTANTS) {
        const value = MATH_CONSTANTS[name]
        return () => value
      }

      if (!this.knownVariables.has(name)) {
        throw new Error(`SafeExpression: unknown variable "${name}"`)
      }
      return (s) => s[name] ?? 0
    }

    throw new Error(`SafeExpression: unexpected token "${token.value}"`)
  }
}

/**
 * Compile an expression string into an evaluator over the named scalar
 * variables. Throws on any syntax error or reference to an unknown
 * identifier — never executes arbitrary code.
 */
export function compileExpression(expression: string, variableNames: Iterable<string>): CompiledExpression {
  const known = new Set(variableNames)
  const tokens = tokenize(expression)
  return new Parser(tokens, known).parse()
}
