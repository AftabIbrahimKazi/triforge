# scene-doctor-core — Tutorial

A dev-only helper that finds bugs in your 3D scene with plain scripts (no AI, no tokens),
lets you tweak the scene with sliders, then hands an AI one tiny report so it only does the
final fix. It never ships to production.

## 1. Find bugs in a live scene

```typescript
import { SceneDoctor } from '@triforge/scene-doctor-core'
import { defaultRules, ShaderErrorCollector } from '@triforge/scene-doctor-core/three'

const shaderErrors = new ShaderErrorCollector()
shaderErrors.attach(renderer)

const doctor = new SceneDoctor({ rules: defaultRules })
const findings = doctor.run({ scene, renderer, shaderErrors: shaderErrors.list() })
console.log(doctor.report(findings, { maxTokens: 400 }))
```

Output (one line per bug, worst first, repeats collapsed into `x3`):

```
# scene-doctor 1E 1W 0I
E non-finite-geometry Scene/Blob: 12 NaN/Infinity values in position attribute | a modifier, node or custom math produced a non-finite vertex
W zero-scale Scene/Cube: visible object has a zero scale axis and renders nothing | ...
```

Checked for you: NaN/Infinity geometry and transforms, zero scale, textures with no image,
shader compile errors, draw-call and triangle budgets, resource leaks (`ResourceTracker`),
black or flat frames (`readFrameSample`).

## 2. Lint your source and console

```bash
npx scene-doctor scan ./src --tokens 600
npx scene-doctor strip-check ./dist     # fails if dev code reached your production build
```

It flags `any`, `@ts-ignore`, `eval`, `console.log`, unbounded loops (including in GLSL), math
objects created inside `animate()`, and renderers/render targets never disposed.

Console and network errors come from a headless browser you pass in (no hidden dependency):

```typescript
import { chromium } from 'playwright-core'
import { scanPages } from '@triforge/scene-doctor-core/node'

const raw = await scanPages(chromium, ['http://localhost:5173/?scene=1'])
```

## 3. Tweak with sliders, export for the AI

```typescript
import { EditSession } from '@triforge/scene-doctor-core'
import { registerSceneObjects } from '@triforge/scene-doctor-core/three'
import { DevPanel, isDoctorEnabled } from '@triforge/scene-doctor-core/panel'

if (isDoctorEnabled(location.search)) {          // only with ?doctor=1
  const session = new EditSession()
  registerSceneObjects(session, scene)            // positions, scales, lights, material fields
  session.register('Noise', noiseNode)            // any object with a `parameters` object
  const panel = new DevPanel({ session, doctor, getContext: () => ({ scene, renderer }), document,
    onExport: (json) => navigator.clipboard.writeText(json) })
  panel.init()
  panel.expose(window)                            // window.__sceneDoctor for AI or Playwright
}
```

Click **Export** and paste the result to any AI. It contains only the capped report and the
net slider changes (`id`, old value `f`, new value `t`), nothing else.

## 4. Keep token cost low

- `maxTokens` caps the report; overflow becomes one `+N more omitted` line.
- `{ delta: true }` returns only findings that are new or changed since the last report.
- `format: 'compact'` (default) is the smallest; `'json'` and `'md'` carry the same data.

## 5. Optional local-model help

```typescript
import { askAdapter } from '@triforge/scene-doctor-core'
const adapter = { name: 'local', complete: (prompt) => myLocalModel(prompt) }
const reply = await askAdapter(adapter, report, 'Which finding is the root cause?', 1500)
```

No adapter is built in. Use a local model or a Kaggle endpoint, or skip it entirely.

## Keeping it out of production

The panel only exists when you create it. `scene-doctor strip-check <build-dir>` exits 1 if the
dev marker string appears in your build output, so wire it into CI.
