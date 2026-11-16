import type { SceneGl, SceneRenderer } from './types.js'

const MAX_ERRORS = 50
const MAX_MESSAGE_LENGTH = 500

type ShaderErrorHook = NonNullable<NonNullable<SceneRenderer['debug']>['onShaderError']>

export class ShaderErrorCollector {
  private readonly errors: string[] = []
  private renderer: SceneRenderer | null = null
  private previous: ShaderErrorHook | null = null

  public attach(renderer: SceneRenderer): void {
    if (this.renderer || !renderer.debug) return
    this.renderer = renderer
    this.previous = renderer.debug.onShaderError ?? null
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      this.record(gl, vertex, fragment)
      this.previous?.(gl, program, vertex, fragment)
    }
  }

  public list(): readonly string[] {
    return this.errors
  }

  public destroy(): void {
    if (this.renderer?.debug) this.renderer.debug.onShaderError = this.previous
    this.renderer = null
    this.previous = null
    this.errors.length = 0
  }

  private record(gl: SceneGl, vertex: unknown, fragment: unknown): void {
    for (const [stage, shader] of [['vertex', vertex], ['fragment', fragment]] as const) {
      const log = gl.getShaderInfoLog(shader)
      if (!log || this.errors.length >= MAX_ERRORS) continue
      this.errors.push(`${stage}: ${log.trim().slice(0, MAX_MESSAGE_LENGTH)}`)
    }
  }
}
