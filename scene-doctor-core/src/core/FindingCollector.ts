import { fingerprint } from './fingerprint.js'
import type { Finding, RawFinding } from './types.js'

export class FindingCollector {
  private readonly byFingerprint = new Map<string, Finding>()

  public add(raw: RawFinding): void {
    const key = fingerprint(raw)
    const existing = this.byFingerprint.get(key)
    if (existing) {
      existing.count++
      return
    }
    this.byFingerprint.set(key, { ...raw, fingerprint: key, count: 1 })
  }

  public list(): Finding[] {
    return [...this.byFingerprint.values()]
  }

  public clear(): void {
    this.byFingerprint.clear()
  }
}
