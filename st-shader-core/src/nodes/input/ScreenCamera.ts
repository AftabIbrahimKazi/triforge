import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * ScreenCamera — provides per-pixel ray direction and camera position
 * for screen-space / ray-marching shaders.
 *
 * Used with ScreenOutput, which injects the camera uniforms automatically.
 * Call `screenOut.updateCamera(camera, w, h)` once per frame.
 *
 * Outputs:
 *   RayPos (color/vec3) — camera world-space position
 *   RayDir (color/vec3) — normalised ray direction for this pixel
 *
 * @example
 * const cam   = new ScreenCamera()
 * const march = new SchwarzschildMarch({ rayPos: cam.output('RayPos'), rayDir: cam.output('RayDir'), ... })
 * const out   = new ScreenOutput({ color: march.output('Color') })
 * out.compile()
 * scene.add(out.mesh)
 * // in loop: out.updateCamera(camera, innerWidth, innerHeight)
 */
export class ScreenCamera extends InputNode {
  get nodeType() { return 'ScreenCamera' }

  get metadata(): NodeMetadata {
    return { label: 'Screen Camera', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('ScreenCamera')
    this._outputs = this.createOutputs({ RayPos: 'color', RayDir: 'color' })
  }

  getOutputSockets() { return this._outputs }

  /**
   * Declare the camera uniforms that ScreenOutput will inject.
   * They are vec2/vec3/float types that live outside the standard
   * float/vec3 uniform registry — declared here so the GLSL is valid.
   */
  compileDefs(): string {
    return [
      `uniform vec2  uSCResolution;`,
      `uniform vec3  uSCCamPos;`,
      `uniform vec3  uSCCamRight;`,
      `uniform vec3  uSCCamUp;`,
      `uniform vec3  uSCCamFwd;`,
      `uniform float uSCFov;`,
    ].join('\n')
  }

  compileCall(ctx: CompileContext): string {
    const id = this.id
    return [
      `vec2  _scUV_${id} = (gl_FragCoord.xy / uSCResolution - 0.5);`,
      `_scUV_${id}.x *= uSCResolution.x / uSCResolution.y;`,
      `vec3 ${ctx.outputVar(this, 'RayPos')} = uSCCamPos;`,
      `vec3 ${ctx.outputVar(this, 'RayDir')} = normalize(`,
      `  uSCCamRight * _scUV_${id}.x * uSCFov +`,
      `  uSCCamUp    * _scUV_${id}.y * uSCFov +`,
      `  uSCCamFwd`,
      `);`,
    ].join('\n  ')
  }
}
