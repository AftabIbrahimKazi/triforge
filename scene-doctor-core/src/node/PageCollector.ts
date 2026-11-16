import type { RawFinding } from '../core/types.js'
import type { BrowserLauncher, PageLike, PageScanOptions } from './types.js'

const DEFAULT_SETTLE_MS = 1500
const MAX_MESSAGE_LENGTH = 300
const HTTP_ERROR_FLOOR = 400

function clip(text: string): string {
  return text.slice(0, MAX_MESSAGE_LENGTH)
}

export async function collectPageFindings(
  page: PageLike,
  url: string,
  options: PageScanOptions = {},
): Promise<RawFinding[]> {
  const findings: RawFinding[] = []
  page.on('console', (message) => {
    const type = message.type()
    if (type !== 'error' && type !== 'warning') return
    findings.push({
      rule: 'console-' + type,
      severity: type === 'error' ? 'error' : 'warn',
      path: url,
      message: clip(message.text()),
    })
  })
  page.on('pageerror', (error) => {
    findings.push({ rule: 'page-error', severity: 'error', path: url, message: clip(error.message) })
  })
  page.on('requestfailed', (request) => {
    findings.push({
      rule: 'request-failed',
      severity: 'warn',
      path: url,
      message: clip(request.url()),
      cause: request.failure()?.errorText,
    })
  })
  page.on('response', (response) => {
    if (response.status() < HTTP_ERROR_FLOOR) return
    findings.push({
      rule: 'http-error',
      severity: 'warn',
      path: url,
      message: `${response.status()} ${clip(response.url())}`,
      cause: 'missing asset or wrong path',
    })
  })
  try {
    await page.goto(url)
    await page.waitForTimeout(options.settleMs ?? DEFAULT_SETTLE_MS)
  } catch (error) {
    findings.push({
      rule: 'page-load-failed',
      severity: 'error',
      path: url,
      message: clip(error instanceof Error ? error.message : String(error)),
    })
  }
  return findings
}

export async function scanPages(
  launcher: BrowserLauncher,
  urls: string[],
  options: PageScanOptions = {},
): Promise<RawFinding[]> {
  const browser = await launcher.launch()
  const all: RawFinding[] = []
  try {
    for (const url of urls) {
      const page = await browser.newPage()
      all.push(...(await collectPageFindings(page, url, options)))
    }
  } finally {
    await browser.close()
  }
  return all
}
