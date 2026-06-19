import { ShaderNodeError } from './ShaderNodeError.js'
import { ShaderConfig } from './ShaderConfig.js'
import { SOCKET_GLSL_TYPE } from './SocketType.js'
import type { ShaderNode } from './ShaderNode.js'
import type { InputSocket } from './InputSocket.js'
import type { OutputNode } from './OutputNode.js'

export interface CompiledMaterial {
  vertexShader:   string
  fragmentShader: string
  uniforms:       Record<string, { value: unknown }>
  nodes:          ShaderNode[]
}

/**
 * Walks the node graph from an OutputNode, validates all connections,
 * deduplicates GLSL function definitions, scopes variable names to node IDs,
 * and emits a complete vertex + fragment shader pair.
 *
 * Three responsibilities:
 *   1. Topological sort     — correct dependency order
 *   2. Deduplication        — one function def per node type
 *   3. Variable authority   — all GLSL variable names owned here
 */
export class CompileContext {
  private visited:      Set<string>                        = new Set()
  private visiting:     Set<string>                        = new Set()
  private order:        ShaderNode[]                       = []
  private emittedDefs:  Set<string>                        = new Set()
  private defs:         string[]                           = []
  private calls:        string[]                           = []
  private graphPath:    string[]                           = []
  private _uniforms:    Record<string, { value: number | number[] }>  = {}
  /** Collected vertex attribute→varying injections from all nodes. Keyed by varyingName. */
  private _vertexInjections: Map<string, { attrName: string; attrType: string }> = new Map()

  // ── Public API ────────────────────────────────────────────────────

  compile(outputNode: OutputNode): CompiledMaterial {
    this.graphPath = [outputNode.nodeType]
    this.validate(outputNode)
    this.visit(outputNode)
    this.emit()

    return {
      vertexShader:   this.buildVertexShader(),
      fragmentShader: this.buildFragmentShader(),
      uniforms:       this._uniforms,
      nodes:          this.order,
    }
  }

  /**
   * Returns the GLSL variable name for a node's output socket.
   * Format: _st_{nodeId}_{socketName}
   */
  outputVar(node: ShaderNode, socketName: string): string {
    const safe = socketName.replace(/[^a-zA-Z0-9_]/g, '_')
    return `_st_${node.id}_${safe}`
  }

  /**
   * Resolves an input socket to a GLSL expression.
   * If connected → returns the upstream node's output variable name.
   * If float with uniformName → registers a uniform and returns its name (live, GSAP-driveable).
   * Otherwise → returns a GLSL literal from the socket's default value.
   */
  resolveInput(socket: InputSocket<unknown>): string {
    if (socket.connection) {
      return this.outputVar(socket.connection.node, socket.connection.name)
    }
    if (socket.uniformName !== null) {
      if (!(socket.uniformName in this._uniforms)) {
        if (socket.type === 'color') {
          const raw = socket.defaultValue
          const rgb: number[] = typeof raw === 'string'
            ? CompileContext.hexToRgbArray(raw)
            : (Array.isArray(raw) ? raw as number[] : [1, 1, 1])
          this._uniforms[socket.uniformName] = { value: rgb }
        } else {
          this._uniforms[socket.uniformName] = { value: socket.defaultValue as number }
        }
      }
      return socket.uniformName
    }
    return this.toLiteral(socket.defaultValue, socket.type)
  }

  // ── Graph walk ────────────────────────────────────────────────────

  private visit(node: ShaderNode): void {
    if (this.visited.has(node.id)) return

    if (this.visiting.has(node.id)) {
      ShaderNodeError.throw({
        nodeType:  node.nodeType,
        nodeId:    node.id,
        problem:   'Circular dependency detected. A node cannot depend on itself through its own chain.',
        fix:       'Node outputs can only flow forward toward MaterialOutput, never back upstream.',
        graphPath: [...this.graphPath],
      })
    }

    this.visiting.add(node.id)
    this.graphPath.push(node.nodeType)

    for (const socket of Object.values(node.getInputSockets())) {
      if (socket.connection) {
        this.visit(socket.connection.node)
      }
    }

    this.graphPath.pop()
    this.visiting.delete(node.id)
    this.visited.add(node.id)
    this.order.push(node)
  }

  // ── Emission ──────────────────────────────────────────────────────

  private emit(): void {
    for (const node of this.order) {
      this.emitDefs(node)
      const call = node.compileCall(this).trim()
      if (call) this.calls.push(call)
      // Collect vertex attribute injections from this node
      for (const inj of node.vertexInjections()) {
        if (!this._vertexInjections.has(inj.varyingName)) {
          this._vertexInjections.set(inj.varyingName, { attrName: inj.attrName, attrType: inj.attrType })
        }
      }
      // Collect extra uniforms (e.g. LightPath ray-type flags)
      for (const [name, value] of Object.entries(node.extraUniforms())) {
        if (!(name in this._uniforms)) {
          this._uniforms[name] = { value }
        }
      }
    }
  }

  private emitDefs(node: ShaderNode): void {
    const NodeClass = node.constructor as typeof import('./ShaderNode.js').ShaderNode
    const isInstanceSpecific = (NodeClass as unknown as { instanceSpecificDef: boolean }).instanceSpecificDef

    // Per-instance override takes priority
    const fn = node.glslFunction
      ?? (NodeClass as unknown as { glslFunction?: string }).glslFunction

    const defsSource = node.compileDefs()

    if (isInstanceSpecific) {
      // Each instance emits its own uniquely named function — no dedup
      if (defsSource.trim()) this.defs.push(defsSource)
    } else {
      // Shared function — emit once per node type
      const key = node.nodeType
      if (!this.emittedDefs.has(key)) {
        this.emittedDefs.add(key)
        const source = fn ?? defsSource
        if (source.trim()) this.defs.push(source)
      }
    }
  }

  // ── Validation ────────────────────────────────────────────────────

  private validate(root: ShaderNode): void {
    if (ShaderConfig.errorLevel === 'off') return
    this.validateNode(root, [root.nodeType])
  }

  private validateNode(node: ShaderNode, path: string[]): void {
    for (const [, socket] of Object.entries(node.getInputSockets())) {
      // Required input with no connection and no usable default
      if (socket.required && !socket.isConnected()) {
        ShaderNodeError.throw({
          nodeType:  node.nodeType,
          nodeId:    node.id,
          inputName: socket.name,
          problem:   `Required input "${socket.name}" has no connection.`,
          fix:       `Connect a node output to ${node.nodeType}.input("${socket.name}").`,
          graphPath: path,
        })
      }

      if (socket.connection) {
        const upstream = socket.connection

        // Type compatibility check
        const compatible = this.typesCompatible(upstream.type, socket.type)
        if (!compatible) {
          ShaderNodeError.throw({
            nodeType:  node.nodeType,
            nodeId:    node.id,
            inputName: socket.name,
            problem:   `Type mismatch. Input "${socket.name}" expects "${socket.type}" but received "${upstream.type}" from ${upstream.node.nodeType}.output("${upstream.name}").`,
            fix:       ShaderConfig.errorLevel === 'verbose'
              ? `Use an output socket of type "${socket.type}", or insert a conversion node between them.`
              : undefined,
            graphPath: path,
          })
        }

        // Recurse
        this.validateNode(upstream.node, [upstream.node.nodeType, ...path])
      }
    }
  }

  private typesCompatible(from: string, to: string): boolean {
    if (from === to) return true
    // shader and color are both vec3 — compatible
    if ((from === 'shader' || from === 'color') && (to === 'shader' || to === 'color')) return true
    return false
  }

  // ── GLSL builders ─────────────────────────────────────────────────

  private buildVertexShader(): string {
    const customAttrs    = [...this._vertexInjections.entries()]
      .map(([vName, { attrName, attrType }]) => `attribute ${attrType} ${attrName};\nvarying  ${attrType} ${vName};`)
      .join('\n')
    const customAssigns  = [...this._vertexInjections.entries()]
      .map(([vName, { attrName }]) => `  ${vName} = ${attrName};`)
      .join('\n')

    return `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
${customAttrs}

void main() {
  vUv       = uv;
  vNormal   = normalize(mat3(transpose(inverse(modelMatrix))) * normal);
  vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
${customAssigns}
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`.trim()
  }

  private buildUniformDeclarations(): string {
    return Object.entries(this._uniforms)
      .map(([name, { value }]) => Array.isArray(value) ? `uniform vec3 ${name};` : `uniform float ${name};`)
      .join('\n')
  }

  private buildFragmentShader(): string {
    const uniformsBlock  = this.buildUniformDeclarations()
    const customVaryings = [...this._vertexInjections.entries()]
      .map(([vName, { attrType }]) => `varying ${attrType} ${vName};`)
      .join('\n')
    const defsBlock      = this.defs.join('\n\n')
    const callsBlock     = this.calls.map(c => `  ${c}`).join('\n')

    return `
precision mediump float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
${customVaryings}

${uniformsBlock}

${defsBlock}

void main() {
${callsBlock}
}`.trim()
  }

  // ── Literal conversion ────────────────────────────────────────────

  private toLiteral(value: unknown, type: string): string {
    switch (type) {
      case 'float':
        return (typeof value === 'number' ? value : 0).toFixed(4)

      case 'color':
        return typeof value === 'string'
          ? this.hexToVec3(value)
          : 'vec3(1.0, 1.0, 1.0)'

      case 'vector':
        return 'vec2(vUv)'

      case 'shader':
        return 'vec3(0.0)'

      default:
        return 'vec3(1.0)'
    }
  }

  static hexToRgbArray(hex: string): [number, number, number] {
    const h = hex.replace('#', '')
    return [
      parseInt(h.substring(0, 2), 16) / 255,
      parseInt(h.substring(2, 4), 16) / 255,
      parseInt(h.substring(4, 6), 16) / 255,
    ]
  }

  static hexToVec3(hex: string): string {
    const h = hex.replace('#', '')
    const r = (parseInt(h.substring(0, 2), 16) / 255).toFixed(4)
    const g = (parseInt(h.substring(2, 4), 16) / 255).toFixed(4)
    const b = (parseInt(h.substring(4, 6), 16) / 255).toFixed(4)
    return `vec3(${r}, ${g}, ${b})`
  }

  private hexToVec3(hex: string): string {
    return CompileContext.hexToVec3(hex)
  }
}
