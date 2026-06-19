import { BufferGeometry } from 'three'
import { BaseUnwrapper } from '../core/BaseUnwrapper.js'
import {
  buildMeshGraph, orderBoundaryLoop, applyUVsToGeometry,
  cotangentWeight, oppositeVertex, applySeamCuts,
} from '../utils/meshGraph.js'
import { cgSolve, sparseAdd, sparseZero } from '../utils/linearSolver.js'

export interface ConformalLSCMOptions {
  /** Maximum solver iterations. Default 400. */
  maxIterations?: number
  /** Solver convergence tolerance. Default 1e-6. */
  tolerance?: number
}

/**
 * ConformalLSCM — Blender UV: Unwrap (Conformal / LSCM)
 *
 * Least Squares Conformal Maps parameterization.
 * Minimises angular distortion — angles in the UV map match the 3D mesh.
 * Uses cotangent-weighted Laplacian with boundary conditions.
 *
 * Works best on meshes with a natural boundary (disc topology).
 * For closed meshes, a seam is automatically inserted between the two
 * farthest-apart vertices.
 */
export class ConformalLSCM extends BaseUnwrapper {
  readonly unwrapType = 'ConformalLSCM'
  parameters: { maxIterations: number; tolerance: number }

  constructor(opts: ConformalLSCMOptions = {}) {
    super()
    this.parameters = {
      maxIterations: opts.maxIterations ?? 400,
      tolerance:     opts.tolerance     ?? 1e-6,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    if (!this.enabled) return geometry.clone()

    const graph  = buildMeshGraph(geometry)

    // Apply seam cuts before solving — treats seam edges as boundary
    const seams = geometry.userData?.seams as Array<{ a: number; b: number }> | undefined
    if (seams && seams.length > 0) applySeamCuts(graph, seams)

    const { positions, triangles, vertexCount, triangleCount, edgeTriangles, vertexTriangles } = graph

    if (vertexCount < 3 || triangleCount < 1) return geometry.clone()

    // Build cotangent-weighted Laplacian system
    // For each interior vertex i: sum_j w_ij * (u_j - u_i) = 0
    // => sum_j w_ij * u_j - (sum_j w_ij) * u_i = 0

    const { maxIterations, tolerance } = this.parameters

    // Identify pinned vertices (2 boundary vertices, or vertex 0 and farthest if no boundary)
    let pin0: number, pin1: number
    const boundaryLoop = orderBoundaryLoop(graph)

    if (boundaryLoop && boundaryLoop.length >= 2) {
      pin0 = boundaryLoop[0]
      pin1 = boundaryLoop[Math.floor(boundaryLoop.length / 2)]
    } else {
      // Closed mesh: pin vertex 0 and farthest vertex from it
      pin0 = 0
      let maxDist = 0
      pin1 = 1
      for (let i = 1; i < vertexCount; i++) {
        const dx = positions[i*3]   - positions[0]
        const dy = positions[i*3+1] - positions[1]
        const dz = positions[i*3+2] - positions[2]
        const d  = dx*dx + dy*dy + dz*dz
        if (d > maxDist) { maxDist = d; pin1 = i }
      }
    }

    // Build weight map: w[i][j] = cotangent weight for edge (i,j)
    const weights: Map<number, number>[] = Array.from({ length: vertexCount }, () => new Map())

    for (const [key, tris] of edgeTriangles) {
      const [a, b] = key.split('_').map(Number)
      let w = 0
      for (const t of tris) {
        const opp = oppositeVertex(triangles, t, a, b)
        w += cotangentWeight(positions, opp, a, b)
      }
      w = Math.max(0, w)  // clamp negative cotangents (obtuse triangles)
      const wa = (weights[a].get(b) ?? 0) + w
      const wb = (weights[b].get(a) ?? 0) + w
      weights[a].set(b, wa)
      weights[b].set(a, wb)
    }

    // Map vertex indices to free indices (excluding pinned)
    const freeIdx = new Int32Array(vertexCount).fill(-1)
    let numFree = 0
    for (let i = 0; i < vertexCount; i++) {
      if (i !== pin0 && i !== pin1) freeIdx[i] = numFree++
    }

    if (numFree === 0) {
      // Only 2 vertices — trivial
      const uvs = new Float32Array(vertexCount * 2)
      uvs[pin0 * 2] = 0; uvs[pin0 * 2 + 1] = 0
      uvs[pin1 * 2] = 1; uvs[pin1 * 2 + 1] = 0
      return applyUVsToGeometry(geometry, uvs, graph)
    }

    // Build separate U and V systems
    // A * u_free = b_u (contributions from pinned vertices go to RHS)
    const AU = sparseZero(numFree)
    const AV = sparseZero(numFree)
    const bU = new Float64Array(numFree)
    const bV = new Float64Array(numFree)

    // Pin UV values: pin0 → (0, 0), pin1 → (1, 0)
    const pinUV = new Map<number, [number, number]>([
      [pin0, [0, 0]],
      [pin1, [1, 0]],
    ])

    for (let i = 0; i < vertexCount; i++) {
      const fi = freeIdx[i]
      if (fi < 0) continue  // pinned

      let diagSum = 0
      for (const [j, w] of weights[i]) {
        diagSum += w
        const fj = freeIdx[j]
        if (fj >= 0) {
          // Free neighbor → add to A
          sparseAdd(AU, fi, fj, -w)
          sparseAdd(AV, fi, fj, -w)
        } else {
          // Pinned neighbor → add to RHS
          const [pu, pv] = pinUV.get(j) ?? [0, 0]
          bU[fi] += w * pu
          bV[fi] += w * pv
        }
      }
      sparseAdd(AU, fi, fi, diagSum)
      sparseAdd(AV, fi, fi, diagSum)
    }

    // Solve
    const solU = cgSolve(AU, bU, undefined, maxIterations, tolerance)
    const solV = cgSolve(AV, bV, undefined, maxIterations, tolerance)

    // Reconstruct full UV array
    const uvs = new Float32Array(vertexCount * 2)
    for (let i = 0; i < vertexCount; i++) {
      const fi = freeIdx[i]
      if (fi >= 0) {
        uvs[i * 2]     = solU[fi]
        uvs[i * 2 + 1] = solV[fi]
      } else {
        const [pu, pv] = pinUV.get(i) ?? [0, 0]
        uvs[i * 2]     = pu
        uvs[i * 2 + 1] = pv
      }
    }

    // Remap to [0,1]
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (let i = 0; i < vertexCount; i++) {
      const u = uvs[i * 2], v = uvs[i * 2 + 1]
      if (u < minU) minU = u; if (u > maxU) maxU = u
      if (v < minV) minV = v; if (v > maxV) maxV = v
    }
    const rangeU = maxU - minU || 1, rangeV = maxV - minV || 1
    for (let i = 0; i < vertexCount; i++) {
      uvs[i * 2]     = (uvs[i * 2]     - minU) / rangeU
      uvs[i * 2 + 1] = (uvs[i * 2 + 1] - minV) / rangeV
    }

    return applyUVsToGeometry(geometry, uvs, graph)
  }
}
