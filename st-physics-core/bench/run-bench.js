import { BufferGeometry, BufferAttribute } from 'three'
import { ClothSimulator, PlaneCollider, SphereCollider, WindForce } from '../dist/index.js'

function bench(name, fn, iters = 1000) {
  fn() // warm-up
  const t0 = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const ms = (performance.now() - t0) / iters
  console.log(`  ${name}: ${ms.toFixed(3)} ms/call`)
  return ms
}

function makeGeometry(segsX, segsY) {
  const cols = segsX + 1, rows = segsY + 1
  const pos = new Float32Array(cols * rows * 3)
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 3
      pos[i] = x / segsX; pos[i+1] = y / segsY
    }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  return geo
}

console.log('\nst-physics-core benchmark\n')

// ── ClothSimulator.step() — 20×20 cloth ──────────────────────────────────────
console.log('ClothSimulator.step() — 20×20 cloth (441 vertices)')
{
  const c = new ClothSimulator(20, 20, { substeps: 4, iterations: 8 })
  c.setFromGeometry(makeGeometry(20, 20))
  c.pinRow(20)
  bench('step(1/60) — gravity only', () => c.step(1/60), 500)
}

{
  const c = new ClothSimulator(20, 20, { substeps: 4, iterations: 8 })
  c.setFromGeometry(makeGeometry(20, 20))
  c.pinRow(20)
  const wind = new WindForce({ direction: [1, 0, 0], strength: 5 })
  c.setWind(wind)
  bench('step(1/60) — gravity + wind', () => c.step(1/60), 500)
}

{
  const c = new ClothSimulator(20, 20, { substeps: 4, iterations: 8 })
  c.setFromGeometry(makeGeometry(20, 20))
  c.pinRow(20)
  const floor = new PlaneCollider({ point: [0, -1, 0], normal: [0, 1, 0] })
  const sphere = new SphereCollider({ center: [0.5, 0, 0], radius: 0.3 })
  c.addCollider(floor)
  c.addCollider(sphere)
  bench('step(1/60) — gravity + 2 colliders', () => c.step(1/60), 500)
}

// ── Higher resolution ─────────────────────────────────────────────────────────
console.log('\nClothSimulator.step() — 40×40 cloth (1681 vertices)')
{
  const c = new ClothSimulator(40, 40, { substeps: 4, iterations: 8 })
  c.setFromGeometry(makeGeometry(40, 40))
  c.pinRow(40)
  bench('step(1/60) — 40×40 gravity only', () => c.step(1/60), 200)
}

// ── Collider resolve ──────────────────────────────────────────────────────────
console.log('\nCollider resolve() — single call')
{
  const p = new PlaneCollider()
  bench('PlaneCollider.resolve()', () => p.resolve(0.5, -0.1, 0.5), 100000)
}
{
  const s = new SphereCollider({ radius: 1 })
  bench('SphereCollider.resolve()', () => s.resolve(0.3, 0.4, 0), 100000)
}

console.log('\nDone.')
