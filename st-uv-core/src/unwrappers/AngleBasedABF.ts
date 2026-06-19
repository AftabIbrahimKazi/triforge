import { BufferGeometry } from 'three'
import { BaseUnwrapper } from '../core/BaseUnwrapper.js'
import {
  buildMeshGraph, orderBoundaryLoop, applyUVsToGeometry,
  meanValueWeight, oppositeVertex, applySeamCuts,
} from '../utils/meshGraph.js'
import { cgSolve, sparseAdd, sparseZero } from '../utils/linearSolver.js'

export interface AngleBasedABFOptions {
  /** Maximum solver iterations. Default 400. */
  maxIterations?: number
  /** Solver convergence tolerance. Default 1e-6. */
  tolerance?: number
}

/**
 * AngleBasedABF — Blender UV: Unwrap (Angle Based)
 *
 * Angle-Based Flattening approximation using mean-value coordinates.
 * Minimises angle distortion better than LSCM for meshes with obtuse triangles.
 * Uses mean-value weights instead of cotangent weights — always positive,
 * so it handles obtuse triangles without negative weights.
 *
 * Works best on meshes with a natural boundary (disc topology).
 * For closed meshes, a seam is automatically inserted between the two
 * farthest-apart vertices.
 */
export class AngleBasedABF extends BaseUnwrapper {
  readonly unwrapType = 'AngleBasedABF'
  parameters: { maxIterations: number; tolerance: number }

  constructor(opts: AngleBasedABFOptions = {}) {
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

    const { positions, triangles, vertexCount, triangleCount, edgeTriangles } = graph

    if (vertexCount < 3 || triangleCount < 1) return geometry.clone()

    const { maxIterations, tolerance } = this.parameters

    // Identify pinned vertices
    let pin0: number, pin1: number
    const boundaryLoop = orderBoundaryLoop(graph)

    if (boundaryLoop && boundaryLoop.length >= 2) {
      pin0 = boundaryLoop[0]
      pin1 = boundaryLoop[Math.floor(boundaryLoop.length / 2)]
    } else {
      pin0 = 0
      let maxDist = 0; pin1 = 1
      for (let i = 1; i < vertexCount; i++) {
        const dx = positions[i*3]   - positions[0]
        const dy = positions[i*3+1] - positions[1]
        const dz = positions[i*3+2] - positions[2]
        const d  = dx*dx + dy*dy + dz*dz
        if (d > maxDist) { maxDist = d; pin1 = i }
      }
    }

    // Build mean-value weight map: always positive, handles obtuse triangles
    const weights: Map<number, number>[] = Array.from({ length: vertexCount }, () => new Map())

    for (const [key, tris] of edgeTriangles) {
      const [a, b] = key.split('_').map(Number)
      let w = 0
      for (const t of tris) {
        const opp = oppositeVertex(triangles, t, a, b)
        // Mean-value weight at vertex a for edge a→b
        w += meanValueWeight(positions, a, b, opp)
      }
      w = Math.max(1e-6, w)
      const wa = (weights[a].get(b) ?? 0) + w
      weights[a].set(b, wa)

      // Symmetric: weight at b for edge b→a
      let wb2 = 0
      for (const t of tris) {
        const opp = oppositeVertex(triangles, t, a, b)
        wb2 += meanValueWeight(positions, b, a, opp)
      }
      wb2 = Math.max(1e-6, wb2)
      const wb = (weights[b].get(a) ?? 0) + wb2
      weights[b].set(a, wb)
    }

    // Map free vertex indices
    const freeIdx = new Int32Array(vertexCount).fill(-1)
    let numFree = 0
    for (let i = 0; i < vertexCount; i++) {
      if (i !== pin0 && i !== pin1) freeIdx[i] = numFree++
    }

    if (numFree === 0) {
      const uvs = new Float32Array(vertexCount * 2)
      uvs[pin0 * 2] = 0; uvs[pin0 * 2 + 1] = 0
      uvs[pin1 * 2] = 1; uvs[pin1 * 2 + 1] = 0
      return applyUVsToGeometry(geometry, uvs, graph)
    }

    const AU = sparseZero(numFree)
    const AV = sparseZero(numFree)
    const bU = new Float64Array(numFree)
    const bV = new Float64Array(numFree)

    const pinUV = new Map<number, [number, number]>([
      [pin0, [0, 0]],
      [pin1, [1, 0]],
    ])

    for (let i = 0; i < vertexCount; i++) {
      const fi = freeIdx[i]
      if (fi < 0) continue

      let diagSum = 0
      for (const [j, w] of weights[i]) {
        diagSum += w
        const fj = freeIdx[j]
        if (fj >= 0) {
          sparseAdd(AU, fi, fj, -w)
          sparseAdd(AV, fi, fj, -w)
        } else {
          const [pu, pv] = pinUV.get(j) ?? [0, 0]
          bU[fi] += w * pu
          bV[fi] += w * pv
        }
      }
      sparseAdd(AU, fi, fi, diagSum)
      sparseAdd(AV, fi, fi, diagSum)
    }

    const solU = cgSolve(AU, bU, undefined, maxIterations, tolerance)
    const solV = cgSolve(AV, bV, undefined, maxIterations, tolerance)

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
