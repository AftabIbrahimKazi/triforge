import { DEV_MARKER } from '../core/marker.js'
import { bundleToJson, bundleToMarkdown, buildExport } from '../core/exportBundle.js'
import type { EditSession } from '../core/EditSession.js'
import type { SceneDoctor } from '../core/SceneDoctor.js'
import type { ReportOptions } from '../core/types.js'
import type { DevPanelApi, DocumentLike, ElementLike } from './types.js'

export { DEV_MARKER }
const ENABLE_PARAM = 'doctor'
const ENABLE_VALUE = '1'
const PANEL_STYLE =
  'position:fixed;top:8px;right:8px;width:280px;max-height:90vh;overflow:auto;padding:8px;' +
  'background:#111c;color:#eee;font:12px monospace;z-index:2147483647'
const GLOBAL_NAME = '__sceneDoctor'

export function isDoctorEnabled(search: string): boolean {
  return new URLSearchParams(search).get(ENABLE_PARAM) === ENABLE_VALUE
}

export interface DevPanelConfig<TContext> {
  session: EditSession
  doctor: SceneDoctor<TContext>
  getContext: () => TContext
  document: DocumentLike
  report?: ReportOptions
  onExport?: (text: string) => void
}

interface Binding {
  element: ElementLike
  type: string
  handler: () => void
}

export class DevPanel<TContext> {
  private readonly config: DevPanelConfig<TContext>
  private readonly bindings: Binding[] = []
  private root: ElementLike | null = null
  private readout: ElementLike | null = null

  constructor(config: DevPanelConfig<TContext>) {
    this.config = config
  }

  public init(): void {
    const { document, session } = this.config
    const root = document.createElement('div')
    root.style.cssText = PANEL_STYLE
    this.readout = document.createElement('pre')
    root.append(this.button('Scan', () => this.refresh()))
    root.append(this.button('Reset', () => this.onReset()))
    root.append(this.button('Export', () => this.onExport()))
    root.append(this.readout)
    for (const descriptor of session.list()) root.append(this.control(descriptor))
    document.body.append(root)
    this.root = root
    this.refresh()
  }

  public api(): DevPanelApi {
    const { session } = this.config
    return {
      list: () => session.list().map((d) => ({ id: d.id, value: d.value })),
      set: (id, value) => session.set(id, value),
      edits: () => session.edits(),
      driven: () => session.driven(),
      scan: () => this.scan(),
      export: (format = 'json') => this.exportText(format),
      reset: () => session.reset(),
    }
  }

  public expose(target: object): void {
    ;(target as Record<string, unknown>)[GLOBAL_NAME] = this.api() // dev-only global so an AI or Playwright can drive the scene
  }

  public destroy(): void {
    for (const { element, type, handler } of this.bindings) element.removeEventListener(type, handler)
    this.bindings.length = 0
    this.root?.remove()
    this.root = null
    this.readout = null
  }

  private scan(): string {
    const { doctor, getContext, report } = this.config
    return doctor.report(doctor.run(getContext()), report)
  }

  private refresh(): void {
    if (this.readout) this.readout.textContent = this.scan()
  }

  private exportText(format: 'json' | 'md'): string {
    const bundle = buildExport(this.config.session, this.scan())
    return format === 'md' ? bundleToMarkdown(bundle) : bundleToJson(bundle)
  }

  private onExport(): void {
    this.config.onExport?.(this.exportText('json'))
  }

  private onReset(): void {
    this.config.session.reset()
    this.refresh()
  }

  private button(label: string, handler: () => void): ElementLike {
    const element = this.config.document.createElement('button')
    element.textContent = label
    this.bind(element, 'click', handler)
    return element
  }

  private control(descriptor: ReturnType<EditSession['list']>[number]): ElementLike {
    const { document, session } = this.config
    const row = document.createElement('div')
    const label = document.createElement('label')
    label.textContent = descriptor.id
    const input = document.createElement('input')
    const isBoolean = typeof descriptor.value === 'boolean'
    input.type = isBoolean ? 'checkbox' : 'range'
    if (isBoolean) {
      input.checked = descriptor.value as boolean // narrowed by the typeof check above
    } else {
      input.min = String(descriptor.min)
      input.max = String(descriptor.max)
      input.step = String(descriptor.step)
      input.value = String(descriptor.value)
    }
    this.bind(input, isBoolean ? 'change' : 'input', () => {
      session.set(descriptor.id, isBoolean ? input.checked : Number(input.value))
      this.refresh()
    })
    row.append(label, input)
    return row
  }

  private bind(element: ElementLike, type: string, handler: () => void): void {
    element.addEventListener(type, handler)
    this.bindings.push({ element, type, handler })
  }
}
