import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { GeometryNode, OutputRef, type Inputs, type SocketValue } from '../../core/GeometryNode.js'

type CurveLike = {
  getPoint(t: number, target?: Vector3): Vector3
  getTangent?(t: number, target?: Vector3): Vector3
}

/**
 * CurveToMesh — extrude a circle cross-section along a curve.
 * Blender: Geometry Nodes > Curve > Curve to Mesh
 *
 * Accepts any object with a `getPoint(t)` method — compatible with
 * st-curve-core's BezierCurve, NURBSCurve, and CatmullRomCurve.
 *
 * No hard import from st-curve-core — pass the curve as a plain value.
 */
export class CurveToMesh extends GeometryNode {
  readonly nodeType = 'CurveToMesh'

  parameters: {
    /** Tube cross-section radius. Blender: Fill Caps > Radius. Default 0.1. */
    radius: number
    /** Rings along the tube. Blender: Resolution U. Default 32. */
    tubularSegments: number
    /** Sides per ring. Blender: Resolution V. Default 8. */
    radialSegments: number
  }

  constructor(opts: {
    curve?:           OutputRef | CurveLike | null
    radius?:          number
    tubularSegments?: number
    radialSegments?:  number
  } = {}) {
    super()
    this.parameters = {
      radius:          opts.radius          ?? 0.1,
      tubularSegments: opts.tubularSegments ?? 32,
      radialSegments:  opts.radialSegments  ?? 8,
    }
    if (opts.curve != null) this._inputs.curve = opts.curve as OutputRef | SocketValue
  }

  _evaluate(inputs: Inputs): Record<string, SocketValue> {
    const curve = inputs.curve as CurveLike | null
    if (!curve || typeof curve.getPoint !== 'function') return { Geometry: null }

    const { radius, tubularSegments, radialSegments } = this.parameters
    return { Geometry: curveToMesh(curve, radius, tubularSegments, radialSegments) }
  }
}

function curveToMesh(
  curve: CurveLike,
  radius: number,
  tubeSegs: number,
  radialSegs: number,
): BufferGeometry {
  const frames = computeRMF(curve, tubeSegs + 1)
  const vCount = (tubeSegs + 1) * (radialSegs + 1)
  const pos = new Float32Array(vCount * 3)
  const nor = new Float32Array(vCount * 3)
  const uvs = new Float32Array(vCount * 2)

  let vi = 0, ui = 0
  for (let i = 0; i <= tubeSegs; i++) {
    const { position: p, normal: n, binormal: b } = frames[i]
    const u = i / tubeSegs
    for (let j = 0; j <= radialSegs; j++) {
      const angle = (j / radialSegs) * Math.PI * 2
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const nx = n.x*cos + b.x*sin
      const ny = n.y*cos + b.y*sin
      const nz = n.z*cos + b.z*sin
      pos[vi]=p.x+nx*radius; pos[vi+1]=p.y+ny*radius; pos[vi+2]=p.z+nz*radius
      nor[vi]=nx; nor[vi+1]=ny; nor[vi+2]=nz
      uvs[ui]=u; uvs[ui+1]=j/radialSegs
      vi+=3; ui+=2
    }
  }

  const idxArr: number[] = []
  for (let i = 0; i < tubeSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = (radialSegs+1)*i+j
      const b = (radialSegs+1)*(i+1)+j
      const c = (radialSegs+1)*(i+1)+j+1
      const d = (radialSegs+1)*i+j+1
      idxArr.push(a,b,d, b,c,d)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('normal',   new BufferAttribute(nor, 3))
  geo.setAttribute('uv',       new BufferAttribute(uvs, 2))
  geo.setIndex(idxArr)
  return geo
}

// Minimal rotation-minimizing frames (double reflection method)
function computeRMF(curve: CurveLike, count: number) {
  const frames: { position: Vector3; tangent: Vector3; normal: Vector3; binormal: Vector3 }[] = []
  const step = 1 / (count - 1)

  // Seed first frame
  const p0 = curve.getPoint(0)
  const t0 = getTangent(curve, 0)
  const n0 = perpendicular(t0)
  const b0 = new Vector3().crossVectors(t0, n0).normalize()
  frames.push({ position: p0, tangent: t0, normal: n0, binormal: b0 })

  for (let i = 1; i < count; i++) {
    const t_ = i * step
    const p1 = curve.getPoint(t_)
    const t1 = getTangent(curve, t_)
    const prev = frames[i-1]
    // Double reflection
    const v1 = p1.clone().sub(prev.position)
    const c1 = v1.dot(v1)
    const riL = c1 > 1e-10 ? prev.normal.clone().sub(v1.clone().multiplyScalar(2/c1 * v1.dot(prev.normal))) : prev.normal.clone()
    const tiL = c1 > 1e-10 ? prev.tangent.clone().sub(v1.clone().multiplyScalar(2/c1 * v1.dot(prev.tangent))) : prev.tangent.clone()
    const v2 = t1.clone().sub(tiL)
    const c2 = v2.dot(v2)
    const n1 = c2 > 1e-10 ? riL.clone().sub(v2.clone().multiplyScalar(2/c2 * v2.dot(riL))) : riL.clone()
    n1.normalize()
    const b1 = new Vector3().crossVectors(t1, n1).normalize()
    frames.push({ position: p1, tangent: t1, normal: n1, binormal: b1 })
  }
  return frames
}

function getTangent(curve: CurveLike, t: number): Vector3 {
  if (curve.getTangent) return curve.getTangent(t).clone().normalize()
  const eps = 0.0001
  const a = curve.getPoint(Math.max(0, t - eps))
  const b = curve.getPoint(Math.min(1, t + eps))
  return b.clone().sub(a).normalize()
}

function perpendicular(v: Vector3): Vector3 {
  const u = new Vector3(1,0,0)
  if (Math.abs(v.dot(u)) > 0.9) u.set(0,1,0)
  return u.clone().sub(v.clone().multiplyScalar(v.dot(u))).normalize()
}
