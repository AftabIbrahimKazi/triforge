import { SceneDoctor, EditSession } from '../dist/index.js'
import { defaultRules } from '../dist/three/index.js'

let pass = 0, fail = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++ }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.stack ?? e.message}`); fail++ }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg) }

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z })
const node = (name, over = {}) => ({ name, type: 'Mesh', children: [], position: vec(), scale: vec(1, 1, 1), visible: true, ...over })
const sceneWith = (...kids) => ({ scene: node('Scene', { type: 'Scene', children: kids }) })
const run = (ctx) => new SceneDoctor({ rules: defaultRules }).run(ctx)

console.log('Driven properties')
test('a value rewritten by app code is driven, not an edit', () => {
  const s = new EditSession()
  const target = { y: 1 }
  s.register('Ball', target)
  target.y = 1.7
  assert(s.edits().length === 0)
  assert(s.driven().join() === 'Ball.y')
})
test('a slider edit that stays in place is an edit and not driven', () => {
  const s = new EditSession()
  const target = { y: 1 }
  s.register('Ball', target)
  s.set('Ball.y', 3)
  assert(s.edits().length === 1 && s.driven().length === 0)
})
test('a slider edit that app code then overwrites becomes driven', () => {
  const s = new EditSession()
  const target = { y: 1 }
  s.register('Ball', target)
  s.set('Ball.y', 3)
  target.y = 9
  assert(s.edits().length === 0 && s.driven().length === 1)
})
test('reset clears driven state and restores values', () => {
  const s = new EditSession()
  const target = { y: 1 }
  s.register('Ball', target)
  target.y = 5
  s.reset()
  assert(target.y === 1 && s.driven().length === 0)
})
test('static values are never driven', () => {
  const s = new EditSession()
  s.register('Cube', { x: 1, y: 2 })
  assert(s.driven().length === 0)
})

console.log('Texture and shadow rules')
const tex = (width, height) => ({ isTexture: true, image: { width, height } })
test('texture above 4096 is a warning', () => {
  const f = run(sceneWith(node('Big', { material: { map: tex(8192, 4096) } })))
  assert(f.length === 1 && f[0].rule === 'oversized-texture' && f[0].severity === 'warn')
})
test('non power of two texture is info only', () => {
  const f = run(sceneWith(node('Odd', { material: { map: tex(1000, 512) } })))
  assert(f.length === 1 && f[0].rule === 'npot-texture' && f[0].severity === 'info')
})
test('2048 power of two texture is clean', () => {
  assert(run(sceneWith(node('Ok', { material: { map: tex(2048, 2048) } }))).length === 0)
})
test('texture without numeric size is skipped without throwing', () => {
  assert(run(sceneWith(node('Odd', { material: { map: { isTexture: true, image: {} } } }))).length === 0)
})
test('shadow map above 4096 warns, 2048 does not', () => {
  const big = run(sceneWith(node('Sun', { shadow: { mapSize: { x: 8192, y: 8192 } } })))
  assert(big.length === 1 && big[0].rule === 'oversized-shadow-map')
  assert(run(sceneWith(node('Sun', { shadow: { mapSize: { x: 2048, y: 2048 } } }))).length === 0)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
