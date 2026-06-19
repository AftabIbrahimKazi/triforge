import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

/** A curve point [x, y]. */
export type VectorCurvePoint = [number, number]

export interface VectorCurvesInputs {
  vector?:  OutputSocket
  fac?:     OutputSocket | number
  /**
   * Per-axis piecewise linear curve as [[x,y], ...] control points.
   * Default = identity [[−1,−1],[1,1]] (maps full float range through unchanged).
   */
  xPoints?: VectorCurvePoint[]
  yPoints?: VectorCurvePoint[]
  zPoints?: VectorCurvePoint[]
}

/**
 * Vector Curves — Blender "Vector Curves" node equivalent.
 * Full piecewise linear curve per axis (X, Y, Z).
 * Matches Blender's Vector Curves node exactly — arbitrary control points,
 * piecewise linear interpolation. Input range is typically [−1, 1] for vectors.
 *
 * Inputs:  vector, fac
 * Outputs: Vector (color/vec3)
 */
export class VectorCurves extends ProcessNode {
  get nodeType() { return 'VectorCurves' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Vector Curves', category: 'Vector', color: '#4a3a8a', cost: 'low' }
  }

  private readonly xPts: VectorCurvePoint[]
  private readonly yPts: VectorCurvePoint[]
  private readonly zPts: VectorCurvePoint[]
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: VectorCurvesInputs = {}) {
    super('VectorCurves')
    // Default identity spans [−1, 1] to match Blender's vector curve range
    const identity: VectorCurvePoint[] = [[-1, -1], [1, 1]]
    this.xPts = sortPoints(inputs.xPoints ?? identity)
    this.yPts = sortPoints(inputs.yPoints ?? identity)
    this.zPts = sortPoints(inputs.zPoints ?? identity)
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector: ['color', null],
      fac:    ['float', inputs.fac ?? 1.0],
    })
    this._outputs = this.createOutputs({ Vector: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    return [
      buildCurveFn(`_vc_x_${this.id}`, this.xPts),
      buildCurveFn(`_vc_y_${this.id}`, this.yPts),
      buildCurveFn(`_vc_z_${this.id}`, this.zPts),
    ].join('\n')
  }

  compileCall(ctx: CompileContext): string {
    const vec = ctx.resolveInput(this._inputs.vector)
    const fac = ctx.resolveInput(this._inputs.fac)
    const id  = this.id
    const out = ctx.outputVar(this, 'Vector')
    return [
      `vec3 _vc_${id} = ${vec};`,
      `vec3 _vc_${id}_r = vec3(_vc_x_${id}(_vc_${id}.x), _vc_y_${id}(_vc_${id}.y), _vc_z_${id}(_vc_${id}.z));`,
      `vec3 ${out} = mix(${vec}, _vc_${id}_r, clamp(${fac}, 0.0, 1.0));`,
    ].join('\n  ')
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function sortPoints(pts: VectorCurvePoint[]): VectorCurvePoint[] {
  return [...pts].sort((a, b) => a[0] - b[0])
}

function buildCurveFn(name: string, pts: VectorCurvePoint[]): string {
  // No array initializers — GLSL ES 1.00 doesn't support float[n](...) syntax.
  const f = (n: number) => n.toFixed(5)
  const clamps = `
  if (t <= ${f(pts[0][0])}) return ${f(pts[0][1])};
  if (t >= ${f(pts[pts.length-1][0])}) return ${f(pts[pts.length-1][1])};`
  const segments = pts.slice(0, -1).map((p, i) => {
    const x0 = f(p[0]),        y0 = f(p[1])
    const x1 = f(pts[i+1][0]), y1 = f(pts[i+1][1])
    return `  if (t <= ${x1}) return mix(${y0}, ${y1}, (t - ${x0}) / (${x1} - ${x0}));`
  }).join('\n')
  return `
float ${name}(float t) {${clamps}
${segments}
  return ${f(pts[pts.length-1][1])};
}`
}
