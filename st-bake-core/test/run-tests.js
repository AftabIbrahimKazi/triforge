import { strict as assert } from 'assert'
import { BackSide, BoxGeometry, BufferAttribute, BufferGeometry, Color, DataTexture, FloatType, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { BuiltInIntersector, LightBaker, meshBVHIntersector } from '../dist/index.js'

let passed = 0
let failed = 0
const queue = []
function test(name, fn) {
  queue.push({ name, fn })
}
function approx(a, b, tol = 1e-3) {
  assert(Math.abs(a - b) < tol, `Expected ${a} ≈ ${b} (tol ${tol})`)
}

function lcg(seed) {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function plane({ width, height, position = [0, 0, 0], rotation = [0, 0, 0], color = 0.8, uv1 = true }) {
  const geometry = new PlaneGeometry(width, height)
  if (uv1) geometry.setAttribute('uv1', geometry.getAttribute('uv').clone())
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: new Color(color, color, color) }))
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.updateMatrixWorld(true)
  return mesh
}

function floor(size = 2, extra = {}) {
  return plane({ width: size, height: size, rotation: [-Math.PI / 2, 0, 0], ...extra })
}

const WHITE = [1, 1, 1]
const BLACK_SKY = () => [0, 0, 0]
const UP_SUN = { direction: [0, 1, 0], color: WHITE, intensity: 3 }

function baker(meshes, overrides = {}) {
  return new LightBaker(meshes, { sun: UP_SUN, sky: BLACK_SKY, texelsPerMeter: 8, samples: 4, ...overrides })
}

function dataOf(texture) {
  return texture.image.data
}

function tintedCopy(mesh, rgb) {
  mesh.material.color.setRGB(...rgb)
  return mesh
}

// ── BuiltInIntersector ────────────────────────────────────────────────────────
test('ray hits a triangle at the expected distance', () => {
  const soup = soupOf([[[0, 0, 0], [2, 0, 0], [0, 0, 2]]])
  const hit = { t: 0, triangle: -1 }
  const found = new BuiltInIntersector(soup).raycast(0.5, 3, 0.5, 0, -1, 0, hit)
  assert(found)
  approx(hit.t, 3)
  assert.equal(hit.triangle, 0)
})

test('ray that misses the triangle returns false', () => {
  const soup = soupOf([[[0, 0, 0], [2, 0, 0], [0, 0, 2]]])
  assert(!new BuiltInIntersector(soup).raycast(5, 3, 5, 0, -1, 0, { t: 0, triangle: -1 }))
})

test('triangle is hit from behind (double sided)', () => {
  const soup = soupOf([[[0, 0, 0], [2, 0, 0], [0, 0, 2]]])
  assert(new BuiltInIntersector(soup).raycast(0.5, -3, 0.5, 0, 1, 0, { t: 0, triangle: -1 }))
})

test('empty soup never hits', () => {
  assert(!new BuiltInIntersector(soupOf([])).raycast(0, 0, 0, 0, 1, 0, { t: 0, triangle: -1 }))
})

test('BVH matches brute force on 500 random triangles and 400 rays', () => {
  const rand = lcg(7)
  const tris = []
  for (let i = 0; i < 500; i++) {
    const c = [rand() * 20 - 10, rand() * 20 - 10, rand() * 20 - 10]
    tris.push([0, 1, 2].map(() => c.map((v) => v + rand() * 2 - 1)))
  }
  const soup = soupOf(tris)
  const bvh = new BuiltInIntersector(soup)
  const hit = { t: 0, triangle: -1 }
  for (let r = 0; r < 400; r++) {
    const o = [rand() * 20 - 10, rand() * 20 - 10, rand() * 20 - 10]
    const d = [rand() - 0.5, rand() - 0.5, rand() - 0.5]
    const len = Math.hypot(...d)
    const dir = d.map((v) => v / len)
    const expected = bruteForce(soup, o, dir)
    const found = bvh.raycast(...o, ...dir, hit)
    assert.equal(found, expected !== null)
    if (found) approx(hit.t, expected.t, 1e-3)
  }
})

function soupOf(tris) {
  const positions = new Float32Array(tris.length * 9)
  tris.forEach((tri, i) => tri.forEach((v, k) => positions.set(v, i * 9 + k * 3)))
  return { count: tris.length, positions, uvs: new Float32Array(tris.length * 6), normals: new Float32Array(tris.length * 3), triangleMesh: new Uint32Array(tris.length), meshRanges: [{ start: 0, end: tris.length }] }
}

function bruteForce(soup, o, d) {
  let best = null
  for (let i = 0; i < soup.count; i++) {
    const p = soup.positions
    const b = i * 9
    const e1 = [p[b + 3] - p[b], p[b + 4] - p[b + 1], p[b + 5] - p[b + 2]]
    const e2 = [p[b + 6] - p[b], p[b + 7] - p[b + 1], p[b + 8] - p[b + 2]]
    const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]
    const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2]
    if (Math.abs(det) < 1e-9) continue
    const s = [o[0] - p[b], o[1] - p[b + 1], o[2] - p[b + 2]]
    const u = (s[0] * pv[0] + s[1] * pv[1] + s[2] * pv[2]) / det
    if (u < 0 || u > 1) continue
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det
    if (v < 0 || u + v > 1) continue
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det
    if (t > 1e-6 && (!best || t < best.t)) best = { t }
  }
  return best
}

// ── Lighting maths ────────────────────────────────────────────────────────────
test('lit floor equals albedo * sun * cos / pi', () => {
  const mesh = floor(2)
  const map = baker([mesh]).bake()
  const data = dataOf(map.get(mesh))
  const expected = (0.8 * 3) / Math.PI
  for (let i = 0; i < data.length; i += 4) {
    approx(data[i], expected, 1e-3)
    approx(data[i + 3], 1)
  }
})

test('sun colour tints the result', () => {
  const mesh = floor(2)
  const map = baker([mesh], { sun: { ...UP_SUN, color: [1, 0.5, 0] } }).bake()
  const data = dataOf(map.get(mesh))
  approx(data[1] / data[0], 0.5, 1e-3)
  approx(data[2], 0, 1e-6)
})

test('constant white sky gives radiance equal to albedo', () => {
  const mesh = floor(2)
  const map = baker([mesh], { sun: { ...UP_SUN, intensity: 0 }, sky: () => [1, 1, 1], samples: 32 }).bake()
  const data = dataOf(map.get(mesh))
  approx(data[0], 0.8, 1e-3)
})

test('sun below the horizon of the surface gives no direct light', () => {
  const mesh = floor(2)
  const map = baker([mesh], { sun: { ...UP_SUN, direction: [0, -1, 0] } }).bake()
  approx(dataOf(map.get(mesh))[0], 0, 1e-9)
})

test('occluder casts a shadow on the floor under it', () => {
  const ground = floor(2)
  const roof = plane({ width: 1, height: 1, position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] })
  const map = baker([ground, roof]).bake()
  const data = dataOf(map.get(ground))
  const size = 16
  const center = (size / 2) * size + size / 2
  approx(data[center * 4], 0, 1e-6)
  assert(data[0] > 0.5, 'corner stays lit')
})

test('red wall bleeds red onto the nearby floor (integration, 3 meshes)', () => {
  const ground = floor(4)
  const wall = tintedCopy(plane({ width: 4, height: 4, position: [2, 2, 0], rotation: [0, -Math.PI / 2, 0] }), [0.8, 0.1, 0.1])
  const map = baker([ground, wall], {
    sun: { direction: [-1, 1, 0], color: WHITE, intensity: 3 }, samples: 256, texelsPerMeter: 4,
  }).bake()
  const data = dataOf(map.get(ground))
  const size = 16
  const row = (size / 2) * size
  const near = (row + size - 1) * 4
  const far = row * 4
  assert(data[near] / data[near + 1] > data[far] / data[far + 1] + 0.01, 'near texel is redder than far texel')
  assert(dataOf(map.get(wall))[0] > dataOf(map.get(wall))[1], 'wall itself is red')
})

test('world transform is honoured (translated floor still lit)', () => {
  const mesh = floor(2, { position: [10, 5, -3] })
  const map = baker([mesh]).bake()
  approx(dataOf(map.get(mesh))[0], (0.8 * 3) / Math.PI, 1e-3)
})

test('albedo callback overrides material colour', () => {
  const mesh = floor(2)
  const map = baker([mesh], { albedo: () => [0.2, 0.2, 0.2] }).bake()
  approx(dataOf(map.get(mesh))[0], (0.2 * 3) / Math.PI, 1e-3)
})

// ── Output ────────────────────────────────────────────────────────────────────
test('returns one float DataTexture per mesh', () => {
  const a = floor(2)
  const b = floor(1, { position: [0, 3, 0] })
  const map = baker([a, b]).bake()
  assert.equal(map.size, 2)
  for (const texture of map.values()) {
    assert(texture instanceof DataTexture)
    assert.equal(texture.type, FloatType)
  }
})

test('texel count follows texelsPerMeter', () => {
  const mesh = floor(2)
  assert.equal(baker([mesh], { texelsPerMeter: 8 }).bake().get(mesh).image.width, 16)
  assert.equal(baker([mesh], { texelsPerMeter: 2 }).bake().get(mesh).image.width, 4)
})

test('maxTexels clamps the texture size', () => {
  const mesh = floor(2)
  assert.equal(baker([mesh], { texelsPerMeter: 1000, maxTexels: 8 }).bake().get(mesh).image.width, 8)
})

test('uncovered texels are filled by dilation (no dark fringe)', () => {
  const mesh = floor(2)
  const uv = mesh.geometry.getAttribute('uv1')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5)
  const data = dataOf(baker([mesh], { texelsPerMeter: 16 }).bake().get(mesh))
  const size = Math.sqrt(data.length / 4)
  const just = (Math.floor(size / 2) + 1) * 4
  assert(data[just] > 0.1, 'texel just outside the island is dilated')
})

// ── Determinism / non-destruction / parameters ───────────────────────────────
test('same seed is bit-identical, different seed differs', () => {
  const build = () => [floor(4), plane({ width: 4, height: 4, position: [2, 2, 0], rotation: [0, -Math.PI / 2, 0] })]
  const opts = { sun: { direction: [-1, 1, 0], color: WHITE, intensity: 3 }, samples: 8 }
  const m1 = build()
  const m2 = build()
  const m3 = build()
  const a = dataOf(baker(m1, opts).bake().get(m1[0]))
  const b = dataOf(baker(m2, opts).bake().get(m2[0]))
  const c = dataOf(baker(m3, { ...opts, seed: 99 }).bake().get(m3[0]))
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
})

test('input geometry and transforms are not mutated', () => {
  const mesh = floor(2, { position: [1, 2, 3] })
  const before = [Array.from(mesh.geometry.getAttribute('position').array), Array.from(mesh.geometry.getAttribute('uv1').array), mesh.matrixWorld.elements.slice()]
  baker([mesh]).bake()
  assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), before[0])
  assert.deepEqual(Array.from(mesh.geometry.getAttribute('uv1').array), before[1])
  assert.deepEqual(mesh.matrixWorld.elements, before[2])
})

test('parameters is a live plain object', () => {
  const mesh = floor(2)
  const b = baker([mesh])
  assert.deepEqual(Object.keys(b.parameters).sort(), ['maxTexels', 'samples', 'seed', 'sunIntensity', 'texelsPerMeter'])
  b.parameters.texelsPerMeter = 2
  assert.equal(b.bake().get(mesh).image.width, 4)
  b.parameters.sunIntensity = 6
  b.parameters.texelsPerMeter = 8
  approx(dataOf(b.bake().get(mesh))[0], (0.8 * 6) / Math.PI, 1e-3)
})

test('zero meshes returns an empty map', () => {
  assert.equal(baker([]).bake().size, 0)
})

test('samples = 1 works', () => {
  const mesh = floor(2)
  assert.equal(baker([mesh], { samples: 1 }).bake().size, 1)
})

test('uv2 attribute is accepted as a fallback name', () => {
  const mesh = floor(2)
  mesh.geometry.setAttribute('uv2', mesh.geometry.getAttribute('uv1'))
  mesh.geometry.deleteAttribute('uv1')
  assert.equal(baker([mesh]).bake().size, 1)
})

// ── Validation / security ─────────────────────────────────────────────────────
function throwsRange(fn, pattern) {
  assert.throws(fn, (error) => error instanceof RangeError && pattern.test(error.message))
}

test('rejects bad numeric parameters', () => {
  const mesh = floor(2)
  throwsRange(() => baker([mesh], { texelsPerMeter: 0 }).bake(), /texelsPerMeter/)
  throwsRange(() => baker([mesh], { texelsPerMeter: NaN }).bake(), /texelsPerMeter/)
  throwsRange(() => baker([mesh], { samples: 0 }).bake(), /samples/)
  throwsRange(() => baker([mesh], { samples: 1.5 }).bake(), /samples/)
  throwsRange(() => baker([mesh], { samples: 1e9 }).bake(), /samples/)
  throwsRange(() => baker([mesh], { maxTexels: 0 }).bake(), /maxTexels/)
  throwsRange(() => baker([mesh], { maxTexels: 1e6 }).bake(), /maxTexels/)
  throwsRange(() => baker([mesh], { seed: Infinity }).bake(), /seed/)
})

test('rejects bad sun values', () => {
  const mesh = floor(2)
  throwsRange(() => baker([mesh], { sun: { ...UP_SUN, direction: [0, 0, 0] } }).bake(), /sun direction/)
  throwsRange(() => baker([mesh], { sun: { ...UP_SUN, direction: [NaN, 1, 0] } }).bake(), /sun direction/)
  throwsRange(() => baker([mesh], { sun: { ...UP_SUN, color: [1, Infinity, 1] } }).bake(), /sun color/)
  throwsRange(() => baker([mesh], { sun: { ...UP_SUN, intensity: -1 } }).bake(), /sunIntensity/)
  throwsRange(() => baker([mesh], { sun: { ...UP_SUN, intensity: NaN } }).bake(), /sunIntensity/)
})

test('rejects a sky that returns NaN', () => {
  throwsRange(() => baker([floor(2)], { sky: () => [NaN, 0, 0] }).bake(), /non-finite/)
})

test('rejects a non-finite albedo', () => {
  throwsRange(() => baker([floor(2)], { albedo: () => [NaN, 0, 0] }).bake(), /albedo/)
})

test('mesh without lightmap UVs fails with a clear error', () => {
  const mesh = floor(2, { uv1: false })
  assert.throws(() => baker([mesh]).bake(), /no uv1/)
})

test('mesh with zero UV area fails with a clear error', () => {
  const mesh = floor(2)
  const uv = mesh.geometry.getAttribute('uv1')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5)
  assert.throws(() => baker([mesh]).bake(), /no usable lightmap UV area/)
})

test('degenerate triangles are skipped instead of producing NaN', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2]), 3))
  geometry.setAttribute('uv1', new BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1]), 2))
  const mesh = new Mesh(geometry, new MeshStandardMaterial())
  const data = dataOf(baker([mesh], { texelsPerMeter: 4 }).bake().get(mesh))
  assert(data.every(Number.isFinite))
})

test('user strings cannot reach object keys: result is a Map keyed by Mesh', () => {
  const mesh = floor(2)
  mesh.name = '__proto__'
  const map = baker([mesh]).bake()
  assert(map instanceof Map && map.has(mesh))
  assert.equal(Object.prototype.polluted, undefined)
})

// ── Async + BVH ───────────────────────────────────────────────────────────────
test('bakeAsync matches bake and reports progress', async () => {
  const mesh = floor(2)
  const sync = dataOf(baker([mesh]).bake().get(mesh))
  const seen = []
  const asyncMap = await baker([mesh]).bakeAsync((p) => seen.push(p), 0)
  assert.deepEqual(dataOf(asyncMap.get(mesh)), sync)
  assert(seen.length > 0 && seen[seen.length - 1].rowsDone === seen[seen.length - 1].rowsTotal)
})

test('three-mesh-bvh intersector gives the same lightmap as the built-in one', () => {
  const build = () => [floor(4), plane({ width: 4, height: 4, position: [2, 2, 0], rotation: [0, -Math.PI / 2, 0] })]
  const opts = { sun: { direction: [-1, 1, 0], color: WHITE, intensity: 3 }, samples: 16 }
  const m1 = build()
  const m2 = build()
  const a = dataOf(baker(m1, opts).bake().get(m1[0]))
  const b = dataOf(baker(m2, { ...opts, createIntersector: meshBVHIntersector(MeshBVH) }).bake().get(m2[0]))
  let worst = 0
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]))
  assert(worst < 0.02, `max difference ${worst}`)
})

test('box room: sun enters through the open top and lights the floor', () => {
  const room = new BoxGeometry(4, 4, 4)
  const uv = room.getAttribute('uv')
  const uv1 = new Float32Array(uv.count * 2)
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const k = face * 4 + v
      uv1[k * 2] = (uv.getX(k) + (face % 3)) / 3
      uv1[k * 2 + 1] = (uv.getY(k) + Math.floor(face / 3)) / 2
    }
  }
  room.setAttribute('uv1', new BufferAttribute(uv1, 2))
  const index = room.index
  const kept = []
  for (let t = 0; t < index.count / 3; t++) {
    if (Math.floor(t / 2) === 2) continue
    kept.push(index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2))
  }
  room.setIndex(kept)
  const mesh = new Mesh(room, new MeshStandardMaterial({ color: new Color(0.8, 0.8, 0.8), side: BackSide }))
  const data = dataOf(baker([mesh], { sun: { direction: [0, 1, 0], color: WHITE, intensity: 3 }, samples: 16, texelsPerMeter: 4 }).bake().get(mesh))
  let lit = 0
  for (let i = 0; i < data.length; i += 4) if (data[i] > 0.1) lit++
  assert(lit > 0, 'some texels lit through the open top')
})

for (const { name, fn } of queue) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (error) {
    console.error(`  ✗ ${name}: ${error.message}`)
    failed++
  }
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
