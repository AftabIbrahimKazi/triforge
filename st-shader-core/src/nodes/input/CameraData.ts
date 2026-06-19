import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Camera Data — Blender "Camera Data" input node equivalent.
 * Provides camera-relative metrics for the current surface point.
 *
 * Outputs:
 *   ViewDistance (float)      — distance from surface to camera
 *   ViewZDepth   (float)      — camera-space Z depth
 *   ViewVector   (color/vec3) — normalised direction from surface to camera
 */
export class CameraData extends InputNode {
  get nodeType() { return 'CameraData' }

  get metadata(): NodeMetadata {
    return { label: 'Camera Data', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('CameraData')
    this._outputs = this.createOutputs({
      ViewDistance: 'float',
      ViewZDepth:   'float',
      ViewVector:   'color',
    })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    return [
      `vec3  _cd_toCamera_${this.id} = cameraPosition - vPosition;`,
      `float ${ctx.outputVar(this, 'ViewDistance')} = length(_cd_toCamera_${this.id});`,
      `float ${ctx.outputVar(this, 'ViewZDepth')}   = -gl_FragCoord.z;`,
      `vec3  ${ctx.outputVar(this, 'ViewVector')}   = normalize(_cd_toCamera_${this.id});`,
    ].join('\n  ')
  }
}
