import { ShaderNode } from './ShaderNode.js'

/**
 * Transform node — has both inputs and outputs.
 * Examples: NoiseTexture, ColorRamp, PrincipledBSDF.
 */
export abstract class ProcessNode extends ShaderNode {}
