import { BufferGeometry, BufferAttribute } from 'three'

/**
 * AverageIslandScale — Blender UV: Average Island Scale
 *
 * Scales UV islands so every island has the same texel density.
 * Ratio = sqrt(3D area / UV area) per island.
 * After this operation all islands have a uniform texel-per-unit ratio.
 *
 * Non-destructive: always returns a new BufferGeometry.
 */
export class AverageIslandScale {
  parameters: Record<string, number> = {}

  apply(geometry: BufferGeometry): BufferGeometry {
    const result  = geometry.clone()
    const uvAttr  = result.getAttribute('uv') as BufferAttribute | undefined
    if (!uvAttr) return result

    const posAttr = result.getAttribute('position') as BufferAttribute
    const count   = uvAttr.count

    const numTris = result.index ? result.index.count / 3 : Math.floor(count / 3)
    const getIdx  = (t: number, v: number): number =>
      result.index ? result.index.array[t * 3 + v] : t * 3 + v

    // Build UV island adjacency
    const adj: Set<number>[] = Array.from({ length: count }, () => new Set())
    for (let t = 0; t < numTris; t++) {
      const i = getIdx(t, 0), j = getIdx(t, 1), k = getIdx(t, 2)
      adj[i].add(j); adj[i].add(k)
      adj[j].add(i); adj[j].add(k)
      adj[k].add(i); adj[k].add(j)
    }

    const visited = new Uint8Array(count)
    const islands: number[][] = []

    for (let start = 0; start < count; start++) {
      if (visited[start]) continue
      const island: number[] = []
      const queue = [start]
      visited[start] = 1
      while (queue.length) {
        const v = queue.shift()!
        island.push(v)
        for (const n of adj[v]) {
          if (!visited[n]) { visited[n] = 1; queue.push(n) }
        }
      }
      islands.push(island)
    }

    // Compute texel density ratio per island
    const vertSet = new Set<number>()

    interface IslandDensity {
      verts:   number[]
      ratio:   number   // sqrt(area3D) / sqrt(uvArea) — ideal scale factor
      centerU: number
      centerV: number
    }

    const densities: IslandDensity[] = islands.map(verts => {
      vertSet.clear()
      for (const v of verts) vertSet.add(v)

      let area3D = 0, uvArea = 0
      let sumU = 0, sumV = 0

      for (let t = 0; t < numTris; t++) {
        const i = getIdx(t, 0), j = getIdx(t, 1), k = getIdx(t, 2)
        if (!vertSet.has(i) && !vertSet.has(j) && !vertSet.has(k)) continue

        // 3D area
        const ax = posAttr.getX(i), ay = posAttr.getY(i), az = posAttr.getZ(i)
        const bx = posAttr.getX(j), by = posAttr.getY(j), bz = posAttr.getZ(j)
        const cx = posAttr.getX(k), cy = posAttr.getY(k), cz = posAttr.getZ(k)
        const ex = bx-ax, ey = by-ay, ez = bz-az
        const fx = cx-ax, fy = cy-ay, fz = cz-az
        const crx = ey*fz-ez*fy, cry = ez*fx-ex*fz, crz = ex*fy-ey*fx
        area3D += 0.5 * Math.sqrt(crx*crx + cry*cry + crz*crz)

        // UV area
        const ui = uvAttr.getX(i), vi2 = uvAttr.getY(i)
        const uj = uvAttr.getX(j), vj  = uvAttr.getY(j)
        const uk = uvAttr.getX(k), vk  = uvAttr.getY(k)
        uvArea += Math.abs((uj - ui) * (vk - vi2) - (uk - ui) * (vj - vi2)) * 0.5
      }

      for (const v of verts) { sumU += uvAttr.getX(v); sumV += uvAttr.getY(v) }

      const ratio = uvArea > 1e-12 ? Math.sqrt(area3D / uvArea) : 1

      return {
        verts,
        ratio,
        centerU: sumU / verts.length,
        centerV: sumV / verts.length,
      }
    })

    // Compute median ratio so all islands converge to the same density
    const ratios = densities.map(d => d.ratio).sort((a, b) => a - b)
    const medianRatio = ratios[Math.floor(ratios.length / 2)] || 1

    // Scale each island around its UV center
    const newUV = new Float32Array(uvAttr.array)

    for (const d of densities) {
      const scale = d.ratio / medianRatio
      for (const v of d.verts) {
        newUV[v * 2]     = d.centerU + (uvAttr.getX(v) - d.centerU) * scale
        newUV[v * 2 + 1] = d.centerV + (uvAttr.getY(v) - d.centerV) * scale
      }
    }

    result.setAttribute('uv', new BufferAttribute(newUV, 2))
    return result
  }
}
