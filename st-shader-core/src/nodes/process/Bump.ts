import { ProcessNode } from '../../core/ProcessNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import { assertGlslIdentifier } from '../../core/glslIdentifier.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface BumpInputs {
  strength?: OutputSocket | number
  distance?: OutputSocket | number
  height?:   OutputSocket
  normal?:   OutputSocket
  /**
   * 'derivative' (default) — height gradient via dFdx/dFdy of the `height` input.
   * Screen-space, camera/rasterization-dependent: stable for procedural/vertex-fed
   * height but can speckle or seam-flicker across a wide camera-distance range when
   * `height` comes from a sampled texture.
   *
   * 'uv-offset' — explicit texelSize-offset samples of a height texture at a fixed
   * LOD, independent of screen-space derivatives. Stable under camera motion for
   * texture-driven relief (e.g. planetary crater/regolith maps). Requires `uniformName`.
   */
  method?:      'derivative' | 'uv-offset'
  /** Required when method:'uv-offset'. Name of the sampler2D height-map uniform. */
  uniformName?: string
  /** UV to sample at, when method:'uv-offset'. Defaults to the surface UV (vUv). */
  vector?:      OutputSocket
  /** Texel size (1 / texture resolution) for the uv-offset samples. Default 1/512. */
  texelSize?:   OutputSocket | number
  /** Explicit mip/LOD level for the uv-offset samples. Default 0. */
  lod?:         OutputSocket | number
}

/**
 * Bump — Blender "Bump" node equivalent.
 * Converts a height map into a perturbed surface normal.
 *
 * Inputs:  strength [0-1], distance, height (float), normal (optional override)
 *          method ('derivative' | 'uv-offset'), uniformName/vector/texelSize/lod
 *          (uv-offset mode only)
 * Outputs: Normal (color/vec3)
 */
export class Bump extends ProcessNode {
  get nodeType() { return 'Bump' }
  // Both modes emit their own per-instance defs (a #ifndef-guarded shared function
  // for 'derivative', a per-instance uniform declaration for 'uv-offset' — see
  // compileDefs). instanceSpecificDef:true is required so multiple 'uv-offset'
  // instances each get their own uniform decl instead of being deduped by nodeType.
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Bump', category: 'Vector', color: '#4a3a8a', cost: 'medium' }
  }

  static derivativeGlslFunction = `
#ifndef _ST_BUMP_FN
#define _ST_BUMP_FN
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
}
#endif`

  private readonly _method:      'derivative' | 'uv-offset'
  private readonly _uniformName: string | null
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: BumpInputs = {}) {
    super('Bump')
    this._method = inputs.method ?? 'derivative'

    if (this._method === 'uv-offset') {
      if (ShaderConfig.errorLevel !== 'off' && !inputs.uniformName) {
        ShaderNodeError.throw({
          nodeType: 'Bump',
          nodeId:   this.id,
          problem:  'uniformName is required when method:"uv-offset".',
          fix:      'new Bump({ method: "uv-offset", uniformName: "uHeightTex" })\n  After compile(): mat.material.uniforms.uHeightTex = { value: texture }',
        })
      }
      if (inputs.uniformName) assertGlslIdentifier(inputs.uniformName, 'Bump uniformName')
      this._uniformName = inputs.uniformName ?? null
    } else {
      this._uniformName = null
    }

    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      strength:  ['float', inputs.strength ?? 1.0],
      distance:  ['float', inputs.distance ?? 1.0],
      height:    ['float', 0.5],
      normal:    ['color', null],
      vector:    ['vector', null],
      texelSize: ['float', inputs.texelSize ?? 1 / 512],
      lod:       ['float', inputs.lod ?? 0.0],
    })
    this._outputs = this.createOutputs({ Normal: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    if (this._method === 'uv-offset') {
      return [
        '#ifndef _ST_BUMP_TEXLOD_EXT',
        '#define _ST_BUMP_TEXLOD_EXT',
        '#extension GL_EXT_shader_texture_lod : enable',
        '#endif',
        `uniform sampler2D ${this._uniformName};`,
      ].join('\n')
    }
    return Bump.derivativeGlslFunction
  }

  compileCall(ctx: CompileContext): string {
    const strength = ctx.resolveInput(this._inputs.strength)
    const distance = ctx.resolveInput(this._inputs.distance)
    const normal   = this._inputs.normal.isConnected()
      ? ctx.outputVar(this._inputs.normal.connection!.node, this._inputs.normal.connection!.name)
      : 'normalize(vNormal)'

    if (this._method === 'uv-offset') {
      const uv        = this._inputs.vector.isConnected() ? ctx.resolveInput(this._inputs.vector) : 'vUv'
      const texelSize = ctx.resolveInput(this._inputs.texelSize)
      const lod       = ctx.resolveInput(this._inputs.lod)
      const id  = this.id
      const hL  = `_bmp_${id}_hL`,   hR  = `_bmp_${id}_hR`
      const hD  = `_bmp_${id}_hD`,   hU  = `_bmp_${id}_hU`
      const dPdx = `_bmp_${id}_dPdx`, dPdy = `_bmp_${id}_dPdy`
      const dUdx = `_bmp_${id}_dUdx`, dUdy = `_bmp_${id}_dUdy`
      const det  = `_bmp_${id}_det`,  sgn  = `_bmp_${id}_sgn`, invDet = `_bmp_${id}_invDet`
      const T    = `_bmp_${id}_T`,    B    = `_bmp_${id}_B`
      const dhdu = `_bmp_${id}_dhdu`, dhdv = `_bmp_${id}_dhdv`
      const scale = `_bmp_${id}_scale`
      const ts   = `_bmp_${id}_ts`

      return [
        `float ${ts}  = ${texelSize};`,
        `float ${hL}  = texture2DLodEXT(${this._uniformName}, ${uv} - vec2(${ts}, 0.0), ${lod}).r;`,
        `float ${hR}  = texture2DLodEXT(${this._uniformName}, ${uv} + vec2(${ts}, 0.0), ${lod}).r;`,
        `float ${hD}  = texture2DLodEXT(${this._uniformName}, ${uv} - vec2(0.0, ${ts}), ${lod}).r;`,
        `float ${hU}  = texture2DLodEXT(${this._uniformName}, ${uv} + vec2(0.0, ${ts}), ${lod}).r;`,
        // Cotangent frame from screen-space derivatives — this builds the tangent
        // basis (surface-fixed), not the height sample, so it doesn't carry the
        // camera-distance instability the uv-offset method exists to avoid.
        `vec3  ${dPdx} = dFdx(vPosition);`,
        `vec3  ${dPdy} = dFdy(vPosition);`,
        `vec2  ${dUdx} = dFdx(vUv);`,
        `vec2  ${dUdy} = dFdy(vUv);`,
        `float ${det}    = ${dUdx}.x * ${dUdy}.y - ${dUdx}.y * ${dUdy}.x;`,
        `float ${sgn}    = sign(${det});`,
        `float ${invDet} = ${sgn} / max(abs(${det}), 1e-6);`,
        `vec3  ${T} = normalize((${dUdy}.y * ${dPdx} - ${dUdx}.y * ${dPdy}) * ${invDet});`,
        `vec3  ${B} = normalize(cross(${normal}, ${T})) * ${sgn};`,
        `float ${dhdu} = (${hR} - ${hL}) / max(2.0 * ${ts}, 1e-6);`,
        `float ${dhdv} = (${hU} - ${hD}) / max(2.0 * ${ts}, 1e-6);`,
        `float ${scale} = ${strength} * ${distance} * 50.0;`,
        `vec3 ${ctx.outputVar(this, 'Normal')} = normalize(${normal} - ${T} * ${dhdu} * ${scale} - ${B} * ${dhdv} * ${scale});`,
      ].join('\n  ')
    }

    const height = ctx.resolveInput(this._inputs.height)
    return `vec3 ${ctx.outputVar(this, 'Normal')} = _st_bump(${height}, ${strength}, ${distance}, ${normal});`
  }
}
