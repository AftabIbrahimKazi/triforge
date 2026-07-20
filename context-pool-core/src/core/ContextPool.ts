import type { ContextPoolClient, ContextPoolConfig, Rect, TickResult } from './types.js'

function defaultVisibleRegion(): Rect {
  if (typeof window === 'undefined') return { x: 0, y: 0, width: Infinity, height: Infinity }
  return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function relativeRect(rect: Rect, reference: Rect): Rect {
  return { x: rect.x - reference.x, y: rect.y - reference.y, width: rect.width, height: rect.height }
}

/** A non-finite or negative budget must degrade to "render nothing", never throw or admit unbounded clients. */
function sanitizeMaxConcurrent(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

interface Entry {
  client: ContextPoolClient
  /** Registration order — used as the priority tie-breaker/default, and to keep ordering
   * stable if the same id is re-registered (e.g. a component hot-reloading). */
  order: number
}

/**
 * Engine-agnostic scissor/viewport multiplexer. Clients register a DOM anchor (for
 * positioning/visibility) and a render callback; the pool decides which subset of
 * registered clients fit inside the context budget this tick and calls only theirs.
 *
 * This package never creates a WebGLRenderer or any other engine object — it only
 * decides who gets to render this frame and where. Actually rendering (sharing one
 * real renderer across all active clients via setScissor/setViewport) is the adapter's
 * job (see ThreeContextAdapter) — that's the one piece of this package that's engine-specific.
 */
export class ContextPool {
  private clients = new Map<string, Entry>()
  private activeIds = new Set<string>()
  private nextOrder = 0
  private maxConcurrent: number
  private getVisibleRegion: () => Rect

  constructor(config: ContextPoolConfig) {
    this.maxConcurrent = sanitizeMaxConcurrent(config.maxConcurrent)
    this.getVisibleRegion = config.getVisibleRegion ?? defaultVisibleRegion
  }

  register(client: ContextPoolClient): void {
    const existing = this.clients.get(client.id)
    this.clients.set(client.id, { client, order: existing?.order ?? this.nextOrder++ })
  }

  unregister(id: string): void {
    this.clients.delete(id)
    this.activeIds.delete(id)
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = sanitizeMaxConcurrent(n)
  }

  /**
   * Advance one frame. `referenceRect` is typically the shared canvas's own
   * getBoundingClientRect() — client viewports are returned relative to it, ready to
   * hand straight to a GL-style setScissor/setViewport call (after any y-flip the
   * engine adapter needs).
   */
  tick(referenceRect: Rect): TickResult {
    const visibleRegion = this.getVisibleRegion()
    const hidden: string[] = []
    const visible: Array<{ id: string; order: number; priority: number; rect: Rect }> = []

    for (const [id, entry] of this.clients) {
      const rect = entry.client.getAnchorRect()
      if (!rect || rect.width <= 0 || rect.height <= 0 || !intersects(rect, visibleRegion)) {
        hidden.push(id)
        continue
      }
      visible.push({ id, order: entry.order, priority: entry.client.priority ?? entry.order, rect })
    }

    const byPriority = (a: { priority: number; order: number }, b: { priority: number; order: number }) =>
      a.priority - b.priority || a.order - b.order

    // Sticky selection: clients already active last tick keep their slot (if still visible
    // and still within budget) before any newly-visible client takes a remaining slot —
    // this avoids visible flicker from re-ordering who renders every single frame.
    const stillActive = visible.filter((v) => this.activeIds.has(v.id)).sort(byPriority)
    const newlyVisible = visible.filter((v) => !this.activeIds.has(v.id)).sort(byPriority)

    const kept = stillActive.slice(0, this.maxConcurrent)
    const added = newlyVisible.slice(0, Math.max(0, this.maxConcurrent - kept.length))
    const activeList = [...kept, ...added]
    const activeIdSet = new Set(activeList.map((v) => v.id))

    this.activeIds = activeIdSet

    const skipped = visible.filter((v) => !activeIdSet.has(v.id)).map((v) => v.id)

    for (const v of activeList) {
      const entry = this.clients.get(v.id)
      if (!entry) continue
      entry.client.render(relativeRect(v.rect, referenceRect))
    }

    return { active: activeList.map((v) => v.id), skipped, hidden }
  }
}
