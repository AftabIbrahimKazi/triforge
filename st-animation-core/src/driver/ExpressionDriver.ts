import { compileExpression, type CompiledExpression } from './SafeExpression.js'

/**
 * ExpressionDriver — drives any numeric parameter with a math expression.
 * Blender: Drivers panel (F-Curve > Driver type: Scripted Expression).
 *
 * The expression is a math string that may reference:
 *   - `t`       — current time (seconds)
 *   - `v`       — current value of the target parameter at eval time
 *   - `frame`   — current frame (t * fps)
 *   - Any key from `variables` map passed in the constructor
 *   - Whitelisted Math functions (sin, cos, abs, floor, ceil, min, max, ...)
 *     and constants (PI, E, ...)
 *
 * Security: expressions are compiled by SafeExpression — a self-contained
 * math parser with a whitelist of functions/variables. Arbitrary JavaScript
 * (property access, assignment, globals) is a compile error, never executed.
 * This mirrors Blender, which likewise restricts scripted-expression drivers
 * to a safe namespace rather than evaluating arbitrary Python.
 *
 * Usage:
 *   const driver = new ExpressionDriver(mesh.rotation, 'y', 'sin(t * 2) * 0.5')
 *   // each frame:
 *   driver.update(clock.getElapsedTime())
 */
export interface ExpressionDriverOptions {
  /** Frames-per-second for `frame` variable. Default 60. */
  fps?: number
  /** Additional named variables passed to the expression. Default {}. */
  variables?: Record<string, number>
}

export class ExpressionDriver {
  parameters: {
    enabled: number
    fps:     number
  }

  /** Extra variables injected into expression scope. */
  variables: Record<string, number>

  private _target:   Record<string, number>
  private _prop:     string
  private _fn:       CompiledExpression | null = null
  private _expr:     string
  /** Reused per-frame scope object — no allocation inside update(). */
  private _scope:    Record<string, number> = { t: 0, v: 0, frame: 0 }

  constructor(
    target:     Record<string, number>,
    property:   string,
    expression: string,
    opts:       ExpressionDriverOptions = {},
  ) {
    this._target = target
    this._prop   = property
    this._expr   = expression

    this.parameters = {
      enabled: 1,
      fps:     opts.fps ?? 60,
    }
    this.variables = { ...(opts.variables ?? {}) }

    this._compile(expression)
  }

  /** Replace the expression at runtime. Re-compiles the function. */
  setExpression(expr: string): void {
    this._expr = expr
    this._compile(expr)
  }

  get expression(): string { return this._expr }

  /**
   * Evaluate the expression at time `t` and write the result to the target.
   * Call once per frame.
   */
  update(t: number): void {
    if (this.parameters.enabled < 0.5 || this._fn === null) return
    const scope = this._scope
    scope.t     = t
    scope.v     = this._target[this._prop] ?? 0
    scope.frame = t * this.parameters.fps
    for (const key in this.variables) {
      scope[key] = this.variables[key]
    }
    this._target[this._prop] = this._fn(scope)
  }

  private _compile(expr: string): void {
    try {
      this._fn = compileExpression(expr, ['t', 'v', 'frame', ...Object.keys(this.variables)])
    } catch {
      // Invalid expression → driver is inert (same behavior as before).
      this._fn = null
    }
  }
}
