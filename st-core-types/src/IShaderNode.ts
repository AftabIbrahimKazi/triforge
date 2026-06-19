import type { ShaderMaterial } from 'three'

/**
 * IShaderNode — the minimal interface shared by all st-shader-core nodes.
 *
 * Nodes compile to GLSL functions. Terminal nodes (MaterialOutput) also
 * expose compile() which produces the final ShaderMaterial.
 *
 * Use this when writing utilities that accept any node without importing
 * the concrete ShaderNode class from st-shader-core.
 */
export interface IShaderNode {
  /** Unique stable ID for this node instance. */
  readonly id: string
  /** Node type name matching Blender's node name. */
  readonly nodeType: string
  /** All scalar parameters — GSAP / st-keyframe compatible. */
  parameters: Record<string, number | [number, number, number]>
}

/**
 * IOutputNode — a terminal node that can compile to a ShaderMaterial.
 * Implemented by MaterialOutput.
 */
export interface IOutputNode extends IShaderNode {
  material: ShaderMaterial | null
  compile(): ShaderMaterial
}
