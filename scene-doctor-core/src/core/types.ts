export type Severity = 'error' | 'warn' | 'info'

export type ReportFormat = 'compact' | 'json' | 'md'

export interface RawFinding {
  rule: string
  severity: Severity
  path: string
  message: string
  cause?: string
}

export interface Finding extends RawFinding {
  fingerprint: string
  count: number
}

export interface Rule<TContext> {
  id: string
  check(context: TContext, emit: (finding: RawFinding) => void): void
}

export interface ReportOptions {
  maxTokens?: number
  format?: ReportFormat
  delta?: boolean
}

export interface Report {
  findings: Finding[]
  omitted: number
  totals: Record<Severity, number>
}

export interface SceneDoctorConfig<TContext> {
  rules: Array<Rule<TContext>>
}

export interface ParameterDescriptor {
  id: string
  path: string
  key: string
  value: number | boolean
  min: number
  max: number
  step: number
}

export interface EditRecord {
  id: string
  from: number | boolean
  to: number | boolean
}

export interface RegisterOptions {
  keys?: string[]
  ranges?: Record<string, [number, number]>
}

export interface AiAdapter {
  name: string
  complete(prompt: string): Promise<string>
}

export type AiResult =
  | { ok: true; text: string; promptTokens: number }
  | { ok: false; error: string }

export interface ExportOptions {
  scene?: unknown
}

export interface ExportBundle {
  v: number
  note: string
  report: string
  edits: Array<{ id: string; f: number | boolean; t: number | boolean }>
  scene?: unknown
}
