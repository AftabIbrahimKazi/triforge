import { InputNode } from '../../core/InputNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'

/**
 * Attribute — Blender "Attribute" input node equivalent.
 * Reads a named custom float or vector attribute from the geometry's BufferAttributes.
 *
 * The attribute must be present on the geometry as a BufferAttribute with the given name.
 * For vec3 attributes: Vector = the attribute value, Fac = length of the vector.
 * For float attributes: Fac = the attribute value, Vector = vec3(value, value, value).
 *
 * Parameters:
 *   attributeType (number) — 0 = vec3, 1 = float (numeric for keyframe compat)
 *
 * Outputs:
 *   Fac    (float)  — scalar representation of the attribute value
 *   Vector (color)  — vec3 representation of the attribute value
 */
export class Attribute extends InputNode {
  get nodeType() { return 'Attribute' }

  get metadata(): NodeMetadata {
    return { label: 'Attribute', category: 'Input', color: '#3d6b96', cost: 'low' }
  }

  /** The raw attribute name as it appears on the BufferGeometry. */
  readonly attributeName: string

  /** 0 = vec3, 1 = float. Stored as number for keyframe/GSAP compat. */
  override parameters: { attributeType: number } = { attributeType: 0 }

  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  /** Sanitized attribute name — only alphanumeric + underscore, used in GLSL. */
  private readonly _safeAttrName: string

  constructor(attributeName: string, attributeType: 'float' | 'vec3' = 'vec3') {
    super('Attribute')

    // SECURITY: sanitize the attribute name for safe use in GLSL identifiers
    this._safeAttrName = attributeName.replace(/[^a-zA-Z0-9_]/g, '_')
    this.attributeName = attributeName
    this.parameters.attributeType = attributeType === 'float' ? 1 : 0

    this._outputs = this.createOutputs({ Fac: 'float', Vector: 'color' })
  }

  getOutputSockets() { return this._outputs }

  vertexInjections() {
    const isFloat = this.parameters.attributeType === 1
    const varyingName = `vAttr_${this._safeAttrName}`

    if (isFloat) {
      return [{ attrName: this.attributeName, attrType: 'float' as const, varyingName }]
    }
    return [{ attrName: this.attributeName, attrType: 'vec3' as const, varyingName }]
  }

  compileDefs(): string { return '' }

  compileCall(ctx: CompileContext): string {
    const isFloat = this.parameters.attributeType === 1
    const varyingName = `vAttr_${this._safeAttrName}`
    const outFac    = ctx.outputVar(this, 'Fac')
    const outVector = ctx.outputVar(this, 'Vector')

    if (isFloat) {
      return [
        `float ${outFac}    = ${varyingName};`,
        `vec3  ${outVector} = vec3(${varyingName}, ${varyingName}, ${varyingName});`,
      ].join('\n  ')
    }

    return [
      `vec3  ${outVector} = ${varyingName};`,
      `float ${outFac}    = length(${varyingName});`,
    ].join('\n  ')
  }
}
