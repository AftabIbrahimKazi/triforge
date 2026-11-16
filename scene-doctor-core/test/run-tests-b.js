import { SceneDoctor } from '../dist/index.js'
import {
  defaultRules, ShaderErrorCollector, ResourceTracker, classifyFrame, readFrameSample,
} from '../dist/three/index.js'
import { staticRules, collectPageFindings, scanPages } from '../dist/node/index.js'

let pass = 0, fail = 0
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); pass++ }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.stack ?? e.message}`); fail++ }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg) }

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z })
const emptyScene = { name: 'Scene', type: 'Scene', children: [], position: vec(), scale: vec(1, 1, 1), visible: true }
const info = (geometries = 1, textures = 1, calls = 1, triangles = 1) => ({
  memory: { geometries, textures }, render: { calls, triangles },
})

console.log('Shader errors')
await test('collector records vertex and fragment logs and chains the previous hook', () => {
  let chained = 0
  const renderer = { info: info(), debug: { onShaderError: () => { chained++ } } }
  const collector = new ShaderErrorCollector()
  collector.attach(renderer)
  const gl = { getShaderInfoLog: (s) => (s === 'v' ? null : 'ERROR: 0:5: undeclared identifier') }
  renderer.debug.onShaderError(gl, {}, 'v', 'f')
  assert(collector.list().length === 1 && collector.list()[0].startsWith('fragment:'))
  assert(chained === 1)
  collector.destroy()
  assert(renderer.debug.onShaderError !== null && collector.list().length === 0)
})
await test('shader error becomes an error finding', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const f = doc.run({ scene: emptyScene, shaderErrors: ['fragment: boom'] })
  assert(f.length === 1 && f[0].rule === 'shader-compile-error' && f[0].severity === 'error')
})
await test('collector tolerates a renderer without debug', () => {
  const c = new ShaderErrorCollector()
  c.attach({ info: info() })
  c.destroy()
})

console.log('Renderer rules')
await test('draw call and triangle budgets flag only when exceeded', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const within = doc.run({ scene: emptyScene, renderer: { info: info(1, 1, 10, 100) } })
  assert(within.length === 0)
  const over = doc.run({ scene: emptyScene, renderer: { info: info(1, 1, 900, 2_000_000) } })
  assert(over.map((x) => x.rule).sort().join() === 'draw-call-budget,triangle-budget')
})
await test('custom budgets override defaults', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const f = doc.run({ scene: emptyScene, renderer: { info: info(1, 1, 20, 10) }, budgets: { maxDrawCalls: 10 } })
  assert(f.length === 1 && f[0].rule === 'draw-call-budget')
})
await test('tracker flags steadily growing geometry count only', () => {
  const t = new ResourceTracker()
  for (let i = 0; i < 20; i++) t.sample(info(5 + i * 2, 4))
  assert(t.leaking().join() === 'geometries')
  const doc = new SceneDoctor({ rules: defaultRules })
  const f = doc.run({ scene: emptyScene, leaks: t })
  assert(f.length === 1 && f[0].rule === 'resource-leak')
})
await test('tracker ignores a count that drops (disposal works)', () => {
  const t = new ResourceTracker()
  for (let i = 0; i < 20; i++) t.sample(info(i % 5 === 0 ? 5 : 5 + i, 4))
  assert(t.leaking().length === 0)
})
await test('tracker needs enough samples before judging', () => {
  const t = new ResourceTracker()
  for (let i = 0; i < 5; i++) t.sample(info(i * 100, 1))
  assert(t.leaking().length === 0)
})

console.log('Frame sampling')
await test('classifyFrame separates black, flat and varied', () => {
  const black = new Uint8Array(64 * 4)
  const flat = new Uint8Array(64 * 4).fill(40)
  const varied = new Uint8Array(64 * 4); varied[0] = 200
  assert(classifyFrame(black) === 'black')
  assert(classifyFrame(flat) === 'uniform')
  assert(classifyFrame(varied) === 'varied')
})
await test('readFrameSample reads an 8x8 grid within bounds', () => {
  const reads = []
  const gl = { RGBA: 1, UNSIGNED_BYTE: 2, readPixels: (x, y, w, h, f, t, out) => { reads.push([x, y]); out.fill(9) } }
  const sample = readFrameSample(gl, 100, 50)
  assert(reads.length === 64 && sample.length === 256)
  assert(reads.every(([x, y]) => x >= 0 && x < 100 && y >= 0 && y < 50))
})
await test('black frame produces an error finding', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const f = doc.run({ scene: emptyScene, frameSample: new Uint8Array(256) })
  assert(f.length === 1 && f[0].rule === 'black-frame')
})

console.log('Static scanner')
const scan = (text, path = 'a.ts') => new SceneDoctor({ rules: staticRules }).run({ files: [{ path, text }] })
await test('flags any, ts-ignore, eval and console.log with file:line', () => {
  const f = scan('const a: any = 1\n// @ts-ignore\neval("x")\nconsole.log(1)')
  const byRule = Object.fromEntries(f.map((x) => [x.rule, x.path]))
  assert(byRule['ts-any'] === 'a.ts:1' && byRule['ts-ignore'] === 'a.ts:2')
  assert(byRule['eval-use'] === 'a.ts:3' && byRule['console-log'] === 'a.ts:4')
})
await test('flags unbounded loops in GLSL strings', () => {
  const f = scan('const frag = `while (true) { x++; }`')
  assert(f.some((x) => x.rule === 'unbounded-loop' && x.severity === 'error'))
})
await test('flags allocation inside animate but not outside', () => {
  const src = [
    'const keep = new THREE.Vector3()',
    'function animate() {',
    '  const v = new THREE.Vector3()',
    '  requestAnimationFrame(animate)',
    '}',
    'const after = new THREE.Vector3()',
  ].join('\n')
  const f = scan(src).filter((x) => x.rule === 'loop-allocation')
  assert(f.length === 1 && f[0].path === 'a.ts:3', JSON.stringify(f))
})
await test('missing-dispose flagged unless dispose is called', () => {
  assert(scan('const g = new THREE.WebGLRenderTarget(4, 4)').some((x) => x.rule === 'missing-dispose'))
  assert(!scan('const g = new THREE.WebGLRenderTarget(4, 4)\ng.dispose()').some((x) => x.rule === 'missing-dispose'))
})
await test('clean source yields nothing', () => {
  assert(scan('export const n: number = 1').length === 0)
})

console.log('Page collector')
function fakePage({ failGoto = false, emit } = {}) {
  const handlers = {}
  return {
    on: (event, fn) => { handlers[event] = fn },
    goto: async () => { if (failGoto) throw new Error('net::ERR_FILE_NOT_FOUND'); emit?.(handlers) },
    waitForTimeout: async () => {},
  }
}
await test('collects console errors, page errors, failed requests and http errors', async () => {
  const page = fakePage({
    emit: (h) => {
      h.console({ type: () => 'error', text: () => 'THREE.WebGLRenderer: Context Lost' })
      h.console({ type: () => 'log', text: () => 'ignored' })
      h.pageerror(new Error('x is not defined'))
      h.requestfailed({ url: () => 'http://x/a.png', failure: () => ({ errorText: 'net::ERR' }) })
      h.response({ status: () => 404, url: () => 'http://x/b.glb' })
      h.response({ status: () => 200, url: () => 'http://x/ok' })
    },
  })
  const f = await collectPageFindings(page, 'http://x/', { settleMs: 0 })
  assert(f.map((x) => x.rule).join() === 'console-error,page-error,request-failed,http-error', f.map((x) => x.rule).join())
})
await test('goto failure becomes a page-load-failed finding, not a throw', async () => {
  const f = await collectPageFindings(fakePage({ failGoto: true }), 'http://x/')
  assert(f.length === 1 && f[0].rule === 'page-load-failed')
})
await test('scanPages closes the browser even when a page fails', async () => {
  let closed = false
  const launcher = { launch: async () => ({ newPage: async () => fakePage({ failGoto: true }), close: async () => { closed = true } }) }
  const f = await scanPages(launcher, ['u1', 'u2'])
  assert(f.length === 2 && closed)
})
await test('long console messages are clipped', async () => {
  const page = fakePage({ emit: (h) => h.console({ type: () => 'error', text: () => 'x'.repeat(5000) }) })
  const f = await collectPageFindings(page, 'u', { settleMs: 0 })
  assert(f[0].message.length === 300)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
