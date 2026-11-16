import { FindingCollector } from './FindingCollector.js'
import { Reporter } from './Reporter.js'
import type { Finding, ReportFormat, ReportOptions, Rule, SceneDoctorConfig } from './types.js'

export class SceneDoctor<TContext> {
  private readonly rules: Array<Rule<TContext>>
  private readonly collector = new FindingCollector()
  private readonly reporter = new Reporter()

  constructor(config: SceneDoctorConfig<TContext>) {
    this.rules = [...config.rules]
  }

  public run(context: TContext): Finding[] {
    this.collector.clear()
    const emit = this.collector.add.bind(this.collector)
    for (const rule of this.rules) rule.check(context, emit)
    return this.collector.list()
  }

  public report(findings: Finding[], options: ReportOptions = {}): string {
    const format: ReportFormat = options.format ?? 'compact'
    const text = this.reporter.render(this.reporter.build(findings, options), format)
    if (options.delta) this.reporter.commit(findings)
    return text
  }

  public destroy(): void {
    this.collector.clear()
    this.reporter.commit([])
  }
}
