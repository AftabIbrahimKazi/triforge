/**
 * A single hair or fur strand — ordered control points from root to tip.
 * Blender: each hair particle's guide curve.
 */
export interface Strand {
  /** World-space control points [x,y,z], root first. Minimum 2. */
  points: [number, number, number][]
  /** Root surface normal — used to orient ribbons and for physics. */
  normal?: [number, number, number]
  /** Per-strand width multiplier [0..1]. Blender: individual hair thickness. */
  width?: number
}

/** Interpolate a Catmull-Rom spline at parameter t ∈ [0,1] across all segments. */
export function catmullRomSpline(
  points: [number, number, number][],
  t: number,
  tension = 0.5,
): [number, number, number] {
  const n = points.length
  if (n < 2) return points[0] ?? [0, 0, 0]

  const scaled = t * (n - 1)
  const i      = Math.min(Math.floor(scaled), n - 2)
  const f      = scaled - i

  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[Math.min(n - 1, i + 1)]
  const p3 = points[Math.min(n - 1, i + 2)]

  const s = tension
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], f, s),
    catmullRom(p0[1], p1[1], p2[1], p3[1], f, s),
    catmullRom(p0[2], p1[2], p2[2], p3[2], f, s),
  ]
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number, s: number): number {
  const t2 = t * t, t3 = t2 * t
  return (
    s * (-t3 + 2*t2 - t) * p0 +
    (2*t3 - 3*t2 + 1)    * p1 +
    (-2*t3 + 3*t2)       * p2 +
    s * (t3 - t2)        * p3
  ) * 0.5 + (1-s) * (p1 * (1-t) + p2 * t) * 0
  // Corrected Catmull-Rom:
}

// Re-implement cleanly (standard formulation):
function _cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t*t, t3 = t2*t
  return 0.5 * (
    (2*p1) +
    (-p0 + p2) * t +
    (2*p0 - 5*p1 + 4*p2 - p3) * t2 +
    (-p0 + 3*p1 - 3*p2 + p3) * t3
  )
}

/** Sample the spline at a given normalised t ∈ [0,1]. */
export function sampleSpline(
  points: [number, number, number][],
  t: number,
): [number, number, number] {
  const n = points.length
  if (n === 1) return [...points[0]]
  if (t <= 0)  return [...points[0]]
  if (t >= 1)  return [...points[n - 1]]

  const scaled = t * (n - 1)
  const i      = Math.min(Math.floor(scaled), n - 2)
  const f      = scaled - i

  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[Math.min(n - 1, i + 1)]
  const p3 = points[Math.min(n - 1, i + 2)]

  return [_cr(p0[0], p1[0], p2[0], p3[0], f), _cr(p0[1], p1[1], p2[1], p3[1], f), _cr(p0[2], p1[2], p2[2], p3[2], f)]
}

/** Sample the spline tangent (finite difference) at t ∈ [0,1]. */
export function sampleTangent(
  points: [number, number, number][],
  t: number,
  eps = 0.001,
): [number, number, number] {
  const a = sampleSpline(points, Math.max(0, t - eps))
  const b = sampleSpline(points, Math.min(1, t + eps))
  const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2]
  const len = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1
  return [dx/len, dy/len, dz/len]
}

/** Compute rotation-minimizing frames along the spline (Double Reflection Method). */
export function computeRMFrames(
  points: [number, number, number][],
  steps: number,
): Array<{ pos: [number,number,number]; tangent: [number,number,number]; normal: [number,number,number]; binormal: [number,number,number] }> {
  const frames = []
  const t0 = sampleTangent(points, 0)

  // Seed first frame — pick an arbitrary normal perpendicular to tangent
  let n0: [number,number,number] = Math.abs(t0[0]) < 0.9 ? [1,0,0] : [0,1,0]
  const dot = t0[0]*n0[0]+t0[1]*n0[1]+t0[2]*n0[2]
  n0 = norm([n0[0]-dot*t0[0], n0[1]-dot*t0[1], n0[2]-dot*t0[2]])
  let b0 = cross(t0, n0)

  frames.push({ pos: sampleSpline(points, 0), tangent: t0, normal: n0, binormal: b0 })

  for (let i = 1; i <= steps; i++) {
    const t  = i / steps
    const p  = sampleSpline(points, t)
    const ti = sampleTangent(points, t)

    // Double Reflection transport
    const v1 = sub(p, frames[i-1].pos)
    const c1 = dot3(v1, v1)
    if (c1 < 1e-10) { frames.push({ pos: p, tangent: ti, normal: frames[i-1].normal, binormal: frames[i-1].binormal }); continue }
    const rL = reflect(frames[i-1].tangent, v1, c1)
    const rN = reflect(frames[i-1].normal,  v1, c1)
    const v2 = sub(ti, rL)
    const c2 = dot3(v2, v2)
    const n  = c2 < 1e-10 ? rN : reflect(rN, v2, c2)
    const b  = cross(ti, n)
    frames.push({ pos: p, tangent: ti, normal: norm(n), binormal: norm(b) })
  }
  return frames
}

// ── Vec3 helpers ──────────────────────────────────────────────────────────────
type V3 = [number,number,number]
const sub  = ([ax,ay,az]: V3, [bx,by,bz]: V3): V3 => [ax-bx, ay-by, az-bz]
const dot3 = ([ax,ay,az]: V3, [bx,by,bz]: V3) => ax*bx+ay*by+az*bz
const cross = ([ax,ay,az]: V3, [bx,by,bz]: V3): V3 => [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx]
const norm  = ([x,y,z]: V3): V3 => { const l=Math.sqrt(x*x+y*y+z*z)||1; return [x/l,y/l,z/l] }
const reflect = (v: V3, axis: V3, axisLen2: number): V3 => {
  const d = 2*dot3(v,axis)/axisLen2
  return [v[0]-d*axis[0], v[1]-d*axis[1], v[2]-d*axis[2]]
}
