/** Top-left-origin, y-down pixel rectangle — DOM convention. Engines that need a
 * bottom-left/y-up convention (e.g. GL scissor/viewport) convert at their own adapter,
 * not here — this package makes no GL assumptions. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ContextPoolClient {
  id: string
  /** Current on-screen position/size in page coordinates, or null if not currently measurable (detached, display:none). */
  getAnchorRect(): Rect | null
  /** Lower number = higher priority when the budget is tight. Defaults to registration order if omitted. */
  priority?: number
  /** Called once per tick, only for clients selected as active this frame. `viewport` is already
   * converted to be relative to the reference rect passed into ContextPool.tick(). */
  render(viewport: Rect): void
}

export interface ContextPoolConfig {
  /** Max simultaneous active clients — typically RenderBudgetPlan.maxConcurrentContexts from
   * @triforge/render-budget-core, though this package never imports that one directly (each
   * package does one job; the consumer wires the number across). */
  maxConcurrent: number
  /** Region a client's anchor must intersect to count as "visible" at all. Defaults to the
   * real window viewport; injectable for tests. */
  getVisibleRegion?: () => Rect
}

export interface TickResult {
  /** Clients rendered this tick. */
  active: string[]
  /** Clients visible but over budget — not rendered this tick. */
  skipped: string[]
  /** Clients not visible at all (anchor null, zero-sized, or outside the visible region). */
  hidden: string[]
}
