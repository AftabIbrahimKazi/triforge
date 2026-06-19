export type ShaderOutput = {
  /** Function definitions — inject before main() */
  defs: string
  /** Variable assignment — inject inside main() */
  call: string
  /** Name of the output variable produced by `call` */
  varName: string
  type: 'float' | 'vec2' | 'vec3' | 'vec4'
  uniforms?: Record<string, unknown>
}

export interface ShaderFunctionOptions {
  scale?: number
  intensity?: number
  octaves?: number
  seed?: number
}
