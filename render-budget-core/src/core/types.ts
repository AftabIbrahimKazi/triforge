export type TextureVariantTier = 'high' | 'mid' | 'low' | 'potato'
export type ShaderComplexityTier = 'full' | 'reduced' | 'baked-only'

export interface HardwareProfile {
  /** Highest number of simultaneous WebGL contexts the browser tolerated before losing one. */
  maxContexts: number
  /** gl.getParameter(gl.MAX_TEXTURE_SIZE) from a real context, or a conservative fallback. */
  maxTextureSize: number
  /** Whether the browser can actually decode an AVIF image (probed, not sniffed from UA). */
  supportsAVIF: boolean
  /** Whether the browser can actually decode a WebP image. */
  supportsWebP: boolean
}

export interface NetworkProfile {
  /** 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' — from navigator.connection.effectiveType, or derived from the probe download. */
  effectiveType: string
  /** Estimated downlink in Mbps, if known. */
  downlinkMbps: number | null
  /** OS/browser-level explicit data-saver signal (navigator.connection.saveData). */
  saveData: boolean
}

export interface RenderBudgetPlan {
  /** Which texture asset variant to request. Combines resolution + format (see textureFormat). */
  textureTier: TextureVariantTier
  /** Format to prefer for the resolved textureTier. */
  textureFormat: 'avif' | 'jpg'
  /** How complex a shader graph is safe to compile — governs procedural-vs-baked material choices. */
  shaderComplexity: ShaderComplexityTier
  /** Max simultaneous WebGL contexts a consumer (e.g. a context-pool) should allow. */
  maxConcurrentContexts: number
  /** Source of the final decision, for debugging/telemetry. */
  source: 'manual-override' | 'save-data' | 'auto'
}

export interface RenderBudgetOverride {
  textureTier?: TextureVariantTier
  shaderComplexity?: ShaderComplexityTier
  maxConcurrentContexts?: number
}

/** Injectable seam: anything that can decide "hardware-tier-worthy" without touching real globals in tests. */
export interface HardwareProbeEnv {
  /** Create a WebGL context on a scratch canvas; return null if creation fails. */
  createWebGLContext(): WebGLRenderingContext | WebGL2RenderingContext | null
  /** Release/lose a previously created context, if the environment can simulate that (tests only). */
  loseContext?(gl: WebGLRenderingContext | WebGL2RenderingContext): void
  /** Attempt to decode a tiny sample image of the given format; resolve true/false, never throw. */
  probeImageDecode(format: 'avif' | 'webp'): Promise<boolean>
}

export interface NetworkProbeEnv {
  /** Mirrors navigator.connection — undefined where the Network Information API isn't available (e.g. Safari). */
  connection?: {
    effectiveType?: string
    downlink?: number
    saveData?: boolean
  }
  /** Fallback timed download of a small fixed-size asset; resolves measured Mbps, or null if it fails. */
  probeDownloadMbps(): Promise<number | null>
}

export interface BudgetStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
