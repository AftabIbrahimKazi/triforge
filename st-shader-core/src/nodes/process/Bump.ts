import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface BumpInputs {
  strength?: OutputSocket | number
  distance?: OutputSocket | number
  height?:   OutputSocket
  normal?:   OutputSocket
}

/**
 * Bump — Blender "Bump" node equivalent.
 * Converts a height map into a perturbed surface normal using screen-space derivatives.
 *
 * Inputs:  strength [0-1], distance, height (float), normal (optional override)
 * Outputs: Normal (color/vec3)
 */
export class Bump extends ProcessNode {
  get nodeType() { return 'Bump' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Bump', category: 'Vector', color: '#4a3a8a', cost: 'medium' }
  }

  static glslFunction = `
vec3 _st_bump(float height, float strength, float distance, vec3 N) {
  // Cotangent frame bump — camera-independent.
  // We derive world-space surface tangent T and bitangent B from the UV
  // parameterisation (cotangent frame). This gives vectors that are fixed
  // to the surface regardless of camera orientation.
  // Then we express the height gradient in UV space (dh/du, dh/dv) which
  // is also surface-fixed, eliminating the screen-space dependency.
  vec3 dPdx = dFdx(vPosition);
  vec3 dPdy = dFdy(vPosition);
  vec2 dUdx = dFdx(vUv);
  vec2 dUdy = dFdy(vUv);

  float det    = dUdx.x * dUdy.y - dUdx.y * dUdy.x;
  float sgn    = sign(det);
  float invDet = sgn / max(abs(det), 1e-6);

  // World-space tangent and bitangent from UV Jacobian (camera-independent)
  vec3 T = normalize((dUdy.y * dPdx - dUdx.y * dPdy) * invDet);
  vec3 B = normalize(cross(N, T)) * sgn;

  // Height gradient in UV space (camera-independent)
  float dhdu = (dUdy.y * dFdx(height) - dUdx.y * dFdy(height)) * invDet;
  float dhdv = (dUdx.x * dFdy(height) - dUdy.x * dFdx(height)) * invDet;

  float scale = strength * distance * 50.0;
  return normalize(N - T * dhdu * scale - B * dhdv * scale);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: BumpInputs = {}) {
    super('Bump')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      strength: ['float', inputs.strength ?? 1.0],
      distance: ['float', inputs.distance ?? 1.0],
      height:   ['float', 0.5],
      normal:   ['color', null],
    })
    this._outputs = this.createOutputs({ Normal: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return Bump.glslFunction }

  compileCall(ctx: CompileContext): string {
    const height   = ctx.resolveInput(this._inputs.height)
    const strength = ctx.resolveInput(this._inputs.strength)
    const distance = ctx.resolveInput(this._inputs.distance)
    const normal   = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'
    return `vec3 ${ctx.outputVar(this, 'Normal')} = _st_bump(${height}, ${strength}, ${distance}, ${normal});`
  }
}
