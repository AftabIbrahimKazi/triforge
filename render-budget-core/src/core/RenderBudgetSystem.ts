import { createBrowserHardwareEnv, createBrowserNetworkEnv, profileHardware, profileNetwork } from './DeviceProfiler.js'
import { planBudget } from './BudgetPlanner.js'
import type {
  BudgetStorage,
  HardwareProbeEnv,
  HardwareProfile,
  NetworkProbeEnv,
  RenderBudgetOverride,
  RenderBudgetPlan,
  TextureVariantTier,
} from './types.js'

/** Bump when profileHardware()'s probing logic changes in a way that invalidates old cached profiles. */
const HARDWARE_CACHE_VERSION = 1
const HARDWARE_CACHE_KEY = 'triforge-render-budget:hardware'
const USER_OVERRIDE_KEY = 'triforge-render-budget:user-override'

const TIER_ORDER: TextureVariantTier[] = ['potato', 'low', 'mid', 'high']
function tierRank(tier: TextureVariantTier): number {
  return TIER_ORDER.indexOf(tier)
}

export interface RenderBudgetSystemConfig {
  /** Let end users persist an explicit quality choice (e.g. a settings panel). Default true. */
  allowUserOverride?: boolean
  /**
   * Let a `?forceQuality=` query param force a tier for testing. Default false (opt-in per
   * consumer, e.g. `!isProd`). Can only force a WORSE tier than auto-detected — never better —
   * so a real visitor can't report an unreproducible performance bug by forcing a higher tier
   * than their device actually supports.
   */
  allowDevOverride?: boolean
  /** Small fixed-size asset used to time-probe download speed where navigator.connection is unavailable. */
  probeAssetUrl?: string
  storage?: BudgetStorage
  hardwareEnv?: HardwareProbeEnv
  networkEnv?: NetworkProbeEnv
  /** Override how the dev query param is read — for tests; defaults to location.search. */
  readDevOverrideParam?: () => string | null
}

function defaultStorage(): BudgetStorage {
  if (typeof localStorage === 'undefined') {
    // No persistent storage available (e.g. a non-browser test host without one injected) —
    // degrade to a no-op so callers still get a working (just non-persistent) system.
    return { getItem: () => null, setItem: () => {} }
  }
  return localStorage
}

function defaultReadDevOverrideParam(): string | null {
  if (typeof location === 'undefined') return null
  return new URLSearchParams(location.search).get('forceQuality')
}

function readCachedHardware(storage: BudgetStorage): HardwareProfile | null {
  const raw = storage.getItem(HARDWARE_CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { version: number; profile: HardwareProfile }
    if (parsed.version !== HARDWARE_CACHE_VERSION) return null
    return parsed.profile
  } catch {
    return null
  }
}

function writeCachedHardware(storage: BudgetStorage, profile: HardwareProfile): void {
  storage.setItem(HARDWARE_CACHE_KEY, JSON.stringify({ version: HARDWARE_CACHE_VERSION, profile }))
}

export function getUserOverride(storage: BudgetStorage): RenderBudgetOverride | null {
  const raw = storage.getItem(USER_OVERRIDE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as RenderBudgetOverride
  } catch {
    return null
  }
}

export function setUserOverride(storage: BudgetStorage, override: RenderBudgetOverride): void {
  storage.setItem(USER_OVERRIDE_KEY, JSON.stringify(override))
}

export function clearUserOverride(storage: BudgetStorage): void {
  storage.setItem(USER_OVERRIDE_KEY, '')
}

function isValidTextureTier(value: string | null): value is TextureVariantTier {
  return value === 'high' || value === 'mid' || value === 'low' || value === 'potato'
}

export async function init(config: RenderBudgetSystemConfig = {}): Promise<RenderBudgetPlan> {
  const allowUserOverride = config.allowUserOverride ?? true
  const allowDevOverride = config.allowDevOverride ?? false
  const storage = config.storage ?? defaultStorage()
  const hardwareEnv = config.hardwareEnv ?? createBrowserHardwareEnv()
  const networkEnv = config.networkEnv ?? createBrowserNetworkEnv(config.probeAssetUrl ?? '')
  const readDevOverrideParam = config.readDevOverrideParam ?? defaultReadDevOverrideParam

  // Step 1 (cheap, synchronous): user override wins outright, skips all detection.
  if (allowUserOverride) {
    const userOverride = getUserOverride(storage)
    if (userOverride) {
      // Still need a hardware profile to fill in fields the override doesn't specify
      // (e.g. a user who only picked a texture tier still needs a real shaderComplexity).
      const hardware = readCachedHardware(storage) ?? (await profileHardware(hardwareEnv))
      writeCachedHardware(storage, hardware)
      const network = await profileNetwork(networkEnv)
      return planBudget(hardware, network, userOverride)
    }
  }

  // Step 2 & 3: hardware (cached) and network (never cached — changes visit to visit)
  // probe concurrently; neither depends on the other's result.
  const cachedHardware = readCachedHardware(storage)
  const [hardware, network] = await Promise.all([
    cachedHardware ? Promise.resolve(cachedHardware) : profileHardware(hardwareEnv),
    profileNetwork(networkEnv),
  ])
  if (!cachedHardware) writeCachedHardware(storage, hardware)

  // Step 4: saveData / min(hardware,network) precedence, via planBudget.
  const autoPlan = planBudget(hardware, network, null)

  // Dev override: only allowed to make the tier WORSE than what auto-detection found.
  if (allowDevOverride) {
    const forced = readDevOverrideParam()
    if (isValidTextureTier(forced) && tierRank(forced) < tierRank(autoPlan.textureTier)) {
      return {
        ...autoPlan,
        textureTier: forced,
        textureFormat: forced === 'high' && hardware.supportsAVIF ? 'avif' : 'jpg',
        source: 'manual-override',
      }
    }
  }

  return autoPlan
}
