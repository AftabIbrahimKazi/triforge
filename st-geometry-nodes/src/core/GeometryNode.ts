import type { BufferGeometry } from 'three'

/** A value that can be passed to a node input socket. */
export type SocketValue =
  | BufferGeometry
  | BufferGeometry[]
  | number
  | boolean
  | [number, number, number]
  | ((index: number, count: number) => number)        // FloatField
  | ((index: number, count: number) => [number,number,number])  // VectorField
  | null

/** Lazy reference to a named output socket of a node. */
export class OutputRef {
  constructor(
    readonly node: GeometryNode,
    readonly socket: string,
  ) {}

  /** Evaluate the full graph and return this socket's value. */
  evaluate(): SocketValue {
    return evaluateGraph(this)
  }
}

/** Raw input map — may contain OutputRefs (connected sockets) or plain values. */
export type RawInputs  = Record<string, OutputRef | SocketValue>
/** Resolved input map — all OutputRefs replaced with their values. */
export type Inputs     = Record<string, SocketValue>

/**
 * Base class for all Geometry Nodes.
 * Mirrors Blender's Geometry Nodes interface — same node names, same socket names.
 */
export abstract class GeometryNode {
  abstract readonly nodeType: string
  /** All scalar simulation parameters — GSAP/st-keyframe compatible. */
  abstract parameters: Record<string, number | boolean | string | [number,number,number]>

  /** @internal stored raw inputs for the evaluator */
  _inputs: RawInputs = {}

  /** Return a lazy reference to a named output socket. */
  output(socket: string): OutputRef {
    return new OutputRef(this, socket)
  }

  /**
   * Evaluate this node given already-resolved inputs.
   * Return a map of output socket name → value.
   */
  abstract _evaluate(inputs: Inputs): Record<string, SocketValue>
}

// ── Graph evaluator (declared here to avoid circular import) ──────────────────

type Cache = WeakMap<GeometryNode, Record<string, SocketValue>>

function resolveRef(value: OutputRef | SocketValue | Array<OutputRef | SocketValue>, cache: Cache): SocketValue {
  if (Array.isArray(value)) {
    return value.map(v => resolveRef(v, cache)) as unknown as SocketValue
  }
  if (!(value instanceof OutputRef)) return value
  const { node, socket } = value

  if (!cache.has(node)) {
    const resolved: Inputs = {}
    for (const [k, v] of Object.entries(node._inputs)) {
      resolved[k] = resolveRef(v as OutputRef | SocketValue, cache)
    }
    cache.set(node, node._evaluate(resolved))
  }

  const outputs = cache.get(node)!
  if (!(socket in outputs)) {
    throw new Error(`Node "${node.nodeType}" has no output socket "${socket}". Available: ${Object.keys(outputs).join(', ')}`)
  }
  return outputs[socket]
}

export function evaluateGraph(ref: OutputRef): SocketValue {
  return resolveRef(ref, new WeakMap())
}
