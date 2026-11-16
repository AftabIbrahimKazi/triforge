import { formatFinding, formatHeader, formatOmitted } from './format.js'
import { estimateTokens } from './tokens.js'
import type { Finding, Report, ReportFormat, ReportOptions, Severity } from './types.js'

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warn: 1, info: 2 }
const DEFAULT_MAX_TOKENS = 1500

export class Reporter {
  private baseline = new Map<string, number>()

  public build(findings: Finding[], options: ReportOptions = {}): Report {
    const scoped = options.delta ? findings.filter((f) => this.isChanged(f)) : findings
    const ranked = [...scoped].sort(compareFindings)
    const totals: Record<Severity, number> = { error: 0, warn: 0, info: 0 }
    for (const finding of ranked) totals[finding.severity] += finding.count
    const format = options.format ?? 'compact'
    const budget = options.maxTokens ?? DEFAULT_MAX_TOKENS
    const header: Report = { findings: [], omitted: 0, totals }
    let used = estimateTokens(formatHeader(header, format))
    const kept: Finding[] = []
    for (const finding of ranked) {
      const cost = estimateTokens(formatFinding(finding, format))
      if (used + cost > budget && kept.length > 0) break
      used += cost
      kept.push(finding)
    }
    return { findings: kept, omitted: ranked.length - kept.length, totals }
  }

  public render(report: Report, format: ReportFormat = 'compact'): string {
    const lines = report.findings.map((f) => formatFinding(f, format))
    if (report.omitted > 0) lines.push(formatOmitted(report.omitted, format))
    return [formatHeader(report, format), ...lines].join('\n')
  }

  public commit(findings: Finding[]): void {
    this.baseline = new Map(findings.map((f) => [f.fingerprint, f.count]))
  }

  private isChanged(finding: Finding): boolean {
    return this.baseline.get(finding.fingerprint) !== finding.count
  }
}

function compareFindings(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  return bySeverity !== 0 ? bySeverity : b.count - a.count
}
