import { SceneDoctor, Reporter, FindingCollector, fingerprint, estimateTokens } from '../dist/index.js'
import { defaultRules } from '../dist/three/index.js'

let pass = 0, fail = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++ }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.stack ?? e.message}`); fail++ }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg) }

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z })
function node(name, over = {}) {
  return { name, type: 'Mesh', children: [], position: vec(), scale: vec(1, 1, 1), visible: true, ...over }
}
function scene(...children) { return node('Scene', { type: 'Scene', children }) }
function raw(over = {}) {
  return { rule: 'r', severity: 'warn', path: 'a/b', message: 'm', ...over }
}

console.log('FindingCollector / fingerprint')
test('identical findings dedupe into one with a count', () => {
  const c = new FindingCollector()
  c.add(raw()); c.add(raw()); c.add(raw())
  assert(c.list().length === 1 && c.list()[0].count === 3)
})
test('different path or cause gives a different fingerprint', () => {
  assert(fingerprint(raw()) !== fingerprint(raw({ path: 'a/c' })))
  assert(fingerprint(raw()) !== fingerprint(raw({ cause: 'x' })))
  assert(fingerprint(raw()) === fingerprint(raw({ message: 'other text' })))
})

console.log('Reporter')
const many = Array.from({ length: 200 }, (_, i) => ({ ...raw({ path: `p${i}`, message: 'x'.repeat(40) }), fingerprint: `f${i}`, count: 1 }))
test('errors rank before warnings and info', () => {
  const r = new Reporter()
  const f = [
    { ...raw({ severity: 'info', path: 'i' }), fingerprint: 'i', count: 9 },
    { ...raw({ severity: 'error', path: 'e' }), fingerprint: 'e', count: 1 },
    { ...raw({ severity: 'warn', path: 'w' }), fingerprint: 'w', count: 1 },
  ]
  const rep = r.build(f)
  assert(rep.findings.map((x) => x.severity).join() === 'error,warn,info')
})
test('maxTokens caps output and counts omitted', () => {
  const r = new Reporter()
  const rep = r.build(many, { maxTokens: 100 })
  const text = r.render(rep)
  assert(rep.omitted > 0 && rep.findings.length < 200)
  assert(estimateTokens(text) <= 130, `got ${estimateTokens(text)} tokens`)
  assert(text.includes('omitted'))
})
test('always keeps at least one finding even under a tiny cap', () => {
  const rep = new Reporter().build(many, { maxTokens: 1 })
  assert(rep.findings.length === 1)
})
test('empty findings render a header only', () => {
  const r = new Reporter()
  assert(r.render(r.build([])) === '# scene-doctor 0E 0W 0I')
})
test('all three formats render and json parses per line', () => {
  const r = new Reporter()
  const rep = r.build(many.slice(0, 3))
  assert(r.render(rep, 'md').startsWith('## scene-doctor'))
  const lines = r.render(rep, 'json').split('\n')
  lines.forEach((l) => JSON.parse(l))
})
test('compact is smaller than json for the same findings', () => {
  const r = new Reporter()
  const rep = r.build(many.slice(0, 20), { maxTokens: 99999 })
  assert(r.render(rep, 'compact').length < r.render(rep, 'json').length)
})

console.log('SceneDoctor delta mode')
test('delta reports only new or changed findings after a commit', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const s = scene(node('Bad', { scale: vec(0, 1, 1) }))
  const first = doc.report(doc.run({ scene: s }), { delta: true })
  assert(first.includes('zero-scale'))
  const second = doc.report(doc.run({ scene: s }), { delta: true })
  assert(second === '# scene-doctor 0E 0W 0I', second)
  s.children.push(node('Worse', { position: vec(NaN, 0, 0) }))
  const third = doc.report(doc.run({ scene: s }), { delta: true })
  assert(third.includes('non-finite-transform') && !third.includes('zero-scale'), third)
})

console.log('Three rules')
test('NaN geometry flagged with count and path', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const m = node('Blob', { geometry: { attributes: { position: { array: [0, NaN, 1, Infinity] } } } })
  const f = doc.run({ scene: scene(m) })
  assert(f.length === 1 && f[0].rule === 'non-finite-geometry' && f[0].path === 'Scene/Blob')
  assert(f[0].message.startsWith('2 '))
})
test('zero scale flagged only when visible', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const f = doc.run({ scene: scene(node('A', { scale: vec(0, 1, 1) }), node('B', { scale: vec(0, 1, 1), visible: false })) })
  assert(f.length === 1 && f[0].path === 'Scene/A')
})
test('unloaded texture flagged, loaded texture ignored', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const mat = { map: { isTexture: true }, normalMap: { isTexture: true, image: {} }, roughness: 0.5 }
  const f = doc.run({ scene: scene(node('T', { material: mat })) })
  assert(f.length === 1 && f[0].message.includes('"map"'))
})
test('clean scene yields no findings', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  assert(doc.run({ scene: scene(node('Ok')) }).length === 0)
})
test('unnamed siblings get distinct paths', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const f = doc.run({ scene: scene(node('', { scale: vec(0, 1, 1) }), node('', { scale: vec(0, 1, 1) })) })
  assert(f.length === 2)
})
test('1000-object scene scans quickly', () => {
  const doc = new SceneDoctor({ rules: defaultRules })
  const kids = Array.from({ length: 1000 }, (_, i) => node(`m${i}`, { geometry: { attributes: { position: { array: new Float32Array(300) } } } }))
  const t = performance.now()
  doc.run({ scene: scene(...kids) })
  assert(performance.now() - t < 100, `took ${performance.now() - t}ms`)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
