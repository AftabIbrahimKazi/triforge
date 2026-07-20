// render-budget-core tests — plain Node.js, no framework
// Run: npm run build && npm test

import {
  profileHardware,
  profileNetwork,
  planBudget,
  initRenderBudget,
  getUserOverride,
  setUserOverride,
  clearUserOverride,
} from '../dist/index.js'

let pass = 0, fail = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    pass++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    fail++
  }
}
async function testAsync(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    pass++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.stack ?? e.message}`)
    fail++
  }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg) }

// ─── Fakes ──────────────────────────────────────────────────────────────────

function fakeGl(maxTextureSize = 4096) {
  return {
    MAX_TEXTURE_SIZE: 'MAX_TEXTURE_SIZE',
    getParameter(name) { return name === 'MAX_TEXTURE_SIZE' ? maxTextureSize : 0 },
    getExtension() { return { loseContext() {} } },
  }
}

function hardwareEnv({ maxContexts = 16, maxTextureSize = 4096, avif = true, webp = true, failAfter = Infinity } = {}) {
  let created = 0
  return {
    createWebGLContext() {
      if (created >= maxContexts || created >= failAfter) return null
      created++
      return fakeGl(maxTextureSize)
    },
    loseContext() {},
    async probeImageDecode(format) {
      return format === 'avif' ? avif : webp
    },
  }
}

function networkEnv({ connection, downloadMbps = null } = {}) {
  return {
    connection,
    async probeDownloadMbps() { return downloadMbps },
  }
}

function memoryStorage(initial = {}) {
  const store = { ...initial }
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v },
    _dump: () => store,
  }
}

// ─── DeviceProfiler: hardware ──────────────────────────────────────────────
console.log('\nDeviceProfiler — hardware')

await testAsync('profileHardware finds the real context ceiling (capped env)', async () => {
  const profile = await profileHardware(hardwareEnv({ maxContexts: 6 }))
  assert(profile.maxContexts === 6, `expected 6, got ${profile.maxContexts}`)
})

await testAsync('profileHardware never exceeds the safety cap even if the env never fails', async () => {
  const profile = await profileHardware(hardwareEnv({ maxContexts: 999 }))
  assert(profile.maxContexts <= 20, `expected <=20 (safety cap), got ${profile.maxContexts}`)
})

await testAsync('profileHardware falls back to a conservative default if context creation always fails', async () => {
  const profile = await profileHardware(hardwareEnv({ maxContexts: 0 }))
  assert(profile.maxContexts === 8, `expected fallback 8, got ${profile.maxContexts}`)
})

await testAsync('profileHardware reads MAX_TEXTURE_SIZE from a real context', async () => {
  const profile = await profileHardware(hardwareEnv({ maxTextureSize: 8192 }))
  assert(profile.maxTextureSize === 8192, `expected 8192, got ${profile.maxTextureSize}`)
})

await testAsync('profileHardware reports AVIF/WebP support from the probe, independently', async () => {
  const profile = await profileHardware(hardwareEnv({ avif: false, webp: true }))
  assert(profile.supportsAVIF === false, 'expected AVIF unsupported')
  assert(profile.supportsWebP === true, 'expected WebP supported')
})

await testAsync('profileHardware treats a probe rejection as unsupported, not a thrown error', async () => {
  const env = hardwareEnv()
  env.probeImageDecode = async () => { throw new Error('decode boom') }
  const profile = await profileHardware(env)
  assert(profile.supportsAVIF === false && profile.supportsWebP === false)
})

// ─── DeviceProfiler: network ────────────────────────────────────────────────
console.log('\nDeviceProfiler — network')

await testAsync('profileNetwork prefers navigator.connection when present', async () => {
  const profile = await profileNetwork(networkEnv({ connection: { effectiveType: '3g', downlink: 2, saveData: false } }))
  assert(profile.effectiveType === '3g')
  assert(profile.downlinkMbps === 2)
  assert(profile.saveData === false)
})

await testAsync('profileNetwork falls back to the timed probe when connection is unavailable (e.g. Safari)', async () => {
  const profile = await profileNetwork(networkEnv({ connection: undefined, downloadMbps: 8 }))
  assert(profile.effectiveType === '4g', `expected classified 4g, got ${profile.effectiveType}`)
  assert(profile.downlinkMbps === 8)
})

await testAsync('profileNetwork reports unknown when the fallback probe itself fails', async () => {
  const env = networkEnv({ connection: undefined })
  env.probeDownloadMbps = async () => { throw new Error('network boom') }
  const profile = await profileNetwork(env)
  assert(profile.effectiveType === 'unknown')
  assert(profile.downlinkMbps === null)
})

await testAsync('profileNetwork honors saveData from navigator.connection', async () => {
  const profile = await profileNetwork(networkEnv({ connection: { effectiveType: '4g', downlink: 10, saveData: true } }))
  assert(profile.saveData === true)
})

// ─── BudgetPlanner: precedence order ────────────────────────────────────────
console.log('\nBudgetPlanner — precedence')

test('strong hardware + strong network -> high tier, avif format, full shaders', () => {
  const hw = { maxContexts: 16, maxTextureSize: 8192, supportsAVIF: true, supportsWebP: true }
  const net = { effectiveType: '4g', downlinkMbps: 10, saveData: false }
  const plan = planBudget(hw, net, null)
  assert(plan.textureTier === 'high')
  assert(plan.textureFormat === 'avif')
  assert(plan.shaderComplexity === 'full')
  assert(plan.source === 'auto')
})

test('strong GPU + weak network -> capped by network (min rule)', () => {
  const hw = { maxContexts: 16, maxTextureSize: 8192, supportsAVIF: true, supportsWebP: true }
  const net = { effectiveType: '2g', downlinkMbps: 0.5, saveData: false }
  const plan = planBudget(hw, net, null)
  assert(plan.textureTier === 'low', `expected low, got ${plan.textureTier}`)
  // shader complexity is hardware-only — a weak network must not degrade it
  assert(plan.shaderComplexity === 'full')
})

test('weak GPU + strong network -> capped by hardware (min rule)', () => {
  const hw = { maxContexts: 2, maxTextureSize: 1024, supportsAVIF: false, supportsWebP: false }
  const net = { effectiveType: '4g', downlinkMbps: 20, saveData: false }
  const plan = planBudget(hw, net, null)
  assert(plan.textureTier === 'potato', `expected potato, got ${plan.textureTier}`)
  assert(plan.shaderComplexity === 'baked-only')
})

test('AVIF-incapable hardware never gets the high tier, even with 8k texture support', () => {
  const hw = { maxContexts: 16, maxTextureSize: 8192, supportsAVIF: false, supportsWebP: true }
  const net = { effectiveType: '4g', downlinkMbps: 20, saveData: false }
  const plan = planBudget(hw, net, null)
  assert(plan.textureTier === 'mid', `expected mid (AVIF gates high), got ${plan.textureTier}`)
  assert(plan.textureFormat === 'jpg')
})

test('saveData forces potato texture tier regardless of strong hardware/network', () => {
  const hw = { maxContexts: 16, maxTextureSize: 8192, supportsAVIF: true, supportsWebP: true }
  const net = { effectiveType: '4g', downlinkMbps: 50, saveData: true }
  const plan = planBudget(hw, net, null)
  assert(plan.textureTier === 'potato')
  assert(plan.source === 'save-data')
})

test('saveData does not degrade shaderComplexity or maxConcurrentContexts (texture-axis only)', () => {
  const hw = { maxContexts: 16, maxTextureSize: 8192, supportsAVIF: true, supportsWebP: true }
  const net = { effectiveType: '4g', downlinkMbps: 50, saveData: true }
  const plan = planBudget(hw, net, null)
  assert(plan.shaderComplexity === 'full')
  assert(plan.maxConcurrentContexts === 16)
})

test('manual override wins outright over both saveData and hardware/network', () => {
  const hw = { maxContexts: 2, maxTextureSize: 1024, supportsAVIF: false, supportsWebP: false }
  const net = { effectiveType: '2g', downlinkMbps: 0.2, saveData: true }
  const plan = planBudget(hw, net, { textureTier: 'high' })
  assert(plan.textureTier === 'high')
  assert(plan.source === 'manual-override')
})

test('manual override partial fields fall back to computed values for the rest', () => {
  const hw = { maxContexts: 16, maxTextureSize: 8192, supportsAVIF: true, supportsWebP: true }
  const net = { effectiveType: '4g', downlinkMbps: 10, saveData: false }
  const plan = planBudget(hw, net, { shaderComplexity: 'reduced' })
  assert(plan.shaderComplexity === 'reduced', 'explicit override field respected')
  assert(plan.textureTier === 'high', 'unspecified field still computed from hardware/network')
})

// ─── RenderBudgetSystem: integration ────────────────────────────────────────
console.log('\nRenderBudgetSystem — integration')

await testAsync('init() with no overrides runs full auto detection end-to-end', async () => {
  const storage = memoryStorage()
  const plan = await initRenderBudget({
    storage,
    hardwareEnv: hardwareEnv({ maxContexts: 16, maxTextureSize: 8192, avif: true }),
    networkEnv: networkEnv({ connection: { effectiveType: '4g', downlink: 10, saveData: false } }),
  })
  assert(plan.source === 'auto')
  assert(plan.textureTier === 'high')
})

await testAsync('init() caches the hardware profile across calls (network still re-probed)', async () => {
  const storage = memoryStorage()
  let hwProbeCount = 0
  const makeHwEnv = () => {
    const env = hardwareEnv({ maxContexts: 10, maxTextureSize: 4096 })
    const original = env.createWebGLContext.bind(env)
    env.createWebGLContext = (...args) => { hwProbeCount++; return original(...args) }
    return env
  }
  await initRenderBudget({ storage, hardwareEnv: makeHwEnv(), networkEnv: networkEnv({ connection: { effectiveType: '3g', downlink: 2, saveData: false } }) })
  const countAfterFirst = hwProbeCount
  assert(countAfterFirst > 0, 'first call should have probed hardware')

  await initRenderBudget({ storage, hardwareEnv: makeHwEnv(), networkEnv: networkEnv({ connection: { effectiveType: '2g', downlink: 0.3, saveData: false } }) })
  assert(hwProbeCount === countAfterFirst, 'second call should reuse the cached hardware profile, not re-probe')
})

await testAsync('init() honors a persisted user override and skips auto-detection\'s texture decision', async () => {
  const storage = memoryStorage()
  setUserOverride(storage, { textureTier: 'low' })
  const plan = await initRenderBudget({
    storage,
    hardwareEnv: hardwareEnv({ maxContexts: 16, maxTextureSize: 8192, avif: true }),
    networkEnv: networkEnv({ connection: { effectiveType: '4g', downlink: 50, saveData: false } }),
  })
  assert(plan.textureTier === 'low')
  assert(plan.source === 'manual-override')
})

await testAsync('clearUserOverride() restores auto-detection on the next init()', async () => {
  const storage = memoryStorage()
  setUserOverride(storage, { textureTier: 'potato' })
  clearUserOverride(storage)
  assert(getUserOverride(storage) === null)
  const plan = await initRenderBudget({
    storage,
    hardwareEnv: hardwareEnv({ maxContexts: 16, maxTextureSize: 8192, avif: true }),
    networkEnv: networkEnv({ connection: { effectiveType: '4g', downlink: 50, saveData: false } }),
  })
  assert(plan.source === 'auto')
})

await testAsync('dev override (allowDevOverride) can force a worse tier than auto-detected', async () => {
  const storage = memoryStorage()
  const plan = await initRenderBudget({
    storage,
    allowDevOverride: true,
    readDevOverrideParam: () => 'potato',
    hardwareEnv: hardwareEnv({ maxContexts: 16, maxTextureSize: 8192, avif: true }),
    networkEnv: networkEnv({ connection: { effectiveType: '4g', downlink: 50, saveData: false } }),
  })
  assert(plan.textureTier === 'potato')
  assert(plan.source === 'manual-override')
})

await testAsync('dev override cannot force a BETTER tier than auto-detected', async () => {
  const storage = memoryStorage()
  const plan = await initRenderBudget({
    storage,
    allowDevOverride: true,
    readDevOverrideParam: () => 'high',
    hardwareEnv: hardwareEnv({ maxContexts: 2, maxTextureSize: 1024, avif: false }),
    networkEnv: networkEnv({ connection: { effectiveType: '2g', downlink: 0.2, saveData: false } }),
  })
  assert(plan.textureTier === 'potato', `dev override must not beat auto-detected floor, got ${plan.textureTier}`)
  assert(plan.source === 'auto', 'unhonored dev override must not be reported as a manual override')
})

await testAsync('dev override is ignored entirely when allowDevOverride is false', async () => {
  const storage = memoryStorage()
  const plan = await initRenderBudget({
    storage,
    allowDevOverride: false,
    readDevOverrideParam: () => 'potato',
    hardwareEnv: hardwareEnv({ maxContexts: 16, maxTextureSize: 8192, avif: true }),
    networkEnv: networkEnv({ connection: { effectiveType: '4g', downlink: 50, saveData: false } }),
  })
  assert(plan.textureTier === 'high')
  assert(plan.source === 'auto')
})

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n  ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
