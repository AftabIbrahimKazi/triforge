import type {
  HardwareProfile,
  NetworkProfile,
  RenderBudgetOverride,
  RenderBudgetPlan,
  ShaderComplexityTier,
  TextureVariantTier,
} from './types.js'

const TIER_ORDER: TextureVariantTier[] = ['potato', 'low', 'mid', 'high']

function tierRank(tier: TextureVariantTier): number {
  return TIER_ORDER.indexOf(tier)
}

function moreConservative(a: TextureVariantTier, b: TextureVariantTier): TextureVariantTier {
  return tierRank(a) <= tierRank(b) ? a : b
}

/** High tier is the only variant that requests AVIF — gate it on real decode support, not device class alone. */
function hardwareTextureTier(hw: HardwareProfile): TextureVariantTier {
  if (hw.maxTextureSize >= 8192 && hw.supportsAVIF) return 'high'
  if (hw.maxTextureSize >= 4096) return 'mid'
  if (hw.maxTextureSize >= 2048) return 'low'
  return 'potato'
}

function networkTextureTier(net: NetworkProfile): TextureVariantTier {
  if (net.downlinkMbps !== null) {
    if (net.downlinkMbps >= 5) return 'high'
    if (net.downlinkMbps >= 1.5) return 'mid'
    return 'low'
  }
  switch (net.effectiveType) {
    case '4g':
      return 'high'
    case '3g':
      return 'mid'
    case '2g':
    case 'slow-2g':
      return 'low'
    default:
      // Unknown network signal (e.g. effectiveType missing) — don't punish an
      // otherwise-capable device, but don't assume the best case either.
      return 'mid'
  }
}

/** Shader complexity depends only on GPU capability proxies — network has no bearing on compile safety. */
function shaderComplexityTier(hw: HardwareProfile): ShaderComplexityTier {
  if (hw.maxTextureSize >= 4096 && hw.maxContexts >= 8) return 'full'
  if (hw.maxTextureSize >= 2048 && hw.maxContexts >= 4) return 'reduced'
  return 'baked-only'
}

export function planBudget(
  hardware: HardwareProfile,
  network: NetworkProfile,
  override?: RenderBudgetOverride | null,
): RenderBudgetPlan {
  // 1. Explicit manual override wins outright, skips all detection.
  if (override) {
    const hwTier = hardwareTextureTier(hardware)
    return {
      textureTier: override.textureTier ?? hwTier,
      textureFormat: (override.textureTier ?? hwTier) === 'high' && hardware.supportsAVIF ? 'avif' : 'jpg',
      shaderComplexity: override.shaderComplexity ?? shaderComplexityTier(hardware),
      maxConcurrentContexts: override.maxConcurrentContexts ?? hardware.maxContexts,
      source: 'manual-override',
    }
  }

  const hwTextureTier = hardwareTextureTier(hardware)
  const shaderComplexity = shaderComplexityTier(hardware)
  const maxConcurrentContexts = hardware.maxContexts

  // 2. saveData is an explicit user/OS data-cost signal — forces the most conservative
  // texture tier regardless of measured hardware/network. Shader complexity and context
  // budget are unaffected: they're about what the device can safely render, not bandwidth.
  if (network.saveData) {
    return {
      textureTier: 'potato',
      textureFormat: 'jpg',
      shaderComplexity,
      maxConcurrentContexts,
      source: 'save-data',
    }
  }

  // 3. Neither hardware nor network categorically outranks the other for texture
  // selection — whichever is more conservative wins.
  const netTextureTier = networkTextureTier(network)
  const textureTier = moreConservative(hwTextureTier, netTextureTier)

  return {
    textureTier,
    textureFormat: textureTier === 'high' && hardware.supportsAVIF ? 'avif' : 'jpg',
    shaderComplexity,
    maxConcurrentContexts,
    source: 'auto',
  }
}
