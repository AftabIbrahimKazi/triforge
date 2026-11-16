#!/usr/bin/env node
import { SceneDoctor } from '../core/SceneDoctor.js'
import { readSourceFiles } from './scanDirectory.js'
import { staticRules } from './staticRules.js'
import { findDevLeaks } from './stripCheck.js'
import type { ReportFormat } from '../core/types.js'

const EXIT_OK = 0
const EXIT_FINDINGS = 1
const EXIT_USAGE = 2
const DEFAULT_TOKENS = 1500
const FORMATS: ReportFormat[] = ['compact', 'json', 'md']
const USAGE = 'usage: scene-doctor scan <dir> [--tokens N] [--format compact|json|md]\n       scene-doctor strip-check <build-dir>\n'

function write(text: string): void {
  process.stdout.write(text + '\n')
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function runScan(args: string[]): Promise<number> {
  const dir = args[0]
  if (!dir) return usage()
  const format = option(args, '--format') as ReportFormat | undefined // validated against FORMATS below
  if (format !== undefined && !FORMATS.includes(format)) return usage()
  const tokens = Number(option(args, '--tokens') ?? DEFAULT_TOKENS)
  if (!Number.isFinite(tokens) || tokens <= 0) return usage()
  const doctor = new SceneDoctor({ rules: staticRules })
  const findings = doctor.run({ files: await readSourceFiles(dir) })
  write(doctor.report(findings, { maxTokens: tokens, format }))
  return findings.some((f) => f.severity === 'error') ? EXIT_FINDINGS : EXIT_OK
}

async function runStripCheck(args: string[]): Promise<number> {
  const dir = args[0]
  if (!dir) return usage()
  const leaks = await findDevLeaks(dir)
  if (leaks.length === 0) {
    write('strip-check: clean')
    return EXIT_OK
  }
  write(`strip-check: dev code found in ${leaks.length} file(s)`)
  for (const file of leaks) write(`  ${file}`)
  return EXIT_FINDINGS
}

function usage(): number {
  process.stderr.write(USAGE)
  return EXIT_USAGE
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv
  try {
    if (command === 'scan') return await runScan(rest)
    if (command === 'strip-check') return await runStripCheck(rest)
    return usage()
  } catch (error) {
    process.stderr.write(`scene-doctor: ${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_USAGE
  }
}

process.exitCode = await main(process.argv.slice(2))
