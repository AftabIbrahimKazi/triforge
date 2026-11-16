import { writeFileSync } from 'fs'
import { BoxGeometry, BufferAttribute, Color, Mesh, MeshStandardMaterial } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { LightBaker, meshBVHIntersector } from '../dist/index.js'
import { bakeBoxLightmaps, faceFramesFromBoxArrays } from '../../examples/ab-test/bake-lightmaps.js'

const SAMPLES = 32
const TEXELS_PER_METER = 4
const RUNS = 3
const SUN = { direction: [-0.5, 0.8, 0.3], color: [1, 0.95, 0.85], intensity: 3 }
const SKY = (d) => [0.3 + 0.2 * d[1], 0.45 + 0.2 * d[1], 0.7]

const BOXES = [
  { size: [60, 0.5, 60], at: [0, -0.25, 0], albedo: [0.3, 0.45, 0.25] },
  { size: [4, 6, 4], at: [-8, 3, 4], albedo: [0.7, 0.3, 0.25] },
  { size: [6, 3, 3], at: [6, 1.5, -5], albedo: [0.6, 0.6, 0.65] },
  { size: [3, 9, 3], at: [0, 4.5, -12], albedo: [0.75, 0.7, 0.55] },
  { size: [5, 2, 5], at: [10, 1, 10], albedo: [0.5, 0.5, 0.8] },
]

function boxMesh({ size, at, albedo }) {
  const geometry = new BoxGeometry(...size)
  const uv = geometry.getAttribute('uv')
  const packed = new Float32Array(uv.count * 2)
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const k = face * 4 + v
      packed[k * 2] = (uv.getX(k) + (face % 3)) / 3
      packed[k * 2 + 1] = (uv.getY(k) + Math.floor(face / 3)) / 2
    }
  }
  geometry.setAttribute('uv1', new BufferAttribute(packed, 2))
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: new Color(...albedo) }))
  mesh.position.set(...at)
  mesh.updateMatrixWorld(true)
  return mesh
}

function time(label, fn) {
  fn()
  const samples = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    fn()
    samples.push(performance.now() - t0)
  }
  const ms = samples.reduce((a, b) => a + b, 0) / RUNS
  console.log(`  ${label}: ${ms.toFixed(0)} ms`)
  return ms
}

function texelCount(map) {
  let total = 0
  for (const texture of map.values()) total += texture.image.width * texture.image.height
  return total
}

function spikeInputs() {
  const boxes = BOXES.map(({ size, at, albedo }) => ({
    min: [at[0] - size[0] / 2, at[1] - size[1] / 2, at[2] - size[2] / 2],
    max: [at[0] + size[0] / 2, at[1] + size[1] / 2, at[2] + size[2] / 2],
    albedo,
  }))
  const faceFrames = BOXES.map(({ size, at }) => {
    const g = new BoxGeometry(...size)
    return faceFramesFromBoxArrays(g.getAttribute('position').array, g.getAttribute('uv').array, g.getAttribute('normal').array)
      .map((f) => ({ ...f, origin: f.origin.map((v, i) => v + at[i]) }))
  })
  return { boxes, faceFrames }
}

const meshes = BOXES.map(boxMesh)
const base = { sun: SUN, sky: SKY, texelsPerMeter: TEXELS_PER_METER, samples: SAMPLES, maxTexels: 512 }

console.log('\nst-bake-core benchmark (outdoor scene, 5 boxes, 60 triangles)')
let texels = 0
const builtIn = time('built-in BVH', () => { texels = texelCount(new LightBaker(meshes, base).bake()) })
const bvh = time('three-mesh-bvh', () => {
  new LightBaker(meshes, { ...base, createIntersector: meshBVHIntersector(MeshBVH) }).bake()
})

const { boxes, faceFrames } = spikeInputs()
let spikeTexels = 0
const spike = time('hand-written analytic boxes (ab-test spike)', () => {
  const lightmaps = bakeBoxLightmaps({
    boxes, faceFrames,
    sun: { direction: SUN.direction.map((v) => v / Math.hypot(...SUN.direction)), color: SUN.color, intensity: SUN.intensity },
    sky: SKY, texelsPerMeter: TEXELS_PER_METER, maxTexels: 512, samples: SAMPLES,
  })
  spikeTexels = lightmaps.flat().reduce((sum, m) => sum + m.width * m.height, 0)
})

const perK = (ms, count) => ((ms / count) * 1000).toFixed(3)
const lines = [
  `# st-bake-core benchmark — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Scene: 5 boxes (60 triangles), ${TEXELS_PER_METER} texels/m, ${SAMPLES} samples, one bounce. Mean of ${RUNS} runs after one warm-up. Node ${process.version}.`,
  '',
  '| Variant | Total ms | Texels | ms per 1000 texels |',
  '|---|---|---|---|',
  `| built-in BVH (no dependency) | ${builtIn.toFixed(0)} | ${texels} | ${perK(builtIn, texels)} |`,
  `| three-mesh-bvh (opt-in) | ${bvh.toFixed(0)} | ${texels} | ${perK(bvh, texels)} |`,
  `| analytic boxes, ab-test spike (boxes only) | ${spike.toFixed(0)} | ${spikeTexels} | ${perK(spike, spikeTexels)} |`,
  '',
  'The spike only handles axis-aligned boxes with per-face textures, so it is the best case for a hand-written baker. Texel counts differ (square atlas per mesh vs one texture per face), hence the per-texel column.',
]
writeFileSync(new URL(`./results-${new Date().toISOString().slice(0, 10)}.md`, import.meta.url), lines.join('\n') + '\n')
console.log(lines.slice(4).join('\n'))
