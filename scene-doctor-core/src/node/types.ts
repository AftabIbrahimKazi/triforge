export interface SourceFile {
  path: string
  text: string
}

export interface ScanContext {
  files: SourceFile[]
}

export interface ConsoleMessageLike {
  type(): string
  text(): string
}

export interface RequestLike {
  url(): string
  failure(): { errorText: string } | null
}

export interface ResponseLike {
  status(): number
  url(): string
}

export interface PageLike {
  on(event: 'console', handler: (message: ConsoleMessageLike) => void): unknown
  on(event: 'pageerror', handler: (error: Error) => void): unknown
  on(event: 'requestfailed', handler: (request: RequestLike) => void): unknown
  on(event: 'response', handler: (response: ResponseLike) => void): unknown
  goto(url: string): Promise<unknown>
  waitForTimeout(ms: number): Promise<void>
}

export interface BrowserLike {
  newPage(): Promise<PageLike>
  close(): Promise<void>
}

export interface BrowserLauncher {
  launch(): Promise<BrowserLike>
}

export interface PageScanOptions {
  settleMs?: number
}
