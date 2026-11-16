import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { SourceFile } from './types.js'

const DEFAULT_EXTENSIONS = ['.ts', '.js', '.mjs', '.html']
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', 'bench'])

export async function readSourceFiles(
  root: string,
  extensions: string[] = DEFAULT_EXTENSIONS,
): Promise<SourceFile[]> {
  const files: SourceFile[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...(await readSourceFiles(full, extensions)))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push({ path: full, text: await readFile(full, 'utf8') })
    }
  }
  return files
}
