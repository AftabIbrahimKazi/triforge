import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'
import type { InputSocket } from '../../core/InputSocket.js'

export interface RayPortalInputs {
  /** Surface color emitted through the portal */
  color?:            OutputSocket | [number, number, number] | string
  /**
   * Portal Transform (mat4) — defines the exit portal's position and
   * orientation. Ignored in rasterizer mode; reserved for when
   * three-gpu-pathtracer supports portal geometry.
   */
  portalTransform?:  OutputSocket
}

/**
 * Ray Portal — Blender "Ray Portal" shader node equivalent.
 *
 * Path-tracer-only node. Teleports rays from an entry surface to an exit
 * surface defined by `Portal Transform`. Useful for mirrors, windows, and
 * non-Euclidean geometry tricks in Cycles.
 *
 * In rasterizer mode this node acts as a simple passthrough emitter:
 * it outputs the input `Color` unchanged and ignores `Portal Transform`.
 * This produces plausible results for scenes where the portal would look
 * like a glowing or transparent surface.
 *
 * NOTE: Full portal behaviour (ray teleportation) will be enabled once
 * three-gpu-pathtracer exposes geometry-driven portal BSDF support.
 *
 * Parameters:
 *   blend (number) — blend factor [0–1] between portal BSDF and surface
 *                    (rasterizer approximation only, default 1.0)
 *
 * Inputs:
 *   Color            (color)  — surface/portal color
 *   Portal Transform (shader) — exit-portal transform (rasterizer: ignored)
 *
 * Outputs:
 *   BSDF (shader/color) — emitted color (rasterizer passthrough)
 */
export class RayPortal extends ProcessNode {
  get nodeType() { return 'RayPortal' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Ray Portal', category: 'Shader', color: '#7a3d5a', cost: 'low' }
  }

  override parameters: { blend: number } = { blend: 1.0 }

  private readonly _inputs:  Record<string, InputSocket<unknown>>
  private readonly _outputs: Record<string, OutputSocket>

  constructor(inputs: RayPortalInputs = {}) {
    super('RayPortal')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      color:           ['color', inputs.color ?? '#ffffff'],
      // portalTransform is accepted but not wired in rasterizer mode
      portalTransform: ['shader', null],
    })
    this._outputs = this.createOutputs({ BSDF: 'shader' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string { return '' }

  compileCall(ctx: CompileContext): string {
    const color = ctx.resolveInput(this._inputs.color)
    // SECURITY: validate blend is a finite number before emitting GLSL
    const rawBlend = this.parameters.blend
    const blend    = Number.isFinite(rawBlend) ? Math.min(Math.max(rawBlend, 0.0), 1.0).toFixed(4) : '1.0000'

    // Rasterizer passthrough: BSDF = color * blend
    // Portal Transform is intentionally unused in this mode.
    return `vec3 ${ctx.outputVar(this, 'BSDF')} = ${color} * ${blend};`
  }
}
