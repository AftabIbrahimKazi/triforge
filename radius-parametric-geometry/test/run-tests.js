import { RadiusParametricGeometry } from '../dist/index.js'

console.log('\n--- UNIT TESTS ---\n')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  PASS  ${name}`)
    passed++
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.message}`)
    failed++
  }
}

test('Creates geometry with position attribute', () => {
  const geom = new RadiusParametricGeometry((u, v) => 1)
  if (!geom.getAttribute('position')) throw new Error('No position attribute')
})

test('Creates geometry with normal attribute', () => {
  const geom = new RadiusParametricGeometry((u, v) => 1)
  if (!geom.getAttribute('normal')) throw new Error('No normal attribute')
})

test('Creates geometry with uv attribute', () => {
  const geom = new RadiusParametricGeometry((u, v) => 1)
  if (!geom.getAttribute('uv')) throw new Error('No uv attribute')
})

test('Creates geometry with index', () => {
  const geom = new RadiusParametricGeometry((u, v) => 1)
  if (!geom.getIndex()) throw new Error('No index')
})

test('Custom radius function (wavy)', () => {
  const geom = new RadiusParametricGeometry((u, v) => 1 + 0.3 * Math.sin(u * Math.PI * 4))
  const stats = geom.getStats()
  if (!stats.vertexCount) throw new Error('No vertices')
})

test('Custom height function', () => {
  const geom = new RadiusParametricGeometry(
    (u, v) => 1 - v,
    (u, v) => v
  )
  const stats = geom.getStats()
  if (!stats.vertexCount) throw new Error('No vertices')
})

test('Torus shape', () => {
  const geom = new RadiusParametricGeometry(
    (u, v) => 1 + 0.5 * Math.cos(v * Math.PI * 2),
    (u, v) => 0.5 * Math.sin(v * Math.PI * 2)
  )
  const stats = geom.getStats()
  if (!stats.triangleCount) throw new Error('No triangles')
})

test('getStats returns valid data', () => {
  const geom = new RadiusParametricGeometry((u, v) => 1)
  const stats = geom.getStats()
  if (!stats.vertexCount || !stats.triangleCount) throw new Error('Invalid stats')
  if (stats.totalMemory <= 0) throw new Error('Invalid memory')
})

test('Custom segment counts', () => {
  const geom = new RadiusParametricGeometry(
    (u, v) => 1,
    () => 0,
    { radiusSegments: 8, heightSegments: 4 }
  )
  const stats = geom.getStats()
  // 8*4*2 = 64 triangles
  if (stats.triangleCount !== 64) throw new Error(`Expected 64 triangles, got ${stats.triangleCount}`)
})

test('Bounding box computed', () => {
  const geom = new RadiusParametricGeometry((u, v) => 1)
  if (!geom.boundingBox) throw new Error('No bounding box')
})

console.log(`\n  ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
