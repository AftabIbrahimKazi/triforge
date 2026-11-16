import assert from 'assert'

import { applyOfflineMode, PathTracerRenderer } from '../dist/index.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

function makeTarget() {
  return { renderDelay: 100, minSamples: 5, fadeDuration: 500, rasterizeScene: true }
}

console.log('applyOfflineMode')

test('turns off delay, sample gate, fade and raster fallback', () => {
  const target = makeTarget()
  applyOfflineMode(target)
  assert.deepStrictEqual(target, { renderDelay: 0, minSamples: 0, fadeDuration: 0, rasterizeScene: false })
})

test('is idempotent', () => {
  const target = makeTarget()
  applyOfflineMode(target)
  applyOfflineMode(target)
  assert.deepStrictEqual(target, { renderDelay: 0, minSamples: 0, fadeDuration: 0, rasterizeScene: false })
})

test('leaves unrelated properties alone', () => {
  const target = { ...makeTarget(), samples: 7, bounces: 10 }
  applyOfflineMode(target)
  assert.strictEqual(target.samples, 7)
  assert.strictEqual(target.bounces, 10)
})

console.log('PathTracerRenderer')

test('exports the renderer class', () => {
  assert.strictEqual(typeof PathTracerRenderer, 'function')
})

test('declares a compiling getter and keeps ready/samples getters', () => {
  const proto = PathTracerRenderer.prototype
  for (const name of ['ready', 'samples', 'compiling']) {
    assert.strictEqual(typeof Object.getOwnPropertyDescriptor(proto, name)?.get, 'function', name)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exitCode = failed > 0 ? 1 : 0
