export interface ElementLike {
  style: { cssText: string }
  textContent: string | null
  value: string
  checked: boolean
  type: string
  min: string
  max: string
  step: string
  append(...nodes: ElementLike[]): void
  addEventListener(type: string, handler: () => void): void
  removeEventListener(type: string, handler: () => void): void
  remove(): void
}

export interface DocumentLike {
  body: { append(node: ElementLike): void }
  createElement(tag: string): ElementLike
}

export interface DevPanelApi {
  list(): Array<{ id: string; value: number | boolean }>
  set(id: string, value: number | boolean): boolean
  edits(): Array<{ id: string; from: number | boolean; to: number | boolean }>
  scan(): string
  export(format?: 'json' | 'md'): string
  reset(): void
}
