import { ProcessNode } from '../../core/ProcessNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface EnvironmentTextureInputs {
  /** Output socket providing a direction vector (color type = vec3). Defaults to reflected view direction. */
  vector?:      OutputSocket
  /** Name of the samplerCube uniform on the ShaderMaterial. */
  uniformName:  string
  /** Mip level to sample (0 = sharpest, higher = blurrier/rougher). Default 0. */
  roughness?:   number | OutputSocket
}

/**
 * Environment Texture — Blender "Environment Texture" node equivalent.
 * Samples a cubemap (THREE.CubeTexture or THREE.WebGLCubeRenderTarget) via a samplerCube uniform.
 *
 * Usage:
 *   const node = new EnvironmentTexture({ uniformName: 'uEnv' })
 *   // After mat.compile():
 *   mat.material.uniforms.uEnv = { value: new THREE.CubeTextureLoader().load([...]) }
 *
 * Default vector: reflected view direction — perfect for reflections.
 * Connect a Normal node output for environment-mapped normals.
 *
 * Inputs:  vector (direction, color), roughness (float), uniformName (string)
 * Outputs: Color (color)
 */
export class EnvironmentTexture extends ProcessNode {
  get nodeType() { return 'EnvironmentTexture' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return { label: 'Environment Texture', category: 'Texture', color: '#3a5a6b', cost: 'medium' }
  }

  private readonly _uniformName: string
  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: EnvironmentTextureInputs) {
    super('EnvironmentTexture')

    if (ShaderConfig.errorLevel !== 'off' && !inputs.uniformName) {
      ShaderNodeError.throw({
        nodeType: 'EnvironmentTexture',
        nodeId:   this.id,
        problem:  'uniformName is required.',
        fix:      'new EnvironmentTexture({ uniformName: "uEnv" })\n  After compile(): mat.material.uniforms.uEnv = { value: cubeTexture }',
      })
    }

    this._uniformName = inputs.uniformName
    this._inputs  = this.createInputs(inputs as unknown as Record<string, unknown>, {
      vector:    ['color', null],
      roughness: ['float', 0.0],
    })
    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    return `uniform samplerCube ${this._uniformName};`
  }

  compileCall(ctx: CompileContext): string {
    const roughness = ctx.resolveInput(this._inputs.roughness)
    const cv        = ctx.outputVar(this, 'Color')

    // If a direction vector is connected, use it; otherwise use the reflected view direction
    let dir: string
    if (this._inputs.vector.isConnected()) {
      dir = ctx.resolveInput(this._inputs.vector)
    } else {
      // Compute reflected view direction in world space
      dir = `reflect(normalize(vPosition - cameraPosition), vNormal)`
    }

    return [
      `vec3 _env_dir_${this.id} = ${dir};`,
      `vec4 _env_samp_${this.id} = textureCube(${this._uniformName}, _env_dir_${this.id}, ${roughness} * 8.0);`,
      `vec3 ${cv} = _env_samp_${this.id}.rgb;`,
    ].join('\n  ')
  }
}
