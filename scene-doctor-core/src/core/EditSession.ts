import type { EditRecord, ParameterDescriptor, RegisterOptions } from './types.js'

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const DEFAULT_SPAN = 4
const MIN_SPAN = 1
const DEFAULT_STEP_DIVISOR = 100

interface Entry {
  path: string
  key: string
  target: Record<string, unknown>
  original: number | boolean
  written: number | boolean
  min: number
  max: number
  step: number
}

export class EditSession {
  private readonly entries = new Map<string, Entry>()

  public register(path: string, owner: object, options: RegisterOptions = {}): void {
    const target = resolveTarget(owner)
    const keys = options.keys ?? Object.keys(target)
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(target, key)) continue
      const value = target[key]
      if (!isEditable(value)) continue
      const range = options.ranges?.[key]
      const span = Math.max(typeof value === 'number' ? Math.abs(value) : MIN_SPAN, MIN_SPAN) * DEFAULT_SPAN
      const min = range?.[0] ?? (typeof value === 'number' && value < 0 ? -span : 0)
      const max = range?.[1] ?? span
      this.entries.set(`${path}.${key}`, {
        path,
        key,
        target,
        original: value,
        written: value,
        min,
        max,
        step: (max - min) / DEFAULT_STEP_DIVISOR,
      })
    }
  }

  public list(): ParameterDescriptor[] {
    return [...this.entries.entries()].map(([id, entry]) => ({
      id,
      path: entry.path,
      key: entry.key,
      value: entry.target[entry.key] as number | boolean,
      min: entry.min,
      max: entry.max,
      step: entry.step,
    }))
  }

  public get(id: string): number | boolean | undefined {
    const entry = this.entries.get(id)
    return entry ? (entry.target[entry.key] as number | boolean) : undefined
  }

  public set(id: string, value: number | boolean): boolean {
    const entry = this.entries.get(id)
    if (!entry || typeof value !== typeof entry.original) return false
    if (typeof value === 'number' && !Number.isFinite(value)) return false
    entry.target[entry.key] = value
    entry.written = value
    return true
  }

  public edits(): EditRecord[] {
    const changed: EditRecord[] = []
    for (const [id, entry] of this.entries) {
      const current = entry.target[entry.key] as number | boolean
      if (current === entry.written && current !== entry.original) changed.push({ id, from: entry.original, to: current })
    }
    return changed
  }

  public reset(): void {
    for (const entry of this.entries.values()) {
      entry.target[entry.key] = entry.original
      entry.written = entry.original
    }
  }

  public driven(): string[] {
    const ids: string[] = []
    for (const [id, entry] of this.entries) {
      if (entry.target[entry.key] !== entry.written) ids.push(id)
    }
    return ids
  }

  public destroy(): void {
    this.entries.clear()
  }
}

function resolveTarget(owner: object): Record<string, unknown> {
  const withParameters = owner as { parameters?: unknown } // probing for the ecosystem's public parameters object
  const inner = withParameters.parameters
  return (inner && typeof inner === 'object' ? inner : owner) as Record<string, unknown> // both branches are plain objects
}

function isEditable(value: unknown): value is number | boolean {
  return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean'
}
