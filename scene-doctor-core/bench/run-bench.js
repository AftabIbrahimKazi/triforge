import { writeFile } from 'node:fs/promises'

import { SceneDoctor, Reporter, EditSession } from '../dist/index.js'
import { defaultRules, registerSceneObjects } from '../dist/three/index.js'
import { staticRules } from '../dist/node/index.js'

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z })
const makeNode = (i) => ({
  name: `m${i}`, type: 'Mesh', children: [], position: vec(i), scale: vec(1, 1, 1), visible: true,
  geometry: { attributes: { position: { array: new Float32Array(3000) } } },
  material: { roughness: 0.5, metalness: 0.1 },
})
const scene = (n) => ({ name: 'Scene', type: 'Scene', children: Array.from({ length: n }, (_, i) => makeNode(i)), position: vec(), scale: vec(1, 1, 1), visible: true })

const rows = []
function measure(name, iterations, fn) {
  fn()
  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) fn()
  const ms = Number(process.hrtime.bigint() - start) / 1e6 / iterations
  rows.push(`| ${name} | ${ms.toFixed(3)} ms |`)
  process.stdout.write(`  ${name}: ${ms.toFixed(3)} ms/op\n`)
}

const doctor = new SceneDoctor({ rules: defaultRules })
const small = scene(100)
const large = scene(1000)
measure('scene scan, 100 objects x 1000 vertices', 200, () => doctor.run({ scene: small }))
measure('scene scan, 1000 objects x 1000 vertices', 20, () => doctor.run({ scene: large }))

const noisy = scene(1000)
noisy.children.forEach((c) => { c.scale = vec(0, 1, 1) })
const findings = doctor.run({ scene: noisy })
const reporter = new Reporter()
measure('report build+render, 1000 findings capped at 1500 tokens', 500, () => reporter.render(reporter.build(findings)))

const files = Array.from({ length: 200 }, (_, i) => ({ path: `f${i}.ts`, text: 'const a = 1\n'.repeat(200) + 'function animate() {\n  requestAnimationFrame(animate)\n}\n' }))
const staticDoctor = new SceneDoctor({ rules: staticRules })
measure('static scan, 200 files x 200 lines', 20, () => staticDoctor.run({ files }))

const session = new EditSession()
registerSceneObjects(session, large)
measure('slider set + edits() across 1000 objects', 500, () => { session.set('Scene/m0.position.x', Math.random()); session.edits() })

const date = new Date().toLocaleDateString("en-CA")
const body = `# scene-doctor-core benchmark ${date}\n\n| Operation | Mean |\n|---|---|\n${rows.join('\n')}\n\nTarget: a 100-object scan stays under 16 ms (dev tool, never shipped to prod).\n`
await writeFile(new URL(`./results-${date}.md`, import.meta.url), body)
process.stdout.write(`wrote bench/results-${date}.md\n`)
