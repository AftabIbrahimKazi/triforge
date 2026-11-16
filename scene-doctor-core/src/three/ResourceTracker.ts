import type { LeakSource, SceneRendererInfo } from './types.js'

const WINDOW = 30
const MIN_SAMPLES = 10
const MIN_GROWTH = 10

export class ResourceTracker implements LeakSource {
  private readonly geometries: number[] = []
  private readonly textures: number[] = []

  public sample(info: SceneRendererInfo): void {
    push(this.geometries, info.memory.geometries)
    push(this.textures, info.memory.textures)
  }

  public leaking(): string[] {
    const found: string[] = []
    if (isGrowing(this.geometries)) found.push('geometries')
    if (isGrowing(this.textures)) found.push('textures')
    return found
  }

  public destroy(): void {
    this.geometries.length = 0
    this.textures.length = 0
  }
}

function push(series: number[], value: number): void {
  series.push(value)
  if (series.length > WINDOW) series.shift()
}

function isGrowing(series: number[]): boolean {
  if (series.length < MIN_SAMPLES) return false
  for (let i = 1; i < series.length; i++) {
    if (series[i] < series[i - 1]) return false
  }
  return series[series.length - 1] - series[0] >= MIN_GROWTH
}
