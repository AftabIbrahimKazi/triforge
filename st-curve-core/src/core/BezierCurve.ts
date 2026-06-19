import { Vector3 } from 'three'
import { BaseCurve } from './BaseCurve.js'

/**
 * BezierCurve — cubic Bezier spline through one or more segments.
 * Blender: Bezier Curve spline type.
 *
 * Control points are stored as [anchor, handleRight, …, handleLeft, anchor] triplets.
 * Each segment is defined by: anchor0, handleRight0, handleLeft1, anchor1.
 *
 * For a single segment, 4 control points: p0, p1 (right handle of p0), p2 (left handle of p1), p3.
 * For N segments, 3N+1 points.
 */
export class BezierCurve extends BaseCurve {
  readonly curveType = 'BezierCurve'
  parameters: Record<string, number> = {}

  /** Flat array of control points: [p0, h0r, h1l, p1, h1r, h2l, p2, ...] */
  private _points: Vector3[]
  /** Whether the curve is closed (last point connects to first). */
  closed: boolean

  constructor(points: Vector3[], closed = false) {
    super()
    if (points.length < 4) throw new Error('BezierCurve requires at least 4 control points (1 segment)')
    this._points = points
    this.closed   = closed
  }

  get points(): readonly Vector3[] { return this._points }

  /** Number of Bezier segments. */
  get segmentCount(): number {
    return this.closed
      ? Math.floor(this._points.length / 3)
      : Math.floor((this._points.length - 1) / 3)
  }

  getPoint(t: number, target = new Vector3()): Vector3 {
    t = Math.max(0, Math.min(1, t))
    const segments = this.segmentCount
    const seg      = Math.min(Math.floor(t * segments), segments - 1)
    const local    = t * segments - seg

    const base = seg * 3
    const n    = this._points.length
    const p0   = this._points[base % n]
    const p1   = this._points[(base + 1) % n]
    const p2   = this._points[(base + 2) % n]
    const p3   = this._points[(base + 3) % n]

    return deCasteljau(p0, p1, p2, p3, local, target)
  }

  getTangent(t: number, target = new Vector3()): Vector3 {
    t = Math.max(0, Math.min(1, t))
    const segments = this.segmentCount
    const seg      = Math.min(Math.floor(t * segments), segments - 1)
    const local    = t * segments - seg

    const base = seg * 3
    const n    = this._points.length
    const p0   = this._points[base % n]
    const p1   = this._points[(base + 1) % n]
    const p2   = this._points[(base + 2) % n]
    const p3   = this._points[(base + 3) % n]

    return cubicBezierTangent(p0, p1, p2, p3, local, target)
  }
}

/** Cubic Bezier evaluation via de Casteljau (numerically stable). */
function deCasteljau(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, out: Vector3): Vector3 {
  const mt = 1 - t
  const x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x
  const y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
  const z = mt*mt*mt*p0.z + 3*mt*mt*t*p1.z + 3*mt*t*t*p2.z + t*t*t*p3.z
  return out.set(x, y, z)
}

/** Cubic Bezier derivative (tangent) — analytic. */
function cubicBezierTangent(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, out: Vector3): Vector3 {
  const mt = 1 - t
  const x = 3*(mt*mt*(p1.x-p0.x) + 2*mt*t*(p2.x-p1.x) + t*t*(p3.x-p2.x))
  const y = 3*(mt*mt*(p1.y-p0.y) + 2*mt*t*(p2.y-p1.y) + t*t*(p3.y-p2.y))
  const z = 3*(mt*mt*(p1.z-p0.z) + 2*mt*t*(p2.z-p1.z) + t*t*(p3.z-p2.z))
  const len = Math.sqrt(x*x+y*y+z*z) || 1
  return out.set(x/len, y/len, z/len)
}

/**
 * Build aligned-handle control points.
 * Blender: Aligned handle type — both handles share the same direction (mirrored).
 * The caller supplies the right handle for each anchor; the left handle is the mirror.
 *
 * @param anchors       Anchor positions (one per control point).
 * @param rightHandles  Right handle per anchor. Must be same length as anchors.
 * @param closed        Whether the curve closes back on the first anchor.
 * @returns Flat control-point array accepted by the BezierCurve constructor.
 */
export function buildAlignedHandles(
  anchors: Vector3[],
  rightHandles: Vector3[],
  closed = false,
): Vector3[] {
  const n = anchors.length
  if (n < 2) throw new Error('Need at least 2 anchor points')
  if (rightHandles.length !== n) throw new Error('rightHandles must have the same length as anchors')

  const pts: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const cur = anchors[i]
    const hr  = rightHandles[i]
    // Left handle is the mirror of the right handle across the anchor
    const hl  = new Vector3(
      2 * cur.x - hr.x,
      2 * cur.y - hr.y,
      2 * cur.z - hr.z,
    )

    if (i === 0) {
      pts.push(cur.clone(), hr.clone())
    } else if (i === n - 1 && !closed) {
      pts.push(hl, cur.clone())
    } else {
      pts.push(hl, cur.clone(), hr.clone())
    }
  }

  return pts
}

/**
 * Build vector-handle control points.
 * Blender: Vector handle type — each handle points straight toward the adjacent anchor.
 *
 * @param anchors Anchor positions.
 * @param closed  Whether the curve closes back on the first anchor.
 * @returns Flat control-point array accepted by the BezierCurve constructor.
 */
export function buildVectorHandles(anchors: Vector3[], closed = false): Vector3[] {
  const n = anchors.length
  if (n < 2) throw new Error('Need at least 2 anchor points')

  const pts: Vector3[] = []
  const scale = 1 / 3

  for (let i = 0; i < n; i++) {
    const cur  = anchors[i]
    const prev = anchors[(i - 1 + n) % n]
    const next = anchors[(i + 1) % n]

    const isFirst = !closed && i === 0
    const isLast  = !closed && i === n - 1

    // Right handle: points toward next anchor (or stays at cur for open-end last)
    const hr = isLast
      ? cur.clone()
      : new Vector3(
          cur.x + (next.x - cur.x) * scale,
          cur.y + (next.y - cur.y) * scale,
          cur.z + (next.z - cur.z) * scale,
        )

    // Left handle: points toward prev anchor (or stays at cur for open-end first)
    const hl = isFirst
      ? cur.clone()
      : new Vector3(
          cur.x + (prev.x - cur.x) * scale,
          cur.y + (prev.y - cur.y) * scale,
          cur.z + (prev.z - cur.z) * scale,
        )

    if (i === 0) {
      pts.push(cur.clone(), hr)
    } else if (i === n - 1 && !closed) {
      pts.push(hl, cur.clone())
    } else {
      pts.push(hl, cur.clone(), hr)
    }
  }

  return pts
}

/**
 * Build free-handle control points.
 * Blender: Free handle type — each handle is fully user-specified; no mirroring.
 *
 * @param anchors      Anchor positions.
 * @param leftHandles  Left (incoming) handle per anchor. Must be same length as anchors.
 * @param rightHandles Right (outgoing) handle per anchor. Must be same length as anchors.
 * @returns Flat control-point array accepted by the BezierCurve constructor.
 */
export function buildFreeHandles(
  anchors: Vector3[],
  leftHandles: Vector3[],
  rightHandles: Vector3[],
): Vector3[] {
  const n = anchors.length
  if (n < 2) throw new Error('Need at least 2 anchor points')
  if (leftHandles.length !== n || rightHandles.length !== n) {
    throw new Error('leftHandles and rightHandles must have the same length as anchors')
  }

  const pts: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const cur = anchors[i]
    const hr  = rightHandles[i]
    const hl  = leftHandles[i]

    if (i === 0) {
      pts.push(cur.clone(), hr.clone())
    } else if (i === n - 1) {
      pts.push(hl.clone(), cur.clone())
    } else {
      pts.push(hl.clone(), cur.clone(), hr.clone())
    }
  }

  return pts
}

/**
 * Build a smooth Bezier curve through a set of anchor points with auto-handles.
 * Blender: Smart Bezier / Auto handles.
 * Uses Catmull-Rom–style handle generation for smooth passage through all points.
 */
export function buildAutoHandles(anchors: Vector3[], closed = false, tension = 0.5): Vector3[] {
  const n = anchors.length
  if (n < 2) throw new Error('Need at least 2 anchor points')

  const pts: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const prev = anchors[(i - 1 + n) % n]
    const cur  = anchors[i]
    const next = anchors[(i + 1) % n]

    const isFirst = !closed && i === 0
    const isLast  = !closed && i === n - 1

    // Tangent direction: difference of neighbours
    const dx = isFirst ? (next.x - cur.x) : isLast ? (cur.x - prev.x) : (next.x - prev.x) * tension
    const dy = isFirst ? (next.y - cur.y) : isLast ? (cur.y - prev.y) : (next.y - prev.y) * tension
    const dz = isFirst ? (next.z - cur.z) : isLast ? (cur.z - prev.z) : (next.z - prev.z) * tension

    const scale = 1 / 3

    // Left handle (incoming)
    const hl = new Vector3(cur.x - dx * scale, cur.y - dy * scale, cur.z - dz * scale)
    // Right handle (outgoing)
    const hr = new Vector3(cur.x + dx * scale, cur.y + dy * scale, cur.z + dz * scale)

    if (i === 0) {
      pts.push(cur.clone(), hr)
    } else if (i === n - 1) {
      pts.push(hl, cur.clone())
    } else {
      pts.push(hl, cur.clone(), hr)
    }
  }

  return pts
}
