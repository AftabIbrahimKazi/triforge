import { ProcessNode } from '../../core/ProcessNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface ImageTextureInputs {
  vector?:    OutputSocket
  uniformName: string   // name of the sampler2D uniform on the ShaderMaterial
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
 * Inputs:  vector (UV), uniformName (string — name of sampler2D uniform)
 * Outputs: Color (color), Alpha (float)
 */
export class ImageTexture extends ProcessNode {
  get nodeType() { return 'ImageTexture' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Image Texture', category: 'Texture', color: '#3a6b3a', cost: 'medium' }
  }

  private readonly uniformName: string
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

    this.uniformName = inputs.uniformName
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
      ? ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)
      : 'vUv'
    const cv  = ctx.outputVar(this, 'Color')
    const av  = ctx.outputVar(this, 'Alpha')
    return [
      `vec4 _it_${this.id} = texture2D(${this.uniformName}, ${uv});`,
      `vec3  ${cv} = _it_${this.id}.rgb;`,
      `float ${av} = _it_${this.id}.a;`,
    ].join('\n  ')
  }
}
