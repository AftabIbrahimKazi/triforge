/**
 * Renderer benchmark for @st-particle-core.
 * Measures update() throughput for each renderer at 1 000 and 10 000 particles.
 */

import {
  BillboardRenderer, LineRenderer,
  InstanceRenderer, CollectionRenderer,
} from '../dist/index.js'
import { BoxGeometry, MeshBasicMaterial } from 'three'

const WARMUP = 200
const RUNS   = 2000

function mockParticles(n) {
  return Array.from({ length: n }, (_, i) => ({
    position:     { x: i * 0.01, y: 0, z: 0 },
    velocity:     { x: 1, y: 0.5, z: 0 },
    angularVel:   { x: 0, y: 0,   z: 0 },
    rotation:     { x: 0, y: 0,   z: 0 },
    size:         1,
    normalised:   0.5,
    alive:        true,
    lifetime:     2,
    age:          1,
    emitterIndex: 0,
  }))
}

function bench(label, renderer, particles) {
  for (let i = 0; i < WARMUP; i++) renderer.update(particles, particles.length)
  const t0 = performance.now()
  for (let i = 0; i < RUNS; i++) renderer.update(particles, particles.length)
  const ms = (performance.now() - t0) / RUNS
  console.log(`  ${label.padEnd(38)} ${ms.toFixed(4)} ms/frame`)
}

console.log(`\n@st-particle-core renderer benchmark (${RUNS} runs, averaged)\n`)

for (const n of [1000, 10000]) {
  const particles = mockParticles(n)
  console.log(`── ${n.toLocaleString()} particles ──────────────────────────────`)
  bench('BillboardRenderer.update()',   new BillboardRenderer({ maxCount: n }), particles)
  bench('LineRenderer.update()',        new LineRenderer({ maxCount: n }),       particles)
  bench('InstanceRenderer.update()',    new InstanceRenderer({
    geometry: new BoxGeometry(), material: new MeshBasicMaterial(),
    maxCount: n, billboard: false,
  }), particles)
  bench('CollectionRenderer.update() ×2 meshes', new CollectionRenderer({
    meshes: [
      { geometry: new BoxGeometry(), material: new MeshBasicMaterial() },
      { geometry: new BoxGeometry(), material: new MeshBasicMaterial() },
    ],
    maxCount: n, billboard: false,
  }), particles)
  console.log()
}
