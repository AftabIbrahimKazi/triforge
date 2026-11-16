import { strict as assert } from 'assert'
import { MetaballObject, MetaballWorld } from '../dist/index.js'

let passed = 0
let failed = 0
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++ }
}
function vertexCount(world) {
  return world.mesh.geometry.getAttribute('position')?.count ?? 0
}

console.log('\nMetaballObject')
test('field is strongest at the centre and falls off', () => {
  const ball = new MetaballObject({ position: [0, 0, 0], radius: 1 })
  assert(ball.evaluate(0.1, 0, 0) > ball.evaluate(1, 0, 0))
  assert(ball.evaluate(1, 0, 0) > ball.evaluate(3, 0, 0))
})
test('negative ball subtracts from the field', () => {
  const ball = new MetaballObject({ negative: true })
  assert(ball.evaluate(0.5, 0, 0) < 0)
})
test('parameters are a plain public object', () => {
  const ball = new MetaballObject({ radius: 0.7, strength: 2 })
  assert.deepEqual(ball.parameters, { radius: 0.7, strength: 2 })
})

console.log('\nMetaballWorld')
test('empty world builds without throwing', () => {
  const world = new MetaballWorld()
  world.update()
  assert.equal(vertexCount(world), 0)
})
test('one ball produces a surface', () => {
  const world = new MetaballWorld({ resolution: 16 })
  world.add(new MetaballObject({ radius: 0.6 }))
  world.update()
  assert(vertexCount(world) > 0)
})
test('moving a ball and calling update changes the surface', () => {
  const world = new MetaballWorld({ resolution: 16 })
  const ball = new MetaballObject({ radius: 0.5 })
  world.add(ball)
  world.update()
  const before = world.mesh.geometry.getAttribute('position').array.slice(0, 9)
  ball.position.x += 0.4
  world.update()
  const after = world.mesh.geometry.getAttribute('position').array.slice(0, 9)
  assert.notDeepEqual(Array.from(before), Array.from(after))
})
test('a negative ball carves away geometry', () => {
  const world = new MetaballWorld({ resolution: 20 })
  world.add(new MetaballObject({ radius: 0.8 }))
  world.update()
  const solid = vertexCount(world)
  world.add(new MetaballObject({ position: [0.3, 0, 0], radius: 0.6, negative: true }))
  world.update()
  assert.notEqual(vertexCount(world), solid)
})
test('remove drops a ball', () => {
  const world = new MetaballWorld()
  const ball = new MetaballObject()
  world.add(ball).remove(ball)
  assert.equal(world.balls.length, 0)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
