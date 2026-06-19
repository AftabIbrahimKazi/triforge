import { BufferGeometry, BufferAttribute } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export interface WireframeModifierOptions {
  thickness?: number
  sides?:     number
}

/**
 * Wireframe Modifier — Blender "Wireframe" modifier equivalent.
 * Converts each triangle's edges into tubes, producing a wireframe mesh.
 *
 * For each unique edge a polygonal tube is generated with `sides` faces.
 * parameters.thickness: tube radius
 * parameters.sides:     cross-section polygon sides (3–8)
 */
export class WireframeModifier extends BaseModifier {
  get name() { return 'Wireframe' }

  parameters: Record<string, number>

  constructor(options: WireframeModifierOptions = {}) {
    super()
    this.parameters = {
      thickness: options.thickness ?? 0.02,
      sides:     Math.round(Math.max(3, Math.min(8, options.sides ?? 4))),
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const thickness = Math.max(0, this.parameters.thickness)
    const sides     = Math.round(Math.max(3, Math.min(8, this.parameters.sides)))

    const srcPos = geometry.getAttribute('position')
    const srcIdx = geometry.getIndex()
    const vCount = srcPos.count

    // ── Build unique edge list ─────────────────────────────────────────────────

    const edgeSet = new Set<string>()
    const edges: [number, number][] = []

    const addEdge = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push(a < b ? [a, b] : [b, a])
      }
    }

    if (srcIdx) {
      const ia = srcIdx.array
      for (let i = 0; i < ia.length; i += 3) {
        addEdge(ia[i], ia[i + 1])
        addEdge(ia[i + 1], ia[i + 2])
        addEdge(ia[i + 2], ia[i])
      }
    } else {
      for (let i = 0; i < vCount; i += 3) {
        addEdge(i,     i + 1)
        addEdge(i + 1, i + 2)
        addEdge(i + 2, i)
      }
    }

    // ── Build tube geometry for each edge ──────────────────────────────────────

    const outPos: number[] = []
    const outNorm: number[] = []
    const outIdx:  number[] = []

    for (const [ai, bi] of edges) {
      const ax = srcPos.getX(ai), ay = srcPos.getY(ai), az = srcPos.getZ(ai)
      const bx = srcPos.getX(bi), by = srcPos.getY(bi), bz = srcPos.getZ(bi)

      // Edge direction
      let dx = bx - ax, dy = by - ay, dz = bz - az
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (len < 1e-10) continue
      dx /= len; dy /= len; dz /= len

      // Build a local frame: find two perpendicular vectors
      let ux: number, uy: number, uz: number
      if (Math.abs(dx) <= Math.abs(dy) && Math.abs(dx) <= Math.abs(dz)) {
        ux = 0; uy = -dz; uz = dy
      } else if (Math.abs(dy) <= Math.abs(dz)) {
        ux = dz; uy = 0; uz = -dx
      } else {
        ux = -dy; uy = dx; uz = 0
      }
      const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz)
      ux /= uLen; uy /= uLen; uz /= uLen

      // v = d × u
      const vx = dy * uz - dz * uy
      const vy = dz * ux - dx * uz
      const vz = dx * uy - dy * ux

      const ringBase = outPos.length / 3

      // Two rings: one at start, one at end
      for (let end = 0; end < 2; end++) {
        const ox = end === 0 ? ax : bx
        const oy = end === 0 ? ay : by
        const oz = end === 0 ? az : bz

        for (let s = 0; s < sides; s++) {
          const angle = (s / sides) * Math.PI * 2
          const cos   = Math.cos(angle)
          const sin   = Math.sin(angle)
          const nx    = cos * ux + sin * vx
          const ny    = cos * uy + sin * vy
          const nz    = cos * uz + sin * vz
          outPos.push(ox + nx * thickness, oy + ny * thickness, oz + nz * thickness)
          outNorm.push(nx, ny, nz)
        }
      }

      // Connect rings with quads (2 triangles each)
      for (let s = 0; s < sides; s++) {
        const s1 = (s + 1) % sides
        const a0 = ringBase + s
        const a1 = ringBase + s1
        const b0 = ringBase + sides + s
        const b1 = ringBase + sides + s1
        outIdx.push(a0, b0, a1)
        outIdx.push(a1, b0, b1)
      }

      // End caps — fan triangulation
      for (let end = 0; end < 2; end++) {
        const ringStart = ringBase + end * sides
        const flip      = end === 0
        for (let s = 1; s < sides - 1; s++) {
          if (flip) {
            outIdx.push(ringStart, ringStart + s + 1, ringStart + s)
          } else {
            outIdx.push(ringStart, ringStart + s, ringStart + s + 1)
          }
        }
      }
    }

    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(outPos),  3))
    result.setAttribute('normal',   new BufferAttribute(new Float32Array(outNorm), 3))
    result.setIndex(new BufferAttribute(new Uint32Array(outIdx), 1))
    return result
  }
}
