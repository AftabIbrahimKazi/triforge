import type { Finding, Report, ReportFormat, Severity } from './types.js'

const SEVERITY_LETTER: Record<Severity, string> = { error: 'E', warn: 'W', info: 'I' }

export function formatFinding(finding: Finding, format: ReportFormat): string {
  if (format === 'json') {
    return JSON.stringify({
      r: finding.rule,
      s: SEVERITY_LETTER[finding.severity],
      p: finding.path,
      m: finding.message,
      c: finding.cause,
      n: finding.count,
    })
  }
  const times = finding.count > 1 ? ` x${finding.count}` : ''
  const cause = finding.cause ? ` | ${finding.cause}` : ''
  if (format === 'md') {
    return `- **${SEVERITY_LETTER[finding.severity]}** \`${finding.rule}\` \`${finding.path}\`${times}: ${finding.message}${cause}`
  }
  return `${SEVERITY_LETTER[finding.severity]} ${finding.rule} ${finding.path}${times}: ${finding.message}${cause}`
}

export function formatHeader(report: Report, format: ReportFormat): string {
  const { error, warn, info } = report.totals
  if (format === 'json') return JSON.stringify({ e: error, w: warn, i: info })
  if (format === 'md') return `## scene-doctor: ${error} errors, ${warn} warnings, ${info} info`
  return `# scene-doctor ${error}E ${warn}W ${info}I`
}

export function formatOmitted(omitted: number, format: ReportFormat): string {
  if (format === 'json') return JSON.stringify({ omitted })
  return `+${omitted} more omitted (token cap)`
}
