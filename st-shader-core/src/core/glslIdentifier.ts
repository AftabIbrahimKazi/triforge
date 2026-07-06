/**
 * GLSL identifier validation — the single security boundary for any string
 * that a node injects verbatim into generated GLSL source (attribute names,
 * uniform names, etc). The root ecosystem rule is "NEVER interpolate
 * user-supplied strings directly into GLSL"; where a name genuinely must
 * appear in the source (e.g. a geometry attribute name the shader reads), it
 * MUST first pass this validator, which throws on anything that isn't a plain
 * GLSL identifier. A name that fails this check could never reference a usable
 * GLSL attribute/uniform anyway, so nothing legitimate is rejected.
 */

// GLSL ES identifiers: letter/underscore start, then letters/digits/underscore.
const GLSL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

// Reserved: names beginning with `gl_` are reserved by the GLSL spec, and the
// double-underscore prefix/anywhere is reserved for implementation use.
export function isValidGlslIdentifier(name: string): boolean {
  if (typeof name !== 'string') return false
  if (!GLSL_IDENTIFIER.test(name)) return false
  if (name.startsWith('gl_')) return false
  if (name.includes('__')) return false
  return true
}

/**
 * Returns `name` if it is a safe GLSL identifier, otherwise throws. Use at the
 * point a name is about to be emitted into shader source.
 */
export function assertGlslIdentifier(name: string, context: string): string {
  if (!isValidGlslIdentifier(name)) {
    throw new Error(
      `[st-shader-core] ${context}: "${String(name)}" is not a valid GLSL identifier. ` +
      `Only letters, digits and single underscores are allowed (must start with a letter or underscore, ` +
      `may not start with "gl_" or contain "__"). This guards against GLSL injection.`,
    )
  }
  return name
}
