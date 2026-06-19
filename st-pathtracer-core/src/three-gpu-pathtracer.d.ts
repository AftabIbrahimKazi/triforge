declare module 'three-gpu-pathtracer' {
  import type { WebGLRenderer, Scene, Camera, Texture } from 'three'

  export interface WebGLPathTracerOptions {
    /** Samples rendered per frame (default 1) */
    samplesPerFrame?: number
    /** Tiles per frame for progressive rendering (default 2) */
    tiles?: number
  }

  export class WebGLPathTracer {
    /** Total samples accumulated since last scene update */
    samples: number
    /** Samples to render each frame */
    samplesPerFrame: number
    /** Whether to use physical lighting units (default false) */
    physicallyCorrectLights: boolean
    /** Environment map for IBL */
    envMap: Texture | null
    /** Environment map intensity */
    envMapIntensity: number
    /** Tone mapping exposure */
    toneMappingExposure: number

    constructor(renderer: WebGLRenderer)

    /**
     * Set (or update) the scene to path-trace.
     * Must be called whenever scene geometry/materials change.
     */
    setScene(scene: Scene, camera: Camera, options?: { onProgress?: (p: number) => void }): Promise<void>

    /**
     * Call once per frame inside the animation loop.
     * Accumulates one or more samples into the render target.
     */
    renderSample(): void

    /** Resets accumulated samples — call when camera or scene changes */
    reset(): void

    /** Update camera matrices — call each frame when camera may have moved */
    updateCamera(): void

    /** Resize the path-tracer output to match the renderer */
    setSize(width: number, height: number): void

    /** Dispose GPU resources */
    dispose(): void
  }
}
