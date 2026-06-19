import { BufferGeometry, BufferAttribute } from 'three'

export interface PackIslandsOptions {
  /** Margin between islands [0–0.1]. Default 0.02. Blender: Pack Islands → Margin */
  margin?: number
}

/**
 * PackIslands — Blender UV: Pack Islands
 *
 * Re-packs all UV islands into the [0,1]² space with minimal wasted area.
 * Extracts connected UV islands, normalises their size to preserve relative
 * 3D area, then shelves them into the UV square.
 *
 * Non-destructive: always returns a new BufferGeometry.
 */
export class PackIslands {
  parameters: { margin: number }

  constructor(opts: PackIslandsOptions = {}) {
    this.parameters = { margin: opts.margin ?? 0.02 }
  }

  apply(geometry: BufferGeometry): BufferGeometry {
    const result  = geometry.clone()
    const uvAttr  = result.getAttribute('uv') as BufferAttribute | undefined
    if (!uvAttr) return result  // no UVs to pack

    const posAttr = result.getAttribute('position') as BufferAttribute
    const count   = uvAttr.count
    const margin  = this.parameters.margin

    // Step 1: find connected UV islands
    // Build vertex adjacency by triangle connectivity
    const numTris = result.index ? result.index.count / 3 : Math.floor(count / 3)
    const getIdx  = (t: number, v: number): number =>
      result.index ? result.index.array[t * 3 + v] : t * 3 + v

    const adj: Set<number>[] = Array.from({ length: count }, () => new Set())
    for (let t = 0; t < numTris; t++) {
      const i = getIdx(t, 0), j = getIdx(t, 1), k = getIdx(t, 2)
      adj[i].add(j); adj[i].add(k)
      adj[j].add(i); adj[j].add(k)
      adj[k].add(i); adj[k].add(j)
    }

    // BFS to find islands
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

    // Step 2: compute bounding box and 3D area for each island
    interface IslandInfo {
      verts: number[]
      uvMinU: number; uvMaxU: number
      uvMinV: number; uvMaxV: number
      area3D: number
    }

    const islandInfos: IslandInfo[] = islands.map(verts => {
      let uvMinU = Infinity, uvMaxU = -Infinity
      let uvMinV = Infinity, uvMaxV = -Infinity
      let area3D = 0

      for (const v of verts) {
        const u = uvAttr.getX(v), uv = uvAttr.getY(v)
        if (u  < uvMinU) uvMinU = u;  if (u  > uvMaxU) uvMaxU = u
        if (uv < uvMinV) uvMinV = uv; if (uv > uvMaxV) uvMaxV = uv
      }

      // Approximate 3D area for this island by summing incident triangle areas
      const vertSet = new Set(verts)
      for (let t = 0; t < numTris; t++) {
        const i = getIdx(t, 0), j = getIdx(t, 1), k = getIdx(t, 2)
        if (!vertSet.has(i) && !vertSet.has(j) && !vertSet.has(k)) continue
        const ax = posAttr.getX(i), ay = posAttr.getY(i), az = posAttr.getZ(i)
        const bx = posAttr.getX(j), by = posAttr.getY(j), bz = posAttr.getZ(j)
        const cx = posAttr.getX(k), cy = posAttr.getY(k), cz = posAttr.getZ(k)
        const ex = bx-ax, ey = by-ay, ez = bz-az
        const fx = cx-ax, fy = cy-ay, fz = cz-az
        const crx = ey*fz-ez*fy, cry = ez*fx-ex*fz, crz = ex*fy-ey*fx
        area3D += 0.5 * Math.sqrt(crx*crx+cry*cry+crz*crz)
      }

      return { verts, uvMinU, uvMaxU, uvMinV, uvMaxV, area3D }
    })

    // Step 3: scale each island proportional to sqrt(area3D)
    const totalArea = islandInfos.reduce((s, ii) => s + ii.area3D, 0) || 1

    interface Rect { x: number; y: number; w: number; h: number; islandIdx: number }
    const rects: Rect[] = islandInfos.map((ii, idx) => {
      const scale = Math.sqrt(ii.area3D / totalArea)
      const w = (ii.uvMaxU - ii.uvMinU) * scale || 0.01
      const h = (ii.uvMaxV - ii.uvMinV) * scale || 0.01
      return { x: 0, y: 0, w, h, islandIdx: idx }
    })

    // Step 4: shelf pack
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

    // Step 5: remap UV coordinates
    const newUV = new Float32Array(count * 2)
    for (let ri = 0; ri < rects.length; ri++) {
      const rect = rects[ri]
      const ii   = islandInfos[rect.islandIdx]
      const pW   = ii.uvMaxU - ii.uvMinU || 1
      const pH   = ii.uvMaxV - ii.uvMinV || 1

      for (const v of ii.verts) {
        const oldU = uvAttr.getX(v), oldV = uvAttr.getY(v)
        newUV[v * 2]     = rect.x + ((oldU - ii.uvMinU) / pW) * rect.w
        newUV[v * 2 + 1] = rect.y + ((oldV - ii.uvMinV) / pH) * rect.h
      }
    }

    result.setAttribute('uv', new BufferAttribute(newUV, 2))
    return result
  }
}
