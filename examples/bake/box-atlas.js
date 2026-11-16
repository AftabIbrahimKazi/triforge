const FACES_PER_BOX = 6
const VERTS_PER_FACE = 4
const PADDING = 0.006
const SEARCH_STEPS = 24
const SCALE_MAX = 1

function faceSizes(width, height, depth) {
  return [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]]
}

function shelfPack(sizes, scale) {
  const order = sizes.map((_, index) => index).sort((a, b) => sizes[b][1] - sizes[a][1])
  const placed = new Array(sizes.length)
  let x = PADDING
  let y = PADDING
  let rowHeight = 0
  for (const index of order) {
    const w = sizes[index][0] * scale
    const h = sizes[index][1] * scale
    if (x + w + PADDING > 1) {
      x = PADDING
      y += rowHeight + PADDING
      rowHeight = 0
    }
    if (y + h + PADDING > 1 || x + w + PADDING > 1) return null
    placed[index] = [x, y, x + w, y + h]
    x += w + PADDING
    rowHeight = Math.max(rowHeight, h)
  }
  return placed
}

function packFaces(sizes) {
  let low = 0
  let high = SCALE_MAX
  let best = shelfPack(sizes, 1e-6)
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const mid = (low + high) / 2
    const placed = shelfPack(sizes, mid)
    if (placed) {
      best = placed
      low = mid
    } else {
      high = mid
    }
  }
  return best
}

/**
 * Adds a "uv1" lightmap set to a BoxGeometry where every face gets a rectangle
 * proportional to its world size, so texel density is the same on all faces.
 */
export function addBoxAtlasUV(geometry, width, height, depth) {
  const rects = packFaces(faceSizes(width, height, depth))
  const uv = geometry.getAttribute('uv')
  const packed = uv.clone()
  for (let face = 0; face < FACES_PER_BOX; face++) {
    const [u0, v0, u1, v1] = rects[face]
    for (let vertex = 0; vertex < VERTS_PER_FACE; vertex++) {
      const k = face * VERTS_PER_FACE + vertex
      packed.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0))
    }
  }
  geometry.setAttribute('uv1', packed)
  return geometry
}
