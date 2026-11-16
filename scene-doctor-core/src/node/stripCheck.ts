import { DEV_MARKER } from '../core/marker.js'
import { readSourceFiles } from './scanDirectory.js'

const BUILD_EXTENSIONS = ['.js', '.mjs', '.cjs', '.html', '.css', '.map']

export async function findDevLeaks(buildDir: string, marker: string = DEV_MARKER): Promise<string[]> {
  const files = await readSourceFiles(buildDir, BUILD_EXTENSIONS)
  return files.filter((file) => file.text.includes(marker)).map((file) => file.path)
}
