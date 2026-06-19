import { BufferGeometry, BufferAttribute, Vector3 } from 'three'
import type { RadiusFunction, HeightFunction, RadiusGeometryOptions, GeometryStats } from '../types/index.js'

export class RadiusParametricGeometry extends BufferGeometry {
  private radiusFunction: RadiusFunction
  private heightFunction: HeightFunction
  private options: Required<RadiusGeometryOptions>

  constructor(
    radiusFunction: RadiusFunction,
    heightFunction: HeightFunction = () => 0,
    options: RadiusGeometryOptions = {}
  ) {
    super()
    this.radiusFunction = radiusFunction
    this.heightFunction = heightFunction
    this.options = {
      radiusSegments: options.radiusSegments ?? 32,
      heightSegments: options.heightSegments ?? 16,
      closed: options.closed ?? true,
      thetaStart: options.thetaStart ?? 0,
      thetaLength: options.thetaLength ?? Math.PI * 2,
      phiStart: options.phiStart ?? 0,
      phiLength: options.phiLength ?? Math.PI,
    }

    this.buildGeometry()
  }

  private samplePoint(u: number, v: number, theta: number): Vector3 {
    const radius = this.radiusFunction(u, v)
    const height = this.heightFunction(u, v)
    return new Vector3(
      radius * Math.cos(theta),
      height,
      radius * Math.sin(theta)
    )
  }

  private buildGeometry(): void {
    const { radiusSegments, heightSegments, thetaStart, thetaLength } = this.options

    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const eps = 1e-4

    for (let vi = 0; vi <= heightSegments; vi++) {
      const v = vi / heightSegments

      for (let ui = 0; ui <= radiusSegments; ui++) {
        const u = ui / radiusSegments
        const theta = thetaStart + u * thetaLength

        const p = this.samplePoint(u, v, theta)
        vertices.push(p.x, p.y, p.z)
        uvs.push(u, v)

        // Compute normal via numerical differentiation
        const pu = this.samplePoint(
          Math.min(u + eps, 1), v,
          thetaStart + Math.min(u + eps, 1) * thetaLength
        )
        const pv = this.samplePoint(
          u, Math.min(v + eps, 1),
          theta
        )

        const tangentU = new Vector3().subVectors(pu, p).normalize()
        const tangentV = new Vector3().subVectors(pv, p).normalize()
        const normal = new Vector3().crossVectors(tangentU, tangentV).normalize()

        // Fallback if cross product is degenerate
        if (normal.lengthSq() < 0.0001) {
          normal.set(0, 1, 0)
        }

        normals.push(normal.x, normal.y, normal.z)
      }
    }

    for (let vi = 0; vi < heightSegments; vi++) {
      for (let ui = 0; ui < radiusSegments; ui++) {
        const a = vi * (radiusSegments + 1) + ui
        const b = vi * (radiusSegments + 1) + ui + 1
        const c = (vi + 1) * (radiusSegments + 1) + ui
        const d = (vi + 1) * (radiusSegments + 1) + ui + 1

        indices.push(a, c, b)
        indices.push(b, c, d)
      }
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
    this.setIndex(new BufferAttribute(new Uint32Array(indices), 1))

    this.computeBoundingBox()
    this.computeBoundingSphere()
  }

  public getStats(): GeometryStats {
    const positions = this.getAttribute('position')
    const index = this.getIndex()

    return {
      vertexCount: positions?.count ?? 0,
      triangleCount: (index?.count ?? 0) / 3,
      normalCount: this.getAttribute('normal')?.count ?? 0,
      uvCount: this.getAttribute('uv')?.count ?? 0,
      totalMemory: (positions?.count ?? 0) * 12 + (index?.count ?? 0) * 4,
    }
  }
}
