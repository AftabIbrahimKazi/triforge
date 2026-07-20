// context-pool-core benchmark — plain Node.js
// Run: npm run build && npm run bench

import { ContextPool } from '../dist/index.js'

const CANVAS_RECT = { x: 0, y: 0, width: 1000, height: 1000 }
const VISIBLE_REGION = { x: 0, y: 0, width: 1000, height: 1000 }

function makeClients(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    getAnchorRect: () => ({ x: (i % 10) * 100, y: Math.floor(i / 10) * 100, width: 90, height: 90 }),
    render: () => {},
  }))
}

function timeSync(name, iterations, fn) {
  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) fn()
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  console.log(`  ${name}: ${(ms / iterations * 1000).toFixed(2)} µs/op  (${iterations} iterations, ${ms.toFixed(2)}ms total)`)
}

console.log('\ncontext-pool-core benchmark\n')

for (const clientCount of [24, 100, 500]) {
  const pool = new ContextPool({ maxConcurrent: 4, getVisibleRegion: () => VISIBLE_REGION })
  makeClients(clientCount).forEach((c) => pool.register(c))
  timeSync(`tick() with ${clientCount} registered clients (budget=4)`, 10_000, () => pool.tick(CANVAS_RECT))
}

console.log('\nBaseline comparison — the bug pattern this package replaces: naively calling')
console.log('render() on every registered canvas every frame, with no budget/visibility check:\n')

for (const clientCount of [24, 100, 500]) {
  const clients = makeClients(clientCount)
  timeSync(`naive "render everyone, always" loop, ${clientCount} clients`, 10_000, () => {
    for (const c of clients) c.render()
  })
}

console.log('\nNote: the naive loop above is cheaper per-call in this fake-env benchmark because')
console.log('it does zero visibility/budget work — that\'s exactly the missing check that let a')
console.log('real page create one WebGLRenderer (and one real GPU context) per canvas. The cost')
console.log('this package adds is the visibility+budget bookkeeping; the cost it removes is N real')
console.log('WebGL contexts instead of 1, which no Node benchmark can measure but is the entire point.\n')
