import type { EditSession } from './EditSession.js'
import type { ExportBundle, ExportOptions } from './types.js'

const BUNDLE_VERSION = 1
const INSTRUCTION =
  'Apply each edit to the source: id=object.param, f=old value, t=new value. Then fix each finding listed in report.'

export function buildExport(
  session: EditSession,
  reportText: string,
  options: ExportOptions = {},
): ExportBundle {
  const edits = session.edits().map((edit) => ({ id: edit.id, f: edit.from, t: edit.to }))
  return {
    v: BUNDLE_VERSION,
    note: INSTRUCTION,
    report: reportText,
    edits,
    scene: options.scene,
  }
}

export function bundleToJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle)
}

export function bundleToMarkdown(bundle: ExportBundle): string {
  const edits = bundle.edits.map((e) => `- \`${e.id}\`: ${e.f} -> ${e.t}`)
  return [
    `# scene-doctor export v${bundle.v}`,
    bundle.note,
    '## report',
    bundle.report,
    '## edits',
    ...(edits.length > 0 ? edits : ['none']),
  ].join('\n')
}
