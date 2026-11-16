import type { RawFinding } from './types.js'

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193
const HEX_RADIX = 16
const FIELD_SEPARATOR = '\u0000'

export function fingerprint(finding: RawFinding): string {
  const text = [finding.rule, finding.path, finding.cause ?? ''].join(FIELD_SEPARATOR)
  let hash = FNV_OFFSET
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0).toString(HEX_RADIX)
}
