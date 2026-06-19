import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Geometry — Blender "Geometry" input node equivalent.
 * Provides raw geometric data about the current surface point.
 *
 * Outputs:
 *   Position  (color/vec3) — world space position
 *   Normal    (color/vec3) — interpolated surface normal
 *   TrueNormal(color/vec3) — flat face normal
 *   Incoming  (color/vec3) — direction from camera to surface
 *   Backfacing(float)      — 1.0 if back face, 0.0 if front
 */
export class Geometry extends InputNode {
  get nodeType() { return 'Geometry' }

  get metadata(): NodeMetadata {
    return { label: 'Geometry', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor() {
    super('Geometry')
    this._outputs = this.createOutputs({
      Position:   'color',
      Normal:     'color',
      TrueNormal: 'color',
      Incoming:   'color',
      Backfacing: 'float',
    })
  }

  getOutputSockets() { return this._outputs }

  compileCall(ctx: CompileContext): string {
    return [
      `vec3  ${ctx.outputVar(this, 'Position')}   = vPosition;`,
      `vec3  ${ctx.outputVar(this, 'Normal')}     = normalize(vNormal);`,
      `vec3  ${ctx.outputVar(this, 'TrueNormal')} = normalize(cross(dFdx(vPosition), dFdy(vPosition)));`,
      `vec3  ${ctx.outputVar(this, 'Incoming')}   = normalize(vPosition - cameraPosition);`,
      `float ${ctx.outputVar(this, 'Backfacing')} = gl_FrontFacing ? 0.0 : 1.0;`,
    ].join('\n  ')
  }
}
