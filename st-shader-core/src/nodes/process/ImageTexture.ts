import { ProcessNode } from '../../core/ProcessNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import { assertGlslIdentifier } from '../../core/glslIdentifier.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export type ImageInterpolation = 'linear' | 'cubic'

export interface ImageTextureInputs {
  vector?:    OutputSocket
  uniformName: string   // name of the sampler2D uniform on the ShaderMaterial
  /**
   * Magnification filter. 'linear' (default) is the hardware bilinear sample.
   * 'cubic' is a smooth B-spline sample (four bilinear taps) that removes the
   * blocky look when a low-resolution texture is magnified. Requires textureSize.
   */
  interpolation?: ImageInterpolation
  /** [width, height] in texels of the texture bound to the uniform. Required for 'cubic'. */
  textureSize?:   [number, number]
}

/**
 * Image Texture — Blender "Image Texture" node equivalent.
 * Samples an external texture via a sampler2D uniform.
 *
 * Usage:
 *   const node = new ImageTexture({ uniformName: 'uAlbedo' })
 *   // After mat.compile():
 *   mat.material.uniforms.uAlbedo = { value: new THREE.TextureLoader().load('path.jpg') }
 *
 * Inputs:  vector (UV), uniformName (string — name of sampler2D uniform),
 *          interpolation ('linear' | 'cubic'), textureSize ([w, h], required for 'cubic')
 * Outputs: Color (color), Alpha (float)
 *
 * Two nodes may share one uniformName (e.g. to sample the same texture at two
 * different UVs); the sampler is declared once.
 */
export class ImageTexture extends ProcessNode {
  get nodeType() { return 'ImageTexture' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Image Texture', category: 'Texture', color: '#3a6b3a', cost: 'medium' }
  }

  private readonly uniformName: string
  private readonly interpolation: ImageInterpolation
  private readonly textureSize: [number, number]
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: ImageTextureInputs) {
    super('ImageTexture')

    if (ShaderConfig.errorLevel !== 'off' && !inputs.uniformName) {
      ShaderNodeError.throw({
        nodeType: 'ImageTexture',
        nodeId:   this.id,
        problem:  'uniformName is required.',
        fix:      'new ImageTexture({ uniformName: "uMyTexture" })\n  After compile(): mat.material.uniforms.uMyTexture = { value: texture }',
      })
    }

    assertGlslIdentifier(inputs.uniformName, 'ImageTexture uniformName')
    this.uniformName   = inputs.uniformName
    this.interpolation = inputs.interpolation ?? 'linear'
    this.textureSize   = inputs.textureSize ?? [1, 1]

    const [width, height] = this.textureSize
    const hasValidSize = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    if (ShaderConfig.errorLevel !== 'off' && this.interpolation === 'cubic' && (!inputs.textureSize || !hasValidSize)) {
      ShaderNodeError.throw({
        nodeType: 'ImageTexture',
        nodeId:   this.id,
        problem:  'interpolation "cubic" requires a positive textureSize [width, height].',
        fix:      'new ImageTexture({ uniformName: "uMap", interpolation: "cubic", textureSize: [2048, 1024] })',
      })
    }
    this._inputs     = this.createInputs(inputs as unknown as Record<string, unknown>, { vector: ['vector', null] })
    this._outputs    = this.createOutputs({ Color: 'color', Alpha: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    return `uniform sampler2D ${this.uniformName};`
  }

  compileCall(ctx: CompileContext): string {
    const uv  = this._inputs.vector.isConnected()
      ? ctx.resolveInput(this._inputs.vector)
      : 'vUv'
    const cv  = ctx.outputVar(this, 'Color')
    const av  = ctx.outputVar(this, 'Alpha')
    return [
      this.sampleLine(uv),
      `vec3  ${cv} = _it_${this.id}.rgb;`,
      `float ${av} = _it_${this.id}.a;`,
    ].join('\n  ')
  }

  private sampleLine(uv: string): string {
    const id = this.id
    if (this.interpolation === 'linear') return `vec4 _it_${id} = texture2D(${this.uniformName}, ${uv});`

    const size = `vec2(${this.textureSize[0].toFixed(1)}, ${this.textureSize[1].toFixed(1)})`
    const tap  = (x: string, y: string): string => `texture2D(${this.uniformName}, vec2(_it_h${x}_${id}.x, _it_h${y}_${id}.y))`
    return [
      `vec2 _it_p_${id}  = (${uv}) * ${size} - 0.5;`,
      `vec2 _it_f_${id}  = fract(_it_p_${id});`,
      `vec2 _it_c_${id}  = floor(_it_p_${id}) + 0.5;`,
      `vec2 _it_f2_${id} = _it_f_${id} * _it_f_${id};`,
      `vec2 _it_f3_${id} = _it_f2_${id} * _it_f_${id};`,
      `vec2 _it_w0_${id} = (1.0 - _it_f_${id}) * (1.0 - _it_f_${id}) * (1.0 - _it_f_${id}) / 6.0;`,
      `vec2 _it_w1_${id} = (4.0 - 6.0 * _it_f2_${id} + 3.0 * _it_f3_${id}) / 6.0;`,
      `vec2 _it_w2_${id} = (1.0 + 3.0 * _it_f_${id} + 3.0 * _it_f2_${id} - 3.0 * _it_f3_${id}) / 6.0;`,
      `vec2 _it_w3_${id} = _it_f3_${id} / 6.0;`,
      `vec2 _it_g0_${id} = _it_w0_${id} + _it_w1_${id};`,
      `vec2 _it_g1_${id} = _it_w2_${id} + _it_w3_${id};`,
      `vec2 _it_h0_${id} = (_it_c_${id} - 1.0 + _it_w1_${id} / _it_g0_${id}) / ${size};`,
      `vec2 _it_h1_${id} = (_it_c_${id} + 1.0 + _it_w3_${id} / _it_g1_${id}) / ${size};`,
      `vec4 _it_${id} = _it_g0_${id}.y * (_it_g0_${id}.x * ${tap('0', '0')} + _it_g1_${id}.x * ${tap('1', '0')})`,
      `               + _it_g1_${id}.y * (_it_g0_${id}.x * ${tap('0', '1')} + _it_g1_${id}.x * ${tap('1', '1')});`,
    ].join('\n  ')
  }
}
