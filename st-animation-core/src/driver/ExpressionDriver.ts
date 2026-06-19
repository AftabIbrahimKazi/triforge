/**
 * ExpressionDriver — drives any numeric parameter with a math expression.
 * Blender: Drivers panel (F-Curve > Driver type: Scripted Expression).
 *
 * The expression is a JS math string that may reference:
 *   - `t`       — current time (seconds)
 *   - `v`       — current value of the target parameter at eval time
 *   - `frame`   — current frame (t * fps)
 *   - Any key from `variables` map passed in the constructor
 *   - All Math functions (sin, cos, abs, floor, ceil, etc.)
 *
 * Security: expressions are compiled with `new Function` in a closure that
 * only exposes the listed bindings — global scope is not accessible.
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
  private _fn:       ((math: typeof Math, t: number, v: number, frame: number, vars: Record<string, number>) => number) | null = null
  private _expr:     string

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
    const frame = t * this.parameters.fps
    const v     = this._target[this._prop] ?? 0
    this._target[this._prop] = this._fn(Math, t, v, frame, this.variables)
  }

  private _compile(expr: string): void {
    try {
      // Expose Math, t, v, frame, and each variable key
      const mathKeys = Object.getOwnPropertyNames(Math).join(',')
      // eslint-disable-next-line no-new-func
      this._fn = new Function(
        'Math', 't', 'v', 'frame', 'vars',
        // Expose all Math methods (sin, cos, abs, floor...) and custom vars as bare names
        `const {${mathKeys}} = Math;` +
        (Object.keys(this.variables).length ? `const {${Object.keys(this.variables).join(',')}} = vars;` : '') +
        `return (${expr});`,
      ) as unknown as (math: typeof Math, t: number, v: number, frame: number, vars: Record<string, number>) => number
    } catch {
      this._fn = null
    }
  }
}
