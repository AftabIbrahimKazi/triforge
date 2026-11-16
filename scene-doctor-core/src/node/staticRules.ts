import type { RawFinding, Rule } from '../core/types.js'
import type { ScanContext, SourceFile } from './types.js'

const TS_ANY = /(:\s*any\b|\bas\s+any\b|<any>)/
const TS_IGNORE = /@ts-ignore/
const EVAL_USE = /\beval\s*\(|\bnew\s+Function\s*\(/
const CONSOLE_USE = /\bconsole\.(log|debug)\s*\(/
const UNBOUNDED_LOOP = /\bwhile\s*\(\s*(true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/
const LOOP_ENTRY = /(function\s+(animate|update|tick|render|loop)\b|\b(animate|update|tick|render|loop)\s*=\s*(?:(?:\([^)]*\)|\w+)\s*)?(=>|function)|requestAnimationFrame\s*\()/
const HEAP_ALLOCATION = /\bnew\s+(THREE\.)?(Vector[234]|Matrix[34]|Quaternion|Euler|Color|Box3|Sphere|Plane|Ray)\s*\(/
const DISPOSABLE_CREATION = /\bnew\s+(THREE\.)?(WebGLRenderTarget|WebGLRenderer|DataTexture|CanvasTexture)\s*\(/
const DISPOSE_CALL = /\.dispose\s*\(/

function lineRule(
  id: string,
  pattern: RegExp,
  severity: RawFinding['severity'],
  message: string,
  cause: string,
): Rule<ScanContext> {
  return {
    id,
    check(context, emit) {
      for (const file of context.files) {
        file.text.split('\n').forEach((line, index) => {
          if (pattern.test(line)) {
            emit({ rule: id, severity, path: `${file.path}:${index + 1}`, message, cause })
          }
        })
      }
    },
  }
}

export const tsAny = lineRule('ts-any', TS_ANY, 'warn', 'any type used', 'ecosystem forbids any; use unknown and narrow')
export const tsIgnore = lineRule('ts-ignore', TS_IGNORE, 'warn', '@ts-ignore used', 'ecosystem forbids @ts-ignore; fix the type')
export const evalUse = lineRule('eval-use', EVAL_USE, 'error', 'eval or new Function used', 'code injection risk; never allowed in the ecosystem')
export const consoleUse = lineRule('console-log', CONSOLE_USE, 'info', 'console.log/debug left in code', 'remove before commit')
export const unboundedLoop = lineRule('unbounded-loop', UNBOUNDED_LOOP, 'error', 'loop has no iteration cap', 'cap with a compile-time constant; in GLSL this can hang the GPU')

function braceDelta(line: string): number {
  let delta = 0
  for (const char of line) {
    if (char === '{') delta++
    else if (char === '}') delta--
  }
  return delta
}

function loopAllocations(file: SourceFile, emit: (finding: RawFinding) => void): void {
  let depth = 0
  let inLoop = false
  file.text.split('\n').forEach((line, index) => {
    if (!inLoop && LOOP_ENTRY.test(line)) {
      inLoop = true
      depth = 0
    }
    if (!inLoop) return
    if (HEAP_ALLOCATION.test(line)) {
      emit({
        rule: 'loop-allocation',
        severity: 'warn',
        path: `${file.path}:${index + 1}`,
        message: 'math object allocated inside a per-frame function',
        cause: 'hoist to a reusable module-level or class-field instance to avoid GC stalls',
      })
    }
    depth += braceDelta(line)
    if (depth <= 0 && line.includes('}')) inLoop = false
  })
}

export const loopAllocation: Rule<ScanContext> = {
  id: 'loop-allocation',
  check(context, emit) {
    for (const file of context.files) loopAllocations(file, emit)
  },
}

export const missingDispose: Rule<ScanContext> = {
  id: 'missing-dispose',
  check(context, emit) {
    for (const file of context.files) {
      if (!DISPOSABLE_CREATION.test(file.text) || DISPOSE_CALL.test(file.text)) continue
      emit({
        rule: 'missing-dispose',
        severity: 'info',
        path: file.path,
        message: 'GPU resources created but dispose() never called in this file',
        cause: 'add a destroy path that disposes geometries, materials, textures and render targets',
      })
    }
  },
}

export const staticRules: Array<Rule<ScanContext>> = [
  tsAny,
  tsIgnore,
  evalUse,
  consoleUse,
  unboundedLoop,
  loopAllocation,
  missingDispose,
]
