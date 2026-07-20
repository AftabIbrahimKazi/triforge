// context-pool-core tests — plain Node.js, no framework
// Run: npm run build && npm test

import { ContextPool } from '../dist/index.js'
import { ThreeContextAdapter } from '../dist/adapters/ThreeContextAdapter.js'

let pass = 0, fail = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    pass++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.stack ?? e.message}`)
    fail++
  }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg) }
function assertArraysEqual(a, b, msg) {
  const sa = [...a].sort(), sb = [...b].sort()
  assert(JSON.stringify(sa) === JSON.stringify(sb), msg ?? `expected ${JSON.stringify(sb)}, got ${JSON.stringify(sa)}`)
}

// ─── Fakes ──────────────────────────────────────────────────────────────────

function makeClient(id, { rect = { x: 0, y: 0, width: 100, height: 100 }, priority, onRender } = {}) {
  const calls = []
  return {
    id,
    priority,
    getAnchorRect: () => rect,
    render: (viewport) => { calls.push(viewport); onRender?.(viewport) },
    calls,
    setRect: (r) => { rect = r },
  }
}

const FULL_VIEWPORT = { x: 0, y: 0, width: 1000, height: 1000 }
const CANVAS_RECT = { x: 0, y: 0, width: 1000, height: 1000 }

// ─── ContextPool: visibility ────────────────────────────────────────────────
console.log('\nContextPool — visibility')

test('a client with a normal on-screen rect is active', () => {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  const c = makeClient('a')
  pool.register(c)
  const result = pool.tick(CANVAS_RECT)
  assertArraysEqual(result.active, ['a'])
  assert(c.calls.length === 1)
})

test('a client with a null anchor rect (detached/hidden) is reported as hidden, never rendered', () => {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  const c = makeClient('a', { rect: null })
  pool.register(c)
  const result = pool.tick(CANVAS_RECT)
  assertArraysEqual(result.hidden, ['a'])
  assert(c.calls.length === 0)
})

test('a zero-sized rect counts as hidden, not active', () => {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  const c = makeClient('a', { rect: { x: 0, y: 0, width: 0, height: 50 } })
  pool.register(c)
  const result = pool.tick(CANVAS_RECT)
  assertArraysEqual(result.hidden, ['a'])
})

test('a client entirely outside the visible region is hidden', () => {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => ({ x: 0, y: 0, width: 200, height: 200 }) })
  const c = makeClient('a', { rect: { x: 5000, y: 5000, width: 100, height: 100 } })
  pool.register(c)
  const result = pool.tick(CANVAS_RECT)
  assertArraysEqual(result.hidden, ['a'])
})

test('a client partially overlapping the visible region still counts as visible', () => {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => ({ x: 0, y: 0, width: 200, height: 200 }) })
  const c = makeClient('a', { rect: { x: 150, y: 150, width: 100, height: 100 } })
  pool.register(c)
  const result = pool.tick(CANVAS_RECT)
  assertArraysEqual(result.active, ['a'])
})

// ─── ContextPool: budget ────────────────────────────────────────────────────
console.log('\nContextPool — budget')

test('more visible clients than budget -> excess reported as skipped, not rendered', () => {
  const pool = new ContextPool({ maxConcurrent: 2, getVisibleRegion: () => FULL_VIEWPORT })
  const clients = ['a', 'b', 'c', 'd'].map((id) => makeClient(id))
  clients.forEach((c) => pool.register(c))
  const result = pool.tick(CANVAS_RECT)
  assert(result.active.length === 2, `expected 2 active, got ${result.active.length}`)
  assert(result.skipped.length === 2, `expected 2 skipped, got ${result.skipped.length}`)
  const renderedCount = clients.filter((c) => c.calls.length > 0).length
  assert(renderedCount === 2, `expected exactly 2 clients to actually have render() called, got ${renderedCount}`)
})

test('lower priority number wins a contested slot', () => {
  const pool = new ContextPool({ maxConcurrent: 1, getVisibleRegion: () => FULL_VIEWPORT })
  const low = makeClient('low-priority-number', { priority: 1 })
  const high = makeClient('high-priority-number', { priority: 5 })
  pool.register(high)
  pool.register(low)
  const result = pool.tick(CANVAS_RECT)
  assertArraysEqual(result.active, ['low-priority-number'])
})

test('setMaxConcurrent updates the budget for subsequent ticks', () => {
  const pool = new ContextPool({ maxConcurrent: 1, getVisibleRegion: () => FULL_VIEWPORT })
  const a = makeClient('a'), b = makeClient('b')
  pool.register(a); pool.register(b)
  const first = pool.tick(CANVAS_RECT)
  assert(first.active.length === 1)
  pool.setMaxConcurrent(2)
  const second = pool.tick(CANVAS_RECT)
  assert(second.active.length === 2, `expected 2 after raising budget, got ${second.active.length}`)
})

test('a non-finite or negative maxConcurrent degrades to zero active clients, never throws', () => {
  const pool = new ContextPool({ maxConcurrent: NaN, getVisibleRegion: () => FULL_VIEWPORT })
  pool.register(makeClient('a'))
  const result = pool.tick(CANVAS_RECT)
  assert(result.active.length === 0)

  const pool2 = new ContextPool({ maxConcurrent: -5, getVisibleRegion: () => FULL_VIEWPORT })
  pool2.register(makeClient('a'))
  assert(pool2.tick(CANVAS_RECT).active.length === 0)
})

// ─── ContextPool: sticky selection ──────────────────────────────────────────
console.log('\nContextPool — sticky selection (anti-flicker)')

test('a client active last tick keeps its slot this tick over an equally-visible newcomer', () => {
  const pool = new ContextPool({ maxConcurrent: 1, getVisibleRegion: () => FULL_VIEWPORT })
  const a = makeClient('a')
  pool.register(a)
  const first = pool.tick(CANVAS_RECT)
  assertArraysEqual(first.active, ['a'])

  const b = makeClient('b')
  pool.register(b) // b registers after a is already active — no explicit priority difference
  const second = pool.tick(CANVAS_RECT)
  assertArraysEqual(second.active, ['a'], 'a should keep its slot rather than being displaced by b')
  assertArraysEqual(second.skipped, ['b'])
})

test('when a previously-active client goes hidden, a waiting client takes the freed slot', () => {
  const pool = new ContextPool({ maxConcurrent: 1, getVisibleRegion: () => FULL_VIEWPORT })
  const a = makeClient('a')
  const b = makeClient('b')
  pool.register(a); pool.register(b)
  const first = pool.tick(CANVAS_RECT)
  assertArraysEqual(first.active, ['a'])

  a.setRect(null) // a becomes hidden
  const second = pool.tick(CANVAS_RECT)
  assertArraysEqual(second.active, ['b'])
  assertArraysEqual(second.hidden, ['a'])
})

// ─── ContextPool: viewport coordinates ──────────────────────────────────────
console.log('\nContextPool — viewport coordinates')

test('render() receives a viewport relative to the reference rect, not raw page coordinates', () => {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  const c = makeClient('a', { rect: { x: 250, y: 60, width: 40, height: 40 } })
  pool.register(c)
  pool.tick({ x: 200, y: 50, width: 1000, height: 1000 })
  assert(c.calls.length === 1)
  const vp = c.calls[0]
  assert(vp.x === 50 && vp.y === 10 && vp.width === 40 && vp.height === 40, `got ${JSON.stringify(vp)}`)
})

test('unregister removes a client entirely — no longer active, skipped, or hidden', () => {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  const c = makeClient('a')
  pool.register(c)
  pool.tick(CANVAS_RECT)
  pool.unregister('a')
  const result = pool.tick(CANVAS_RECT)
  assert(result.active.length === 0 && result.skipped.length === 0 && result.hidden.length === 0)
})

// ─── ThreeContextAdapter: fakes ──────────────────────────────────────────────

// Real DOMRect exposes both .left/.top and .x/.y (equal, for LTR layouts) — the
// adapter reads .left/.top, so fakes must provide them too, not just .x/.y.
function domRect(x, y, width, height) {
  return { x, y, left: x, top: y, width, height }
}

class FakeCanvas extends EventTarget {
  constructor(rect) { super(); this._rect = rect }
  getBoundingClientRect() { return this._rect }
}

function fakeRenderer(canvasRect) {
  const renderCalls = []
  const scissorCalls = []
  return {
    domElement: new FakeCanvas(canvasRect),
    setScissorTest(v) { scissorCalls.push({ type: 'test', value: v }) },
    setScissor(x, y, w, h) { scissorCalls.push({ type: 'scissor', x, y, w, h }) },
    setViewport(x, y, w, h) { scissorCalls.push({ type: 'viewport', x, y, w, h }) },
    clear() { scissorCalls.push({ type: 'clear' }) },
    render(scene, camera) { renderCalls.push({ scene, camera }) },
    renderCalls,
    scissorCalls,
  }
}

// ─── ThreeContextAdapter: integration ───────────────────────────────────────
console.log('\nThreeContextAdapter — integration')

test('registerScene + renderFrame calls renderer.render for a visible scene, with y-flipped scissor/viewport', () => {
  const renderer = fakeRenderer(domRect(0, 0, 800, 600))
  const adapter = new ThreeContextAdapter({ renderer, maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  const anchor = { getBoundingClientRect: () => domRect(10, 20, 100, 50) }
  const scene = {}, camera = {}
  adapter.registerScene('orb1', { scene, camera, anchor })

  adapter.renderFrame()

  assert(renderer.renderCalls.length === 1)
  assert(renderer.renderCalls[0].scene === scene && renderer.renderCalls[0].camera === camera)
  // canvas height 600, viewport y=20 height=50 -> glY = 600 - 20 - 50 = 530
  const viewportCall = renderer.scissorCalls.find((c) => c.type === 'viewport')
  assert(viewportCall.x === 10 && viewportCall.y === 530 && viewportCall.w === 100 && viewportCall.h === 50,
    `got ${JSON.stringify(viewportCall)}`)
})

test('unregisterScene stops that scene from being rendered on subsequent frames', () => {
  const renderer = fakeRenderer(domRect(0, 0, 800, 600))
  const adapter = new ThreeContextAdapter({ renderer, maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  const anchor = { getBoundingClientRect: () => domRect(0, 0, 50, 50) }
  adapter.registerScene('orb1', { scene: {}, camera: {}, anchor })
  adapter.renderFrame()
  assert(renderer.renderCalls.length === 1)

  adapter.unregisterScene('orb1')
  adapter.renderFrame()
  assert(renderer.renderCalls.length === 1, 'render count should not have grown after unregistering')
})

test('only maxConcurrent scenes render per frame when more are registered', () => {
  const renderer = fakeRenderer(domRect(0, 0, 800, 600))
  const adapter = new ThreeContextAdapter({ renderer, maxConcurrent: 2, getVisibleRegion: () => FULL_VIEWPORT })
  for (const id of ['a', 'b', 'c', 'd']) {
    adapter.registerScene(id, {
      scene: {}, camera: {},
      anchor: { getBoundingClientRect: () => domRect(0, 0, 50, 50) },
    })
  }
  adapter.renderFrame()
  assert(renderer.renderCalls.length === 2, `expected 2 renders, got ${renderer.renderCalls.length}`)
})

test('contextlost event: preventDefault is called and renderFrame no-ops until restored', () => {
  const renderer = fakeRenderer(domRect(0, 0, 800, 600))
  const adapter = new ThreeContextAdapter({ renderer, maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  adapter.registerScene('a', {
    scene: {}, camera: {},
    anchor: { getBoundingClientRect: () => domRect(0, 0, 50, 50) },
  })

  let prevented = false
  const lostEvent = new Event('webglcontextlost', { cancelable: true })
  const originalPreventDefault = lostEvent.preventDefault.bind(lostEvent)
  lostEvent.preventDefault = () => { prevented = true; originalPreventDefault() }
  renderer.domElement.dispatchEvent(lostEvent)
  assert(prevented, 'expected event.preventDefault() to have been called')

  adapter.renderFrame()
  assert(renderer.renderCalls.length === 0, 'renderFrame should no-op while context is lost')

  renderer.domElement.dispatchEvent(new Event('webglcontextrestored'))
  adapter.renderFrame()
  assert(renderer.renderCalls.length === 1, 'renderFrame should resume after context is restored')
})

test('onContextLost/onContextRestored callbacks fire', () => {
  const renderer = fakeRenderer(domRect(0, 0, 800, 600))
  let lostCalled = false, restoredCalled = false
  const adapter = new ThreeContextAdapter({
    renderer, maxConcurrent: 4,
    onContextLost: () => { lostCalled = true },
    onContextRestored: () => { restoredCalled = true },
  })
  renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  assert(lostCalled)
  renderer.domElement.dispatchEvent(new Event('webglcontextrestored'))
  assert(restoredCalled)
})

test('dispose() removes context-loss listeners', () => {
  const renderer = fakeRenderer(domRect(0, 0, 800, 600))
  let lostCalled = false
  const adapter = new ThreeContextAdapter({ renderer, maxConcurrent: 4, onContextLost: () => { lostCalled = true } })
  adapter.dispose()
  renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  assert(!lostCalled, 'onContextLost should not fire after dispose()')
})

test('renderFrame clears the whole canvas before drawing active viewports (stale-pixel prevention)', () => {
  const renderer = fakeRenderer(domRect(0, 0, 800, 600))
  const adapter = new ThreeContextAdapter({ renderer, maxConcurrent: 4, getVisibleRegion: () => FULL_VIEWPORT })
  adapter.registerScene('a', {
    scene: {}, camera: {},
    anchor: { getBoundingClientRect: () => domRect(0, 0, 50, 50) },
  })
  adapter.renderFrame()
  const clearIndex = renderer.scissorCalls.findIndex((c) => c.type === 'clear')
  const firstScissorTestOffIndex = renderer.scissorCalls.findIndex((c) => c.type === 'test' && c.value === false)
  assert(clearIndex >= 0, 'expected renderer.clear() to have been called')
  assert(firstScissorTestOffIndex === 0, 'scissor test should be disabled before the full clear')
})

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n  ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
