import { BufferGeometry, BufferAttribute } from 'three'
import { BaseUnwrapper } from '../core/BaseUnwrapper.js'

export interface SmartUVProjectOptions {
  /**
   * Maximum angle (degrees) between face normals for them to be grouped
   * into the same projection island. Default 66. Blender: Smart UV Project → Angle Limit.
   */
  angleLimit?: number
  /** Margin between islands in UV space [0–0.1]. Default 0.02. Blender: Island Margin */
  islandMargin?: number
}

/**
 * SmartUVProject — Blender UV: Smart UV Project
 *
 * Clusters faces by normal direction (within angleLimit degrees),
 * projects each cluster onto its average normal plane,
 * then packs all islands into UV [0,1]² space.
 *
 * Good for hard-surface models with mixed orientations.
 */
export class SmartUVProject extends BaseUnwrapper {
  readonly unwrapType = 'SmartUVProject'
  parameters: { angleLimit: number; islandMargin: number }

  constructor(opts: SmartUVProjectOptions = {}) {
    super()
    this.parameters = {
      angleLimit:   opts.angleLimit   ?? 66,
      islandMargin: opts.islandMargin ?? 0.02,
    }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    if (!this.enabled) return geometry.clone()

    // De-index so every triangle vertex gets its own UV slot.
    // Shared vertices in indexed geometry would get conflicting UVs
    // when they sit on a boundary between two different projection islands.
    const result  = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    const posAttr = result.getAttribute('position') as BufferAttribute
    const count   = posAttr.count

    if (count % 3 !== 0) return geometry.clone()

    const angleRad = (this.parameters.angleLimit * Math.PI) / 180
    const cosLimit = Math.cos(angleRad)

    // Step 1: compute face normals
    interface FaceNormal { nx: number; ny: number; nz: number }
    const faceNormals: FaceNormal[] = []

    // After toNonIndexed() there is no index buffer — always use flat layout
    const getTriIndices = (t: number): [number, number, number] => {
      if (result.index) {
        const idx = result.index.array
        return [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]
      }
      return [t * 3, t * 3 + 1, t * 3 + 2]
    }

    const numTriangles = Math.floor(count / 3)

    for (let t = 0; t < numTriangles; t++) {
      const [i, j, k] = getTriIndices(t)
      const ax = posAttr.getX(i), ay = posAttr.getY(i), az = posAttr.getZ(i)
      const bx = posAttr.getX(j), by = posAttr.getY(j), bz = posAttr.getZ(j)
      const cx = posAttr.getX(k), cy = posAttr.getY(k), cz = posAttr.getZ(k)

      const ex = bx - ax, ey = by - ay, ez = bz - az
      const fx = cx - ax, fy = cy - ay, fz = cz - az

      let nx = ey * fz - ez * fy
      let ny = ez * fx - ex * fz
      let nz = ex * fy - ey * fx
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
      nx /= len; ny /= len; nz /= len

      faceNormals.push({ nx, ny, nz })
    }

    // Step 2: greedy cluster faces into islands by normal similarity
    const faceIsland = new Int32Array(numTriangles).fill(-1)
    const islandNormals: { nx: number; ny: number; nz: number }[] = []
    const islands: number[][] = []

    for (let t = 0; t < numTriangles; t++) {
      if (faceIsland[t] !== -1) continue

      const fn = faceNormals[t]

      // Find nearest existing island within angle limit
      let bestIsland = -1
      let bestDot    = cosLimit

      for (let g = 0; g < islandNormals.length; g++) {
        const gn  = islandNormals[g]
        const dot = fn.nx * gn.nx + fn.ny * gn.ny + fn.nz * gn.nz
        if (dot > bestDot) { bestDot = dot; bestIsland = g }
      }

      if (bestIsland === -1) {
        bestIsland = islands.length
        islands.push([])
        islandNormals.push({ ...fn })
      }

      faceIsland[t] = bestIsland
      islands[bestIsland].push(t)

      // Update island average normal (running mean)
      const gn = islandNormals[bestIsland]
      const n  = islands[bestIsland].length
      gn.nx = (gn.nx * (n - 1) + fn.nx) / n
      gn.ny = (gn.ny * (n - 1) + fn.ny) / n
      gn.nz = (gn.nz * (n - 1) + fn.nz) / n
      const len2 = Math.sqrt(gn.nx*gn.nx + gn.ny*gn.ny + gn.nz*gn.nz) || 1
      gn.nx /= len2; gn.ny /= len2; gn.nz /= len2
    }

    // Step 3: project each island onto its normal plane, collect UV patches
    interface Patch {
      faceUVs: [number, number][][]  // [faceIdx][vertex 0-2][u, v]
      minU: number; maxU: number
      minV: number; maxV: number
    }

    const patches: Patch[] = islands.map((facesInIsland, g) => {
      const gn = islandNormals[g]

      // Build tangent frame for this island's normal
      let tx = 1, ty = 0, tz = 0
      if (Math.abs(gn.nx) > 0.9) { tx = 0; ty = 1; tz = 0 }
      // bitangent = normal × tangent
      let bx = gn.ny * tz - gn.nz * ty
      let by = gn.nz * tx - gn.nx * tz
      let bz = gn.nx * ty - gn.ny * tx
      // re-orthogonalize tangent
      tx = by * gn.nz - bz * gn.ny
      ty = bz * gn.nx - bx * gn.nz
      tz = bx * gn.ny - by * gn.nx
      const tLen = Math.sqrt(tx*tx+ty*ty+tz*tz)||1
      const bLen = Math.sqrt(bx*bx+by*by+bz*bz)||1
      tx/=tLen; ty/=tLen; tz/=tLen
      bx/=bLen; by/=bLen; bz/=bLen

      let minU = Infinity, maxU = -Infinity
      let minV = Infinity, maxV = -Infinity

      const faceUVs: [number, number][][] = facesInIsland.map(t => {
        const [i, j, k] = getTriIndices(t)
        return [i, j, k].map(vi => {
          const px = posAttr.getX(vi), py = posAttr.getY(vi), pz = posAttr.getZ(vi)
          const u  = px * tx + py * ty + pz * tz
          const v  = px * bx + py * by + pz * bz
          if (u < minU) minU = u; if (u > maxU) maxU = u
          if (v < minV) minV = v; if (v > maxV) maxV = v
          return [u, v] as [number, number]
        })
      })

      return { faceUVs, minU, maxU, minV, maxV }
    })

    // Step 4: shelf-pack islands, then rescale to fill [0,1]²
    const margin    = this.parameters.islandMargin
    const totalArea = patches.reduce((s, p) => s + (p.maxU - p.minU) * (p.maxV - p.minV), 0)
    const sqrtArea  = Math.sqrt(totalArea) || 1

    interface Rect { x: number; y: number; w: number; h: number; patchIdx: number }
    const rects: Rect[] = patches.map((p, idx) => ({
      x: 0, y: 0,
      w: (p.maxU - p.minU) / sqrtArea,
      h: (p.maxV - p.minV) / sqrtArea,
      patchIdx: idx,
    }))

    // Sort by height descending for better shelf utilisation
    rects.sort((a, b) => b.h - a.h)

    let curX = 0, curY = 0, rowH = 0
    for (const rect of rects) {
      if (curX + rect.w + margin > 1.0) {
        curX  = 0
        curY += rowH + margin
        rowH  = 0
      }
      rect.x = curX
      rect.y = curY
      if (rect.h > rowH) rowH = rect.h
      curX += rect.w + margin
    }

    // Rescale the packed layout so it fills exactly [0, 1-margin]²
    // without this step islands can overflow [0,1] when sqrtArea < total packed extent
    let packMaxX = 0, packMaxY = 0
    for (const r of rects) {
      if (r.x + r.w > packMaxX) packMaxX = r.x + r.w
      if (r.y + r.h > packMaxY) packMaxY = r.y + r.h
    }
    const scaleX = packMaxX > 0 ? (1 - margin) / packMaxX : 1
    const scaleY = packMaxY > 0 ? (1 - margin) / packMaxY : 1
    const packScale = Math.min(scaleX, scaleY)   // uniform scale keeps aspect ratios
    for (const r of rects) {
      r.x *= packScale; r.y *= packScale
      r.w *= packScale; r.h *= packScale
    }

    // Step 5: write UVs
    const uv = new Float32Array(count * 2)

    for (const rect of rects) {
      const p     = patches[rect.patchIdx]
      const pW    = p.maxU - p.minU || 1
      const pH    = p.maxV - p.minV || 1
      const facesInIsland = islands[rect.patchIdx]

      facesInIsland.forEach((t, fi) => {
        const [i, j, k] = getTriIndices(t)
        ;[i, j, k].forEach((vi, vl) => {
          const [pu, pv] = p.faceUVs[fi][vl]
          const u = rect.x + ((pu - p.minU) / pW) * rect.w
          const v = rect.y + ((pv - p.minV) / pH) * rect.h
          uv[vi * 2]     = u
          uv[vi * 2 + 1] = v
        })
      })
    }

    result.setAttribute('uv', new BufferAttribute(uv, 2))
    // Recompute smooth normals — toNonIndexed() duplicates vertices so
    // the original smooth normals are preserved, but calling this ensures
    // correct per-face-vertex normals if the source had none.
    result.computeVertexNormals()
    return result
  }
}
