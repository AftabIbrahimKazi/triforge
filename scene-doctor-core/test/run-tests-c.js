import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { SceneDoctor, EditSession, askAdapter, buildExport, bundleToJson, bundleToMarkdown } from '../dist/index.js'
import { defaultRules, registerSceneObjects } from '../dist/three/index.js'
import { DevPanel, DEV_MARKER, isDoctorEnabled } from '../dist/panel/index.js'
import { findDevLeaks } from '../dist/node/index.js'

let pass = 0, fail = 0
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); pass++ }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.stack ?? e.message}`); fail++ }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg) }

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z })
function node(name, over = {}) {
  return { name, type: 'Mesh', children: [], position: vec(), scale: vec(1, 1, 1), visible: true, ...over }
}

console.log('EditSession')
await test('discovers numeric and boolean fields from a parameters object', () => {
  const s = new EditSession()
  s.register('Noise', { parameters: { scale: 5, detail: 2, label: 'x', on: true } })
  assert(s.list().map((d) => d.id).sort().join() === 'Noise.detail,Noise.on,Noise.scale')
})
await test('set records a net edit and reset restores', () => {
  const s = new EditSession()
  const owner = { parameters: { scale: 5 } }
  s.register('N', owner)
  assert(s.set('N.scale', 8) && s.set('N.scale', 9))
  assert(JSON.stringify(s.edits()) === '[{"id":"N.scale","from":5,"to":9}]')
  s.set('N.scale', 5)
  assert(s.edits().length === 0)
  s.set('N.scale', 7); s.reset()
  assert(owner.parameters.scale === 5)
})
await test('rejects NaN, Infinity, wrong type and unknown ids', () => {
  const s = new EditSession()
  s.register('N', { scale: 1, on: false })
  assert(!s.set('N.scale', NaN) && !s.set('N.scale', Infinity))
  assert(!s.set('N.scale', true) && !s.set('N.on', 1) && !s.set('nope', 1))
  assert(s.get('N.scale') === 1)
})
await test('ignores prototype-pollution keys and inherited fields', () => {
  const s = new EditSession()
  const owner = JSON.parse('{"__proto__": {"polluted": 1}, "ok": 2}')
  s.register('P', owner, { keys: ['__proto__', 'constructor', 'toString', 'ok'] })
  assert(s.list().length === 1 && s.list()[0].key === 'ok')
  assert(({}).polluted === undefined)
})
await test('ranges are inferred and overridable', () => {
  const s = new EditSession()
  s.register('R', { a: 10, b: -2, c: 0.5 }, { ranges: { c: [0, 1] } })
  const d = Object.fromEntries(s.list().map((x) => [x.key, x]))
  assert(d.a.min === 0 && d.a.max === 40 && d.b.min === -8 && d.c.max === 1)
})

console.log('registerSceneObjects')
await test('registers transforms, lights and whitelisted material fields', () => {
  const s = new EditSession()
  const mesh = node('Cube', { material: { roughness: 0.4, id: 77, name: 'm' }, rotation: vec() })
  const light = node('Sun', { type: 'DirectionalLight', intensity: 3 })
  registerSceneObjects(s, node('Scene', { type: 'Scene', children: [mesh, light] }))
  const ids = s.list().map((d) => d.id)
  assert(ids.includes('Scene/Cube.position.x') && ids.includes('Scene/Cube.rotation.y'))
  assert(ids.includes('Scene/Cube.material.roughness') && !ids.includes('Scene/Cube.material.id'))
  assert(ids.includes('Scene/Sun.intensity'))
})

console.log('Export')
await test('export bundle holds report and net edits only, json and markdown', () => {
  const s = new EditSession()
  s.register('N', { scale: 1, detail: 2 })
  s.set('N.scale', 3)
  const bundle = buildExport(s, '# scene-doctor 0E 0W 0I')
  assert(bundle.edits.length === 1 && bundle.edits[0].id === 'N.scale' && bundle.edits[0].t === 3)
  assert(JSON.parse(bundleToJson(bundle)).v === 1)
  assert(bundleToMarkdown(bundle).includes('`N.scale`: 1 -> 3'))
  assert(bundleToJson(bundle).length < 400)
})

console.log('AI adapter')
await test('adapter receives a prompt capped to the token budget', async () => {
  let seen = ''
  const adapter = { name: 'fake', complete: async (p) => { seen = p; return 'ok' } }
  const r = await askAdapter(adapter, 'x'.repeat(100000), 'Explain:', 100)
  assert(r.ok && r.text === 'ok' && seen.length <= 400 && r.promptTokens <= 100)
})
await test('adapter failure is returned, not thrown', async () => {
  const r = await askAdapter({ name: 'bad', complete: async () => { throw new Error('offline') } }, 'r', 'q')
  assert(!r.ok && r.error === 'offline')
})

console.log('DevPanel')
function fakeDom() {
  const created = []
  const make = (tag) => {
    const el = {
      tag, style: { cssText: '' }, textContent: null, value: '', checked: false, type: '', min: '', max: '', step: '',
      children: [], listeners: new Map(), removed: false,
      append(...n) { el.children.push(...n) },
      addEventListener(t, h) { el.listeners.set(t, h) },
      removeEventListener(t, h) { if (el.listeners.get(t) === h) el.listeners.delete(t) },
      remove() { el.removed = true },
    }
    created.push(el)
    return el
  }
  return { created, document: { body: { append: () => {} }, createElement: make } }
}
function setup() {
  const { created, document } = fakeDom()
  const session = new EditSession()
  const scene = node('Scene', { type: 'Scene', children: [node('Blob', { scale: vec(0, 1, 1) })] })
  registerSceneObjects(session, scene)
  const doctor = new SceneDoctor({ rules: defaultRules })
  let exported = ''
  const panel = new DevPanel({ session, doctor, getContext: () => ({ scene }), document, onExport: (t) => { exported = t } })
  panel.init()
  return { created, session, panel, scene, get exported() { return exported } }
}
await test('init builds a slider per parameter and shows findings', () => {
  const { created } = setup()
  const ranges = created.filter((e) => e.tag === 'input' && e.type === 'range')
  assert(ranges.length === 12, `got ${ranges.length}`)
  assert(created.find((e) => e.tag === 'pre').textContent.includes('zero-scale'))
})
await test('moving a slider edits the scene and clears the finding', () => {
  const { created, scene } = setup()
  const input = created.find((e) => e.tag === 'input')
  const label = created.filter((e) => e.tag === 'label').find((l) => l.textContent === 'Scene/Blob.scale.x')
  const scaleInput = created.filter((e) => e.tag === 'input')[created.filter((e) => e.tag === 'label').indexOf(label)]
  scaleInput.value = '2'
  scaleInput.listeners.get('input')()
  assert(scene.children[0].scale.x === 2)
  assert(!created.find((e) => e.tag === 'pre').textContent.includes('zero-scale'))
  assert(input !== undefined)
})
await test('integration: slider edit then export carries edit and report', () => {
  const ctx = setup()
  const button = ctx.created.filter((e) => e.tag === 'button').find((b) => b.textContent === 'Export')
  const labels = ctx.created.filter((e) => e.tag === 'label')
  const idx = labels.findIndex((l) => l.textContent === 'Scene/Blob.scale.x')
  const input = ctx.created.filter((e) => e.tag === 'input')[idx]
  input.value = '3'; input.listeners.get('input')()
  button.listeners.get('click')()
  const bundle = JSON.parse(ctx.exported)
  assert(bundle.edits.some((e) => e.id === 'Scene/Blob.scale.x' && e.f === 0 && e.t === 3))
  assert(typeof bundle.report === 'string')
})
await test('expose gives a programmatic api; destroy removes listeners and root', () => {
  const ctx = setup()
  const target = {}
  ctx.panel.expose(target)
  assert(target.__sceneDoctor.set('Scene/Blob.scale.x', 4) && ctx.scene.children[0].scale.x === 4)
  assert(target.__sceneDoctor.edits().length === 1)
  assert(target.__sceneDoctor.export('md').startsWith('# scene-doctor export'))
  ctx.panel.destroy()
  assert(ctx.created.every((e) => e.listeners.size === 0))
  assert(ctx.created.find((e) => e.tag === 'div' && e.style.cssText.includes('fixed')).removed)
})
await test('isDoctorEnabled only for ?doctor=1', () => {
  assert(isDoctorEnabled('?doctor=1') && isDoctorEnabled('?a=1&doctor=1'))
  assert(!isDoctorEnabled('') && !isDoctorEnabled('?doctor=0') && !isDoctorEnabled('?doctor=true'))
})

console.log('Strip check and CLI')
const CLI = fileURLToPath(new URL('../dist/node/cli.js', import.meta.url))
const runCli = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })
const tmp = await mkdtemp(join(tmpdir(), 'sd-'))
await test('findDevLeaks finds the marker only where it exists', async () => {
  await mkdir(join(tmp, 'clean'))
  await mkdir(join(tmp, 'leaky'))
  await writeFile(join(tmp, 'clean', 'app.js'), 'console.error(1)')
  await writeFile(join(tmp, 'leaky', 'app.js'), `var x="${DEV_MARKER}"`)
  assert((await findDevLeaks(join(tmp, 'clean'))).length === 0)
  assert((await findDevLeaks(join(tmp, 'leaky'))).length === 1)
})
await test('cli strip-check exit codes', () => {
  assert(runCli('strip-check', join(tmp, 'clean')).status === 0)
  const bad = runCli('strip-check', join(tmp, 'leaky'))
  assert(bad.status === 1 && bad.stdout.includes('dev code found'))
})
await test('cli scan reports findings and exits 1 on errors', async () => {
  await writeFile(join(tmp, 'clean', 'bad.ts'), 'const x = eval("1")')
  const r = runCli('scan', join(tmp, 'clean'), '--tokens', '200')
  assert(r.status === 1 && r.stdout.includes('eval-use'), r.stdout + r.stderr)
})
await test('cli rejects bad usage with exit 2', () => {
  assert(runCli().status === 2)
  assert(runCli('scan').status === 2)
  assert(runCli('scan', tmp, '--format', 'xml').status === 2)
  assert(runCli('scan', tmp, '--tokens', 'abc').status === 2)
  assert(runCli('scan', join(tmp, 'missing')).status === 2)
})
await rm(tmp, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
