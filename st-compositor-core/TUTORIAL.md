# @st-compositor-core — Tutorial

Post-processing node graph for Three.js, modelled after Blender's Compositor.
Dual-backend: Three.js built-in (default, zero extra installs) or pmndrs/postprocessing (opt-in).

---

## Quick Start

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/",
    "@st-compositor-core": "./st-compositor-core/src/index.js"
  }
}
</script>
<script type="module">
import { WebGLRenderer, Scene, PerspectiveCamera } from 'three'
import { CompositorOutput, Bloom, ChromaticAberration, Vignette } from '@st-compositor-core'

const renderer = new WebGLRenderer()
const scene    = new Scene()
const camera   = new PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100)

const comp = new CompositorOutput({ renderer, scene, camera })
comp.add(new Bloom({ strength: 1.2, threshold: 0.8, radius: 0.4 }))
    .add(new ChromaticAberration({ offset: 0.003 }))
    .add(new Vignette({ darkness: 0.5 }))

await comp.compile()

// Replace renderer.render(scene, camera) in your loop:
function animate() {
  requestAnimationFrame(animate)
  comp.render()
}
animate()

// On window resize:
window.addEventListener('resize', () => comp.setSize(innerWidth, innerHeight))
</script>
```

---

## Choosing a Backend

### Three.js (default)

No extra install needed. Uses `three/addons` EffectComposer.

```js
const comp = new CompositorOutput({ renderer, scene, camera })
// backend defaults to 'three'
```

### pmndrs/postprocessing (opt-in)

Better performance for many effects — merges all effects into a single EffectPass.

```bash
npm install postprocessing
```

```js
const comp = new CompositorOutput({ backend: 'pmndrs', renderer, scene, camera })
```

The API is identical regardless of backend. The same pass objects work with both.

---

## API

### `CompositorOutput`

| Method | Description |
|---|---|
| `new CompositorOutput({ renderer, scene, camera, backend? })` | Create compositor. `backend` is `'three'` (default) or `'pmndrs'`. |
| `.add(pass)` | Add a pass. Chainable. Resets compiled state. |
| `.remove(pass)` | Remove a pass. Chainable. Resets compiled state. |
| `.compile()` | Build the EffectComposer. Must be awaited before first render. |
| `.render()` | Render one frame. Replaces `renderer.render(scene, camera)`. |
| `.setSize(w, h)` | Call on window resize. |
| `.dispose()` | Free GPU resources. |
| `.passes` | Read-only array of registered passes. |
| `.isCompiled` | Whether compile() has been called successfully. |

### `BasePass` (all passes share these)

| Property | Description |
|---|---|
| `parameters` | Plain object of all scalar inputs. Safe to animate with GSAP / st-keyframe. |
| `enabled` | Set `false` to skip this pass without removing it. |
| `passType` | String identifier, e.g. `'Bloom'`. |

---

## Pass Reference

| Pass | Blender equivalent | Key parameters |
|---|---|---|
| `Bloom` | Glare node (Bloom) | `threshold`, `strength`, `radius` |
| `DepthOfField` | Defocus node | `focus`, `aperture`, `maxblur` |
| `Blur` | Blur node | `radius` |
| `ChromaticAberration` | Lens Distortion → Dispersion | `offset`, `radialModulation` |
| `Vignette` | Lens Distortion → Vignette | `darkness`, `offset` |
| `FilmGrain` | Film node | `intensity`, `greyscale` |
| `ColorBalance` | Color Balance node | `lift`, `gamma`, `gain` (RGB Vec3 each) |
| `HueSaturation` | Hue/Saturation node | `hue`, `saturation`, `value` |
| `BrightnessContrast` | Bright/Contrast node | `brightness`, `contrast` |
| `Gamma` | Gamma node | `gamma` |
| `Exposure` | Exposure node | `exposure` (EV stops) |
| `Mix` | Mix node | `factor`, `mode` |
| `Pixelate` | Pixelate node | `pixelSize` |
| `Sharpen` | Filter → Sharpen | `strength` |

---

## Pass Examples

### Bloom
```js
import { Bloom } from '@st-compositor-core'

// Blender: Glare node, Bloom type
const bloom = new Bloom({ threshold: 0.8, strength: 1.5, radius: 0.4 })
comp.add(bloom)

// Animate at runtime (no recompile needed)
bloom.parameters.strength = 2.0
```

### Depth of Field
```js
import { DepthOfField } from '@st-compositor-core'

// Blender: Defocus node
comp.add(new DepthOfField({ focus: 10, aperture: 0.025, maxblur: 0.01 }))
```

### Chromatic Aberration
```js
import { ChromaticAberration } from '@st-compositor-core'

// Blender: Lens Distortion → Dispersion
comp.add(new ChromaticAberration({ offset: 0.005, radialModulation: 0.5 }))
```

### Vignette
```js
import { Vignette } from '@st-compositor-core'

// Blender: Lens Distortion → Vignette
comp.add(new Vignette({ darkness: 0.5, offset: 1.0 }))
```

### Film Grain
```js
import { FilmGrain } from '@st-compositor-core'

// Blender: Film node
comp.add(new FilmGrain({ intensity: 0.35, greyscale: 0 }))
```

### Color Balance
```js
import { ColorBalance } from '@st-compositor-core'

// Blender: Color Balance node (Lift/Gamma/Gain mode)
comp.add(new ColorBalance({
  lift:  [0.0, 0.0, 0.05],  // [r, g, b]
  gamma: [1.0, 1.0, 1.0],
  gain:  [1.1, 1.0, 0.9],
}))
```

### Hue / Saturation
```js
import { HueSaturation } from '@st-compositor-core'

// Blender: Hue/Saturation node
comp.add(new HueSaturation({ hue: 0.0, saturation: 1.2, value: 1.0 }))
```

### Brightness / Contrast
```js
import { BrightnessContrast } from '@st-compositor-core'

// Blender: Bright/Contrast node
comp.add(new BrightnessContrast({ brightness: 0.1, contrast: 0.2 }))
```

### Gamma
```js
import { Gamma } from '@st-compositor-core'

// Blender: Gamma node
comp.add(new Gamma({ gamma: 2.2 }))
```

### Exposure
```js
import { Exposure } from '@st-compositor-core'

// Blender: Exposure node (value in EV stops — 0 = no change, 1 = double, -1 = half)
comp.add(new Exposure({ exposure: 0.5 }))
```

### Mix
```js
import { Mix } from '@st-compositor-core'

// Blender: Mix node
comp.add(new Mix({ factor: 0.5, mode: 'normal' }))
```

### Pixelate
```js
import { Pixelate } from '@st-compositor-core'

// Blender: Pixelate node
comp.add(new Pixelate({ pixelSize: 8 }))
```

### Sharpen
```js
import { Sharpen } from '@st-compositor-core'

// Blender: Filter → Sharpen
comp.add(new Sharpen({ strength: 0.3 }))
```

---

## Animating Parameters with GSAP

All `parameters` objects are plain numbers — safe to tween directly.
No recompile is needed when changing values at runtime.

```js
import gsap from 'gsap'

const bloom = new Bloom({ strength: 0 })
comp.add(bloom)
await comp.compile()

// Animate bloom in on a trigger
gsap.to(bloom.parameters, { strength: 2.0, duration: 1.0, ease: 'power2.out' })
```

---

## Disabling / Enabling Passes

```js
const grain = new FilmGrain({ intensity: 0.4 })
comp.add(grain)
await comp.compile()

// Toggle at runtime — no recompile needed
grain.enabled = false
grain.enabled = true
```

---

## Adding / Removing Passes After Compile

```js
const vignette = new Vignette({ darkness: 0.6 })

// Add later
comp.add(vignette)
await comp.compile()  // must recompile after structural changes

// Remove
comp.remove(vignette)
await comp.compile()
```

---

## Cleanup

```js
comp.dispose()
```

---

## Connecting with the Ecosystem

`st-compositor-core` sits at the end of the rendering pipeline.
It takes the final rendered frame and applies post-processing.

```
st-shader-core  ──►  THREE.Mesh  ──►  renderer.render()  ──►  comp.render()
st-modifier-core ──►  BufferGeometry ──► THREE.Mesh
st-particle-core ──►  Points / InstancedMesh
```

The compositor does not import from any other ecosystem package.
It only receives a `WebGLRenderer`, `Scene`, and `Camera`.
