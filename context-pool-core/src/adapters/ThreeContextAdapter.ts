import type * as THREE from 'three'
import { ContextPool } from '../core/ContextPool.js'
import type { Rect } from '../core/types.js'

export interface ThreeSceneRegistration {
  scene: THREE.Scene
  camera: THREE.Camera
  /** DOM element whose on-screen position/size determines this scene's viewport. */
  anchor: Element
  /** Lower number = higher priority when the context budget is tight. */
  priority?: number
}

export interface ThreeContextAdapterConfig {
  renderer: THREE.WebGLRenderer
  maxConcurrent: number
  /** Injectable for tests — defaults to the real window viewport. */
  getVisibleRegion?: () => Rect
  /** Called when the shared context is lost — rendering is skipped until restored. */
  onContextLost?: () => void
  onContextRestored?: () => void
}

function domRectToRect(r: DOMRect): Rect {
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

/**
 * The one engine-specific piece of this package: wraps a single THREE.WebGLRenderer so
 * any number of registered scenes can share it, instead of each needing its own
 * WebGLRenderer (and its own real WebGL context). This is what actually fixes a
 * "one WebGLRenderer per canvas" context-exhaustion bug — the ContextPool it wraps
 * doesn't know or care that Three.js is involved at all.
 */
export class ThreeContextAdapter {
  private pool: ContextPool
  private renderer: THREE.WebGLRenderer
  private registrations = new Map<string, ThreeSceneRegistration>()
  private contextLost = false
  private currentCanvasHeight = 0
  private onLost: () => void
  private onRestored: () => void
  private handleContextLost = (event: Event) => {
    event.preventDefault() // required by the WebGL spec to allow eventual restoration
    this.contextLost = true
    this.onLost()
  }
  private handleContextRestored = () => {
    this.contextLost = false
    this.onRestored()
  }

  constructor(config: ThreeContextAdapterConfig) {
    this.renderer = config.renderer
    this.pool = new ContextPool({ maxConcurrent: config.maxConcurrent, getVisibleRegion: config.getVisibleRegion })
    this.onLost = config.onContextLost ?? (() => {})
    this.onRestored = config.onContextRestored ?? (() => {})
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost)
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored)
  }

  /** Register (or replace, if `id` already exists) a scene/camera pair positioned by `anchor`. */
  registerScene(id: string, registration: ThreeSceneRegistration): void {
    this.registrations.set(id, registration)
    this.pool.register({
      id,
      priority: registration.priority,
      getAnchorRect: () => {
        const current = this.registrations.get(id)
        if (!current) return null
        const r = current.anchor.getBoundingClientRect()
        return r.width > 0 && r.height > 0 ? domRectToRect(r) : null
      },
      render: (viewport) => {
        const current = this.registrations.get(id)
        if (!current) return
        this.renderScissored(current, viewport)
      },
    })
  }

  unregisterScene(id: string): void {
    this.registrations.delete(id)
    this.pool.unregister(id)
  }

  setMaxConcurrent(n: number): void {
    this.pool.setMaxConcurrent(n)
  }

  /** Call once per animation frame. No-ops while the shared context is lost. */
  renderFrame(): void {
    if (this.contextLost) return
    const canvasRect = domRectToRect(this.renderer.domElement.getBoundingClientRect())
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return

    this.renderer.setScissorTest(false)
    this.renderer.clear()
    this.currentCanvasHeight = canvasRect.height
    this.pool.tick(canvasRect)
  }

  private renderScissored(registration: ThreeSceneRegistration, viewport: Rect): void {
    // viewport is canvas-local, y-down (DOM convention). WebGL scissor/viewport are
    // y-up from the bottom-left — flip using the canvas height captured this frame.
    const glY = this.currentCanvasHeight - viewport.y - viewport.height
    this.renderer.setScissorTest(true)
    this.renderer.setScissor(viewport.x, glY, viewport.width, viewport.height)
    this.renderer.setViewport(viewport.x, glY, viewport.width, viewport.height)
    this.renderer.render(registration.scene, registration.camera)
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored)
  }
}
