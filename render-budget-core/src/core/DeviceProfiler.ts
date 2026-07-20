import type { HardwareProbeEnv, HardwareProfile, NetworkProbeEnv, NetworkProfile } from './types.js'

const FALLBACK_MAX_CONTEXTS = 8
const FALLBACK_MAX_TEXTURE_SIZE = 2048
/**
 * Hard safety cap on simultaneous probe contexts. Real mobile ceilings are commonly
 * 8-16; this only needs to be high enough to find that ceiling, never high enough to
 * itself become the kind of context-exhaustion bug this package exists to prevent.
 */
const MAX_CONTEXT_PROBE_ATTEMPTS = 20

/**
 * Probes the real number of simultaneous WebGL contexts this browser tolerates by
 * creating scratch contexts until creation fails or the safety cap is hit, then
 * releasing all of them. Must run before any other WebGL consumer (renderers,
 * carousels, etc.) mounts — probing after the fact would compete with real contexts
 * and could itself trigger the context loss this package exists to prevent.
 *
 * Reads MAX_TEXTURE_SIZE from the first context created in this same pass, rather
 * than creating a separate context afterward: real WEBGL_lose_context releases are
 * asynchronous, so a context "lost" here isn't guaranteed to free its slot in time
 * for a second, later creation — that would make the texture-size read spuriously
 * fail right after a context-count probe that used the whole budget.
 */
function probeContextsAndTextureSize(env: HardwareProbeEnv): { maxContexts: number; maxTextureSize: number } {
  const held: Array<WebGLRenderingContext | WebGL2RenderingContext> = []
  let maxTextureSize = FALLBACK_MAX_TEXTURE_SIZE
  try {
    for (let i = 0; i < MAX_CONTEXT_PROBE_ATTEMPTS; i++) {
      const gl = env.createWebGLContext()
      if (!gl) break
      held.push(gl)
      if (held.length === 1) {
        try {
          const size = gl.getParameter(gl.MAX_TEXTURE_SIZE)
          if (typeof size === 'number' && Number.isFinite(size) && size > 0) maxTextureSize = size
        } catch {
          // keep the fallback
        }
      }
    }
    return {
      maxContexts: held.length > 0 ? held.length : FALLBACK_MAX_CONTEXTS,
      maxTextureSize,
    }
  } finally {
    if (env.loseContext) {
      for (const gl of held) {
        try {
          env.loseContext(gl)
        } catch {
          // best-effort cleanup only — a failure to release a scratch context
          // must never surface as a profiling failure
        }
      }
    }
  }
}

export async function profileHardware(env: HardwareProbeEnv): Promise<HardwareProfile> {
  const { maxContexts, maxTextureSize } = probeContextsAndTextureSize(env)
  const [supportsAVIF, supportsWebP] = await Promise.all([
    env.probeImageDecode('avif').catch(() => false),
    env.probeImageDecode('webp').catch(() => false),
  ])
  return { maxContexts, maxTextureSize, supportsAVIF, supportsWebP }
}

const PROBE_DOWNLOAD_THRESHOLD_MBPS = { fast: 5, medium: 1.5 }

function classifyDownlink(mbps: number | null): string {
  if (mbps === null) return 'unknown'
  if (mbps >= PROBE_DOWNLOAD_THRESHOLD_MBPS.fast) return '4g'
  if (mbps >= PROBE_DOWNLOAD_THRESHOLD_MBPS.medium) return '3g'
  return '2g'
}

export async function profileNetwork(env: NetworkProbeEnv): Promise<NetworkProfile> {
  const conn = env.connection
  if (conn && typeof conn.effectiveType === 'string') {
    return {
      effectiveType: conn.effectiveType,
      downlinkMbps: typeof conn.downlink === 'number' ? conn.downlink : null,
      saveData: conn.saveData === true,
    }
  }

  // No Network Information API (e.g. Safari/iOS) — fall back to a timed probe download.
  const downlinkMbps = await env.probeDownloadMbps().catch(() => null)
  return {
    effectiveType: classifyDownlink(downlinkMbps),
    downlinkMbps,
    saveData: false,
  }
}

/** Default environment for real browsers — the only place this package touches actual globals. */
export function createBrowserHardwareEnv(): HardwareProbeEnv {
  return {
    createWebGLContext(): WebGLRenderingContext | WebGL2RenderingContext | null {
      try {
        const canvas = document.createElement('canvas')
        return (
          (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
          (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
          null
        )
      } catch {
        return null
      }
    },
    loseContext(gl): void {
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
    },
    async probeImageDecode(format: 'avif' | 'webp'): Promise<boolean> {
      // 1x1 sample images, smallest valid encode of each format.
      const samples: Record<'avif' | 'webp', string> = {
        avif:
          'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAARAAAAgABAAEAAAEAAAAeAAABAAABAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUltYWdlAAAAAGppcHJwAAAAWGlwY28AAAAUaXNwZQAAAAAAAAABAAAAAQAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQIDhAAAACBtZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=',
        webp: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
      }
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img.width > 0 && img.height > 0)
        img.onerror = () => resolve(false)
        img.src = samples[format]
      })
    },
  }
}

export function createBrowserNetworkEnv(probeAssetUrl: string): NetworkProbeEnv {
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { connection?: unknown }) : undefined
  return {
    connection: nav?.connection as NetworkProbeEnv['connection'],
    async probeDownloadMbps(): Promise<number | null> {
      try {
        const start = performance.now()
        const res = await fetch(probeAssetUrl, { cache: 'no-store' })
        const blob = await res.blob()
        const seconds = (performance.now() - start) / 1000
        if (seconds <= 0) return null
        const bits = blob.size * 8
        return bits / seconds / 1_000_000
      } catch {
        return null
      }
    },
  }
}
