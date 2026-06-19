import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

/** A curve point [x, y] where both x and y are in [0, 1]. */
export type CurvePoint = [number, number]

export interface RGBCurvesInputs {
  color?:  OutputSocket | string
  fac?:    OutputSocket | number
  /**
   * Per-channel piecewise linear curve as [[x,y], ...] control points.
   * Points are sorted by x automatically. Default = identity [[0,0],[1,1]].
   */
  rPoints?: CurvePoint[]
  gPoints?: CurvePoint[]
  bPoints?: CurvePoint[]
  /** Master curve applied after per-channel curves. Default = identity. */
  masterPoints?: CurvePoint[]
}

/**
 * RGB Curves — Blender "RGB Curves" node equivalent.
 * Full piecewise linear curve per channel (R, G, B) plus a master curve.
 * Matches Blender's RGB Curves node exactly — arbitrary control points,
 * piecewise linear interpolation between them.
 *
 * Inputs:  color, fac
 * Outputs: Color (color)
 */
export class RGBCurves extends ProcessNode {
  get nodeType() { return 'RGBCurves' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'RGB Curves', category: 'Color', color: '#633060', cost: 'low' }
  }

  private readonly rPts: CurvePoint[]
  private readonly gPts: CurvePoint[]
  private readonly bPts: CurvePoint[]
  private readonly mPts: CurvePoint[]
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: RGBCurvesInputs = {}) {
    super('RGBCurves')
    const identity: CurvePoint[] = [[0, 0], [1, 1]]
    this.rPts = sortPoints(inputs.rPoints      ?? identity)
    this.gPts = sortPoints(inputs.gPoints      ?? identity)
    this.bPts = sortPoints(inputs.bPoints      ?? identity)
    this.mPts = sortPoints(inputs.masterPoints ?? identity)
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color: ['color', '#ffffff'],
      fac:   ['float', inputs.fac ?? 1.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    // Emit one piecewise linear evaluator function per curve per instance
    return [
      buildCurveFn(`_rc_r_${this.id}`, this.rPts),
      buildCurveFn(`_rc_g_${this.id}`, this.gPts),
      buildCurveFn(`_rc_b_${this.id}`, this.bPts),
      buildCurveFn(`_rc_m_${this.id}`, this.mPts),
    ].join('\n')
  }

  compileCall(ctx: CompileContext): string {
    const col = ctx.resolveInput(this._inputs.color)
    const fac = ctx.resolveInput(this._inputs.fac)
    const id  = this.id
    const out = ctx.outputVar(this, 'Color')
    return [
      `vec3 _rc_${id} = ${col};`,
      // Per-channel curves
      `_rc_${id}.r = _rc_r_${id}(_rc_${id}.r);`,
      `_rc_${id}.g = _rc_g_${id}(_rc_${id}.g);`,
      `_rc_${id}.b = _rc_b_${id}(_rc_${id}.b);`,
      // Master curve applied to each channel
      `_rc_${id}.r = _rc_m_${id}(_rc_${id}.r);`,
      `_rc_${id}.g = _rc_m_${id}(_rc_${id}.g);`,
      `_rc_${id}.b = _rc_m_${id}(_rc_${id}.b);`,
      `vec3 ${out} = mix(${col}, clamp(_rc_${id}, 0.0, 1.0), clamp(${fac}, 0.0, 1.0));`,
    ].join('\n  ')
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function sortPoints(pts: CurvePoint[]): CurvePoint[] {
  return [...pts].sort((a, b) => a[0] - b[0])
}

function buildCurveFn(name: string, pts: CurvePoint[]): string {
  // No array initializers — GLSL ES 1.00 doesn't support float[n](...) syntax.
  // Generate a fully unrolled if/else chain with all values baked as literals.
  const f = (n: number) => n.toFixed(5)
  const clamps = `
  if (t <= ${f(pts[0][0])}) return ${f(pts[0][1])};
  if (t >= ${f(pts[pts.length-1][0])}) return ${f(pts[pts.length-1][1])};`
  const segments = pts.slice(0, -1).map((p, i) => {
    const x0 = f(p[0]),    y0 = f(p[1])
    const x1 = f(pts[i+1][0]), y1 = f(pts[i+1][1])
    return `  if (t <= ${x1}) return mix(${y0}, ${y1}, (t - ${x0}) / (${x1} - ${x0}));`
  }).join('\n')
  return `
float ${name}(float t) {${clamps}
${segments}
  return ${f(pts[pts.length-1][1])};
}`
}
