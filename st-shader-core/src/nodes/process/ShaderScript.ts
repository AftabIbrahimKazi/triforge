import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'
import type { SocketType } from '../../core/SocketType.js'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Declare an input socket: [glslType, defaultValue]
 *   'float'  → float   (uniform or literal)
 *   'color'  → vec3    (uniform or literal hex / [r,g,b])
 *   'vector' → vec2    (UV coordinates)
 *   'shader' → vec3    (BSDF connection)
 */
export type ScriptInputDecl = ['float' | 'color' | 'vector' | 'shader', unknown]

/** Output socket type map: socketName → glslType */
export type ScriptOutputDecl = Record<string, 'float' | 'color' | 'vector' | 'shader'>

export interface ShaderScriptConfig {
  /**
   * Input sockets.  Each entry is either:
   *   ['float'|'color'|'vector', defaultValue]   — static or connectable socket
   *   OutputSocket                                — already-connected socket
   */
  inputs?:  Record<string, ScriptInputDecl | OutputSocket>

  /** Output socket names and their types. */
  outputs?: ScriptOutputDecl

  /**
   * GLSL body.  Input names are available as local variables.
   * Output names must be assigned before the block ends.
   *
   * @example
   * glsl: `
   *   result = sin(myScale * 6.28318) * 0.5 + 0.5;
   *   outColor = mix(colorA, colorB, result);
   * `
   */
  glsl: string

  /**
   * Optional GLSL helper functions emitted once above main().
   * Use this for custom math utilities, noise functions, etc.
   */
  defs?: string

  /** Display name shown in error messages and metadata. */
  label?: string
}

// ── ShaderScript node ─────────────────────────────────────────────────────────

/**
 * ShaderScript — Blender "Script Node (OSL)" equivalent for st-shader-core.
 *
 * Wraps a block of custom GLSL as a first-class node in the shader graph.
 * Input and output sockets connect to all other nodes normally.
 *
 * Inside the GLSL body:
 *   • Input sockets are available as local variables with the exact name you declared.
 *   • Output sockets must be assigned by name before the block ends.
 *   • GLSL types: 'float' → float, 'color'/'shader' → vec3, 'vector' → vec2
 *
 * @example
 * const ripple = new ShaderScript({
 *   inputs: {
 *     uv:    textureCoord.output('UV'),   // connected vec2
 *     speed: ['float', 1.0],              // animatable float uniform
 *     color: ['color', '#0055ff'],        // live vec3 uniform
 *   },
 *   outputs: { result: 'float', tinted: 'color' },
 *   glsl: `
 *     float wave = sin(uv.x * 12.566 - speed * uTime) * 0.5 + 0.5;
 *     result = wave;
 *     tinted = color * wave;
 *   `,
 * })
 */
export class ShaderScript extends ProcessNode {
  get nodeType() { return 'ShaderScript' }
  static instanceSpecificDef = true   // every script is unique — no dedup

  get metadata(): NodeMetadata {
    return {
      label:    this._label,
      category: 'Script',
      color:    '#336655',
      cost:     'high',
      costNote: 'Custom GLSL — performance depends on script content.',
    }
  }

  private readonly _glsl:        string
  private readonly _defs:        string
  private readonly _label:       string
  private readonly _outputDecl:  ScriptOutputDecl
  private readonly _inputs:      Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs:     Record<string, OutputSocket>

  constructor(config: ShaderScriptConfig) {
    super('ShaderScript')

    this._glsl      = config.glsl  ?? ''
    this._defs      = config.defs  ?? ''
    this._label     = config.label ?? 'Shader Script'
    this._outputDecl = config.outputs ?? {}

    // ── Build input defs + supplied maps ────────────────────────────────────
    const defs:     Record<string, [SocketType, unknown]> = {}
    const supplied: Record<string, unknown>               = {}

    for (const [name, spec] of Object.entries(config.inputs ?? {})) {
      if (Array.isArray(spec)) {
        // ['float'|'color'|'vector'|'shader', defaultValue]
        const [type, defaultVal] = spec
        defs[name]     = [type as SocketType, defaultVal]
        // Leave supplied[name] undefined → createInputs uses defs default
      } else {
        // It's an OutputSocket (already connected)
        const sock = spec as OutputSocket
        defs[name]     = [sock.type, null]
        supplied[name] = sock
      }
    }

    this._inputs  = this.createInputs(supplied, defs)
    this._outputs = this.createOutputs(this._outputDecl as Record<string, SocketType>)
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  /** Emit any helper functions the user declared. */
  compileDefs(): string { return this._defs.trim() }

  /**
   * Emit the script body as a GLSL block:
   *  1. Declare each input as a local variable (resolved from graph).
   *  2. Declare each output as a local variable.
   *  3. Execute the user's GLSL body in a scoped block.
   *  4. Copy local output vars → canonical output variable names.
   */
  compileCall(ctx: CompileContext): string {
    const lines: string[] = []

    // ── 1. Inputs as local variables ─────────────────────────────────────────
    for (const [name, socket] of Object.entries(this._inputs)) {
      const glslType = this._socketGlslType(socket.type)
      const resolved = ctx.resolveInput(socket)
      lines.push(`${glslType} ${name} = ${resolved};`)
    }

    // ── 2. Output local variables ─────────────────────────────────────────────
    for (const [name, type] of Object.entries(this._outputDecl)) {
      const glslType = this._declGlslType(type)
      lines.push(`${glslType} ${name};`)
    }

    // ── 3. User script body in a scoped block ─────────────────────────────────
    lines.push('{')
    for (const line of this._glsl.trim().split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('}')

    // ── 4. Copy locals → canonical output var names ───────────────────────────
    for (const [name, type] of Object.entries(this._outputDecl)) {
      const glslType = this._declGlslType(type)
      lines.push(`${glslType} ${ctx.outputVar(this, name)} = ${name};`)
    }

    return lines.join('\n  ')
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private _socketGlslType(type: SocketType): string {
    if (type === 'float')  return 'float'
    if (type === 'vector') return 'vec2'
    return 'vec3'  // 'color' | 'shader'
  }

  private _declGlslType(type: string): string {
    if (type === 'float')  return 'float'
    if (type === 'vector') return 'vec2'
    return 'vec3'  // 'color' | 'shader'
  }
}
