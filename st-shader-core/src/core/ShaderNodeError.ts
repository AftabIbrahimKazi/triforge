import { ShaderConfig } from './ShaderConfig.js'

export interface ShaderNodeErrorOptions {
  nodeType:    string
  nodeId:      string
  inputName?:  string
  problem:     string
  fix?:        string
  graphPath?:  string[]
}

/**
 * Structured error thrown by the shader node system.
 * Always catchable — never writes to console directly.
 *
 * Message detail is controlled by ShaderConfig.errorLevel:
 *   verbose  — full message with fix suggestions and graph path
 *   standard — node type, ID, and problem only
 *   off      — errors are not thrown at all
 */
export class ShaderNodeError extends Error {
  readonly nodeType:   string
  readonly nodeId:     string
  readonly inputName?: string
  readonly problem:    string
  readonly fix?:       string
  readonly graphPath?: string[]

  constructor(opts: ShaderNodeErrorOptions) {
    super(ShaderNodeError.buildMessage(opts))
    this.name      = 'ShaderNodeError'
    this.nodeType  = opts.nodeType
    this.nodeId    = opts.nodeId
    this.inputName = opts.inputName
    this.problem   = opts.problem
    this.fix       = opts.fix
    this.graphPath = opts.graphPath
    Object.setPrototypeOf(this, ShaderNodeError.prototype)
  }

  private static buildMessage(opts: ShaderNodeErrorOptions): string {
    const level = ShaderConfig.errorLevel

    if (level === 'standard') {
      const where = opts.inputName
        ? `[${opts.nodeType}:${opts.nodeId}] input "${opts.inputName}"`
        : `[${opts.nodeType}:${opts.nodeId}]`
      return `ShaderNodeError — ${where}: ${opts.problem}`
    }

    // verbose
    const lines: string[] = [
      '─'.repeat(60),
      `ShaderNodeError`,
      `  Node    : ${opts.nodeType}`,
      `  ID      : ${opts.nodeId}`,
    ]

    if (opts.inputName) {
      lines.push(`  Input   : "${opts.inputName}"`)
    }

    lines.push('', `  Problem : ${opts.problem}`)

    if (opts.fix) {
      lines.push('', `  Fix     : ${opts.fix}`)
    }

    if (opts.graphPath && opts.graphPath.length > 0) {
      lines.push('', `  Path    : ${opts.graphPath.join(' → ')}`)
    }

    lines.push('─'.repeat(60))
    return lines.join('\n')
  }

  /** Throw only if errorLevel is not 'off'. */
  static throw(opts: ShaderNodeErrorOptions): never {
    throw new ShaderNodeError(opts)
  }

  /** Conditionally throw based on errorLevel. */
  static throwIf(condition: boolean, opts: ShaderNodeErrorOptions): void {
    if (condition && ShaderConfig.errorLevel !== 'off') {
      throw new ShaderNodeError(opts)
    }
  }
}
