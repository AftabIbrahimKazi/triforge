import { ShaderNodeError } from './ShaderNodeError.js'
import { ShaderConfig } from './ShaderConfig.js'
import { InputSocket } from './InputSocket.js'
import { OutputSocket } from './OutputSocket.js'
import type { SocketType } from './SocketType.js'

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ]
}

let nodeCounter = 0

/** Shorthand input definition: [socketType, defaultValue] */
type InputDef = [SocketType, unknown, boolean?]

/** Shorthand output definition: socketType */
type OutputDef = SocketType

export interface NodeMetadata {
  label:    string
  category: string
  color:    string
  cost:     'low' | 'medium' | 'high'
  costNote?: string
}

/**
 * Abstract base for all shader nodes.
 * Do not extend directly — use InputNode, OutputNode, or ProcessNode.
 */
export abstract class ShaderNode {
  readonly id: string

  /** Per-instance GLSL override. Takes priority over static glslFunction. */
  glslFunction?: string

  /**
   * Extra uniforms this node needs beyond its input sockets.
   * Override to register float uniforms that are driven externally
   * (e.g. LightPath ray-type flags set by LightPathController).
   * Returns map of uniformName → initial float value.
   */
  extraUniforms(): Record<string, number> { return {} }

  /**
   * Live parameters for this node.
   * Floats and color ([r,g,b]) inputs are auto-populated by createInputs.
   * After compile(), setters proxy directly to GPU uniforms — GSAP-compatible.
   *
   * @example
   * gsap.to(noise.parameters, { scale: 10.0, duration: 2 })
   * node.parameters.baseColor = [1.0, 0.5, 0.0]
   */
  parameters: Record<string, number | [number, number, number]> = {}

  /** Maps paramName → uniformName for _wireParameters. Internal use only. */
  private _uniformMap:   Map<string, string> = new Map()
  /** Tracks which paramNames are color (vec3) uniforms. */
  private _colorParams:  Set<string>         = new Set()

  constructor(nodeType: string) {
    this.id = `${nodeType}_${++nodeCounter}`
  }

  abstract get nodeType(): string
  abstract get metadata(): NodeMetadata

  abstract getInputSockets():  Record<string, InputSocket<unknown>>
  abstract getOutputSockets(): Record<string, OutputSocket>

  /**
   * Declares custom vertex attribute → varying pairs needed by this node.
   * CompileContext collects these and injects them into the vertex and fragment shaders.
   * Override in nodes that read custom BufferGeometry attributes (e.g. OceanAttribute).
   *
   * @example
   * vertexInjections() {
   *   return [{ attrName: 'foam', attrType: 'float', varyingName: 'vFoam' }]
   * }
   */
  vertexInjections(): Array<{ attrName: string; attrType: 'float' | 'vec2' | 'vec3'; varyingName: string }> {
    return []
  }

  /**
   * Returns the named output socket.
   * Throws ShaderNodeError if the socket does not exist.
   */
  output(name: string): OutputSocket {
    const sockets = this.getOutputSockets()

    if (ShaderConfig.errorLevel !== 'off' && !sockets[name]) {
      ShaderNodeError.throw({
        nodeType:  this.nodeType,
        nodeId:    this.id,
        problem:   `Output socket "${name}" does not exist.`,
        fix:       `Available outputs: ${Object.keys(sockets).join(', ')}`,
      })
    }

    return sockets[name]!
  }

  /**
   * Returns GLSL function definition(s) for this node type.
   * Shared across all instances of the same type unless instanceSpecificDef is true.
   */
  abstract compileDefs(): string

  /**
   * Returns GLSL variable assignment(s) for this node instance.
   * Called once per node in dependency order inside main().
   */
  abstract compileCall(ctx: import('./CompileContext.js').CompileContext): string

  /**
   * When true, compileDefs() output is unique per instance
   * and is not deduplicated by the CompileContext.
   * Use for nodes whose function body contains baked-in values (e.g. ColorRamp).
   */
  static instanceSpecificDef = false

  /**
   * Creates input sockets from a compact definition map.
   * Connects any OutputSocket values automatically.
   *
   * @example
   * this._inputs = this.createInputs(inputs, {
   *   scale:     ['float',  5.0],
   *   roughness: ['float',  0.5],
   *   vector:    ['vector', null],
   * })
   */
  protected createInputs(
    supplied: Record<string, unknown>,
    defs: Record<string, InputDef>,
  ): Record<string, InputSocket<unknown>> {
    const sockets: Record<string, InputSocket<unknown>> = {}

    for (const [name, [type, defaultValue, required = false]] of Object.entries(defs)) {
      const value   = supplied[name]
      const literal = value instanceof OutputSocket ? defaultValue : (value ?? defaultValue)
      const socket  = new InputSocket(name, type, literal, required)
      if (value instanceof OutputSocket) socket.connection = value

      // Auto-register float inputs as uniforms and populate parameters
      if (type === 'float' && typeof literal === 'number') {
        socket.uniformName = `u_${this.id}_${name}`
        this._uniformMap.set(name, socket.uniformName)
        this.parameters[name] = literal
      }

      // Auto-register unconnected color inputs as vec3 uniforms
      if (type === 'color' && !(value instanceof OutputSocket)) {
        if (typeof literal === 'string' || Array.isArray(literal)) {
          socket.uniformName = `u_${this.id}_${name}`
          this._uniformMap.set(name, socket.uniformName)
          this._colorParams.add(name)
          this.parameters[name] = typeof literal === 'string' ? hexToRgb(literal) : (literal as [number, number, number])
        }
      }

      sockets[name] = socket
    }

    return sockets
  }

  /**
   * Creates output sockets from a compact definition map.
   *
   * @example
   * this._outputs = this.createOutputs({ Fac: 'float', Color: 'color' })
   */
  protected createOutputs(
    defs: Record<string, OutputDef>,
  ): Record<string, OutputSocket> {
    const sockets: Record<string, OutputSocket> = {}
    for (const [name, type] of Object.entries(defs)) {
      sockets[name] = new OutputSocket(this, name, type)
    }
    return sockets
  }

  /**
   * Wires each entry in parameters to the corresponding GPU uniform.
   * Called automatically by OutputNode.compile() — do not call manually.
   * After wiring, reading/writing parameters[name] reads/writes the live uniform value.
   */
  _wireParameters(uniforms: Record<string, { value: unknown }>): void {
    for (const [paramName, uniformName] of this._uniformMap.entries()) {
      if (uniformName in uniforms) {
        if (this._colorParams.has(paramName)) {
          Object.defineProperty(this.parameters, paramName, {
            get:          () => uniforms[uniformName].value as [number, number, number],
            set:          (v: [number, number, number]) => { uniforms[uniformName].value = v },
            enumerable:   true,
            configurable: true,
          })
        } else {
          Object.defineProperty(this.parameters, paramName, {
            get:          () => uniforms[uniformName].value as number,
            set:          (v: number) => { uniforms[uniformName].value = v },
            enumerable:   true,
            configurable: true,
          })
        }
      }
    }
  }
}
