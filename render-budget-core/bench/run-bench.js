// render-budget-core benchmark — plain Node.js
// Measures the CPU-bound cost of this package's own logic (context-probe loop,
// tier arithmetic, JSON cache read/write). Real-world profileHardware/profileNetwork
// latency is dominated by actual GPU context creation and network round-trips,
// which this package doesn't control and can't benchmark meaningfully outside a
// real browser — this measures what's actually ours: the decision-making overhead
// layered on top of those browser-native calls.
// Run: npm run build && npm run bench

import { profileHardware, profileNetwork, planBudget, initRenderBudget } from '../dist/index.js'

function fakeGl(maxTextureSize = 4096) {
  return {
    MAX_TEXTURE_SIZE: 'MAX_TEXTURE_SIZE',
    getParameter: (name) => (name === 'MAX_TEXTURE_SIZE' ? maxTextureSize : 0),
    getExtension: () => ({ loseContext() {} }),
  }
}
function hardwareEnv() {
  let created = 0
  return {
    createWebGLContext() { if (created >= 16) return null; created++; return fakeGl(8192) },
    loseContext() {},
    async probeImageDecode() { return true },
  }
}
function networkEnv() {
  return { connection: { effectiveType: '4g', downlink: 10, saveData: false }, async probeDownloadMbps() { return 10 } }
}
function memoryStorage() {
  const store = {}
  return { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v } }
}

function timeSync(name, iterations, fn) {
  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) fn()
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  console.log(`  ${name}: ${(ms / iterations * 1000).toFixed(2)} µs/op  (${iterations} iterations, ${ms.toFixed(2)}ms total)`)
}

async function timeAsync(name, iterations, fn) {
  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) await fn()
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  console.log(`  ${name}: ${(ms / iterations).toFixed(3)} ms/op  (${iterations} iterations, ${ms.toFixed(2)}ms total)`)
}

console.log('\nrender-budget-core benchmark\n')

const hw = { maxContexts: 16, maxTextureSize: 8192, supportsAVIF: true, supportsWebP: true }
const net = { effectiveType: '4g', downlinkMbps: 10, saveData: false }

timeSync('planBudget() — pure decision logic, no I/O', 100_000, () => planBudget(hw, net, null))

await timeAsync('profileHardware() — 16-context probe loop (fake env, no real GPU)', 1_000, () => profileHardware(hardwareEnv()))

await timeAsync('profileNetwork() — connection read path (no fallback probe)', 10_000, () => profileNetwork(networkEnv()))

await timeAsync('initRenderBudget() end-to-end, cold cache', 1_000, () => initRenderBudget({ storage: memoryStorage(), hardwareEnv: hardwareEnv(), networkEnv: networkEnv() }))

await (async () => {
  const storage = memoryStorage()
  await initRenderBudget({ storage, hardwareEnv: hardwareEnv(), networkEnv: networkEnv() }) // warm the cache
  await timeAsync('initRenderBudget() end-to-end, warm hardware cache', 1_000, () => initRenderBudget({ storage, hardwareEnv: hardwareEnv(), networkEnv: networkEnv() }))
})()

console.log('\nNote: profileHardware()\'s real-world cost is dominated by actual WebGL context')
console.log('creation/loss on real GPU hardware, not this package\'s own arithmetic — the fake')
console.log('env above only isolates this package\'s loop/overhead cost, not a real device number.\n')
