# st-pathtracer-core — Tutorial

## Offline mode: a clean path-traced image, no raster preview

Normally the path tracer shows a quick raster picture first, waits 100 ms, then fades the real
path-traced image in over half a second. That is nice to watch, but wrong when you want to save a
picture or run a test: the first frames are not path-traced at all.

Turn on `offlineMode` and the tracer skips all of that. Every frame is pure path tracing.

```ts
import { PathTracerRenderer } from '@triforge/pathtracer-core'

const tracer = new PathTracerRenderer(renderer, { maxSamples: 256, offlineMode: true })
await tracer.setScene(scene, camera)

function frame() {
  const samples = tracer.render()          // 0 while the shader is compiling
  if (samples < 256) requestAnimationFrame(frame)
}
frame()
```

- `offlineMode` is off by default, so existing code behaves exactly as before.
- The path-tracing shader can take a while to compile (tens of seconds on some machines). Until it
  is done `render()` returns `0` and draws nothing. Check `tracer.compiling` and `tracer.ready`.
- `render()` returns the samples gathered so far. Stop when it reaches `maxSamples`.
- The camera is only reset when it actually moves, so samples keep adding up while it stays still.
- Prefer a headless-capable browser for automated captures; see `examples/pathtracer/example-pathtracer-offline.html`.

Need the setting on a different tracer object? `applyOfflineMode(target)` sets the same four
properties (`renderDelay`, `minSamples`, `fadeDuration`, `rasterizeScene`) on anything that has them.
