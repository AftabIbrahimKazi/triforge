import { OutputNode } from '../../core/OutputNode.js'
import { ShaderNodeError } from '../../core/ShaderNodeError.js'
import { ShaderConfig } from '../../core/ShaderConfig.js'
import { MeshPhysicalMaterial, Color, Texture } from 'three'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface MaterialOutputInputs {
  surface?:      OutputSocket
  volume?:       OutputSocket
  displacement?: OutputSocket
  thickness?:    OutputSocket
}

/**
 * Material Output — Blender "Material Output" node equivalent.
 * Terminal node. Call compile() to produce the final shader.
 *
 * Inputs:  surface (required), volume, displacement, thickness
 */
export class MaterialOutput extends OutputNode {
  get nodeType() { return 'MaterialOutput' }

  get metadata(): NodeMetadata {
    return { label: 'Material Output', category: 'Output', color: '#a06030', cost: 'low' }
  }

  private readonly _inputs: Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>

  constructor(inputs: MaterialOutputInputs = {}) {
    super('MaterialOutput')
    this._inputs = this.createInputs(inputs as Record<string, unknown>, {
      surface:      ['shader', null, true],
      volume:       ['shader', null],
      displacement: ['vector', null],
      thickness:    ['float',  0.0],
    })

    if (ShaderConfig.errorLevel !== 'off' && !this._inputs.surface.isConnected()) {
      ShaderNodeError.throw({
        nodeType:  this.nodeType,
        nodeId:    this.id,
        inputName: 'surface',
        problem:   'Required input "surface" has no connection.',
        fix:       'new MaterialOutput({ surface: bsdf.output("BSDF") })',
      })
    }
  }

  getInputSockets() { return this._inputs }

  /**
   * Converts the node graph to a THREE.MeshPhysicalMaterial for use with
   * path-tracer renderers (three-gpu-pathtracer).
   *
   * Walks upstream from MaterialOutput.surface looking for a PrincipledBSDF
   * (or Emission) node and maps its live parameters to MeshPhysicalMaterial
   * properties. ImageTexture nodes connected to baseColor are wired as .map.
   *
   * For custom GLSL-heavy materials with no compatible BSDF root, the method
   * returns a neutral grey MeshPhysicalMaterial as a fallback.
   *
   * @example
   * const mat = new MaterialOutput({ surface: bsdf.output('BSDF') })
   * mat.compile()                      // rasterizer ShaderMaterial
   * const ptMat = mat.toPhysicalMaterial()  // path-tracer MeshPhysicalMaterial
   */
  toPhysicalMaterial(extraUniforms?: Record<string, Texture>): MeshPhysicalMaterial {
    const surfaceSocket = this._inputs.surface
    if (!surfaceSocket.isConnected()) {
      return new MeshPhysicalMaterial({ color: 0x888888, roughness: 0.5 })
    }

    const bsdfNode = surfaceSocket.connection!.node
    const nodeType = bsdfNode.nodeType
    const p = bsdfNode.parameters as Record<string, number | [number, number, number]>

    // Helper: extract a Color from a parameter (may be [r,g,b] or a hex number)
    const toColor = (key: string, fallback = '#ffffff'): Color => {
      const v = p[key]
      if (Array.isArray(v)) return new Color(v[0], v[1], v[2])
      if (typeof v === 'number') return new Color(v, v, v)
      return new Color(fallback)
    }

    const toFloat = (key: string, fallback: number): number => {
      const v = p[key]
      return typeof v === 'number' ? v : fallback
    }

    // Check if baseColor input is wired to an ImageTexture
    const bsdfInputs = bsdfNode.getInputSockets()
    let map: Texture | null = null
    if (bsdfInputs.baseColor?.isConnected()) {
      const upstream = bsdfInputs.baseColor.connection!.node
      if (upstream.nodeType === 'ImageTexture') {
        const uniformName = (upstream as unknown as { uniformName: string }).uniformName
        if (extraUniforms?.[uniformName] instanceof Texture) {
          map = extraUniforms[uniformName]
        }
      }
    }

    if (nodeType === 'Emission') {
      return new MeshPhysicalMaterial({
        emissive:          toColor('color'),
        emissiveIntensity: toFloat('strength', 1.0),
        roughness:         1.0,
        metalness:         0.0,
      })
    }

    // PrincipledBSDF, GlossyBSDF, DiffuseBSDF, GlassBSDF, RefractionBSDF
    const isGlass = nodeType === 'GlassBSDF' || nodeType === 'RefractionBSDF'
    const alpha   = toFloat('alpha', 1.0)
    const matParams: ConstructorParameters<typeof MeshPhysicalMaterial>[0] = {
      color:       map ? 0xffffff : toColor('baseColor'),
      metalness:   toFloat('metallic',  0.0),
      roughness:   toFloat('roughness', 0.5),
      ior:         toFloat('ior',       1.5),
      opacity:     alpha,
      transparent: alpha < 1.0 || isGlass,
    }
    if (map) matParams.map = map
    const mat = new MeshPhysicalMaterial(matParams)

    if (nodeType === 'GlassBSDF' || nodeType === 'RefractionBSDF') {
      mat.transmission = 1.0
      mat.thickness    = 0.5
    }

    return mat
  }

  compileCall(ctx: CompileContext): string {
    const sv = this._inputs.surface.isConnected()
      ? ctx.outputVar(this._inputs.surface.connection!.node, this._inputs.surface.connection!.name)
      : 'vec3(0.8)'
    return `gl_FragColor = vec4(${sv}, 1.0);`
  }
}
