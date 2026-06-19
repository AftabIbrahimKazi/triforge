# st-keyframe Tutorial

Keyframe animation driver for the Three.js ecosystem.
Drives any `parameters` plain object on any ecosystem class — modifiers, shader nodes, particles, UV unwrappers — without importing from them.

---

## Quick Start

```typescript
import { KeyframeTrack, AnimationClip, AnimationMixer, easeInOutSine } from '@st-keyframe'

// Any object with numeric properties works as a target
const bloom = { strength: 0 }

const track = new KeyframeTrack(bloom, 'strength', [
  { time: 0, value: 0, easing: easeInOutSine },
  { time: 2, value: 1, easing: easeInOutSine },
  { time: 4, value: 0 },
])

const clip  = new AnimationClip('bloom-pulse', [track])
const mixer = new AnimationMixer()
mixer.play(clip, { wrapMode: 'loop' })

// In render loop:
mixer.update(clock.getDelta())
// bloom.strength is now driven by the animation
postProcessor.bloomPass.strength = bloom.strength
```

---

## Driving Ecosystem Parameters

Every ecosystem class exposes a `parameters` object. Pass it directly as the track target:

```typescript
import { SubdivisionModifier, WarpModifier } from '@st-modifier-core'
import { KeyframeTrack, AnimationClip, AnimationMixer } from '@st-keyframe'

const subdiv = new SubdivisionModifier({ levels: 1 })
const warp   = new WarpModifier({ strength: 0 })

const clip = new AnimationClip('morph', [
  new KeyframeTrack(subdiv.parameters, 'levels',   [{ time:0,value:1 }, { time:3,value:3 }]),
  new KeyframeTrack(warp.parameters,   'strength', [{ time:0,value:0 }, { time:3,value:1 }]),
])

const mixer = new AnimationMixer()
mixer.play(clip)

// In render loop:
mixer.update(delta)
mesh.geometry = stack.apply()   // re-apply modifiers after parameter change
```

---

## Easing Functions

Match Blender's F-Curve interpolation modes:

| Import name | Blender alias | Description |
|---|---|---|
| `linear` | `LINEAR` | Constant rate of change |
| `constant` | `CONSTANT` | Step — jumps at the next keyframe |
| `easeInOutCubic` | `BEZIER` | Smooth S-curve (Blender default) |
| `easeInOutSine` | `SINE` | Gentle sinusoidal |
| `easeInOutExpo` | `EXPO` | Explosive acceleration |
| `easeInOutCirc` | `CIRC` | Circular |
| `easeOutBounce` | `BOUNCE` | Bouncy overshoot |
| `easeOutElastic` | `ELASTIC` | Springy overshoot |
| `easeOutBack` | `BACK` | Slight overshoot and settle |

```typescript
import { Easings } from '@st-keyframe'

// Look up by Blender name:
const fn = Easings['BEZIER']   // easeInOutCubic

// Or import directly:
import { easeInOutSine } from '@st-keyframe'
```

The easing on a keyframe applies **from that keyframe to the next one**:

```typescript
[
  { time: 0, value: 0, easing: easeInOutSine },  // easeInOutSine applied 0→2
  { time: 2, value: 1, easing: easeInBounce },   // easeInBounce applied 2→4
  { time: 4, value: 0 },                          // last keyframe, easing ignored
]
```

---

## AnimationClip — grouping tracks

An `AnimationClip` is a named group of tracks that share a timeline (Blender: Action).

```typescript
const clip = new AnimationClip('dissolve', [
  new KeyframeTrack(shader.parameters, 'opacity',    [...]),
  new KeyframeTrack(shader.parameters, 'roughness',  [...]),
  new KeyframeTrack(bloom,             'strength',   [...]),
])

// Duration = longest track
console.log(clip.duration)  // e.g. 4

// Evaluate all tracks at once
clip.evaluate(1.5)
```

---

## AnimationMixer — playback control

```typescript
const mixer = new AnimationMixer()

// Basic play (loops by default)
const action = mixer.play(clip, { wrapMode: 'loop' })

// One-shot: stops at end
const once = mixer.play(clip, { wrapMode: 'once' })

// Ping-pong: reverses at both ends
const pingpong = mixer.play(clip, { wrapMode: 'pingpong' })

// Speed control
action.timeScale = 0.5   // half speed
action.timeScale = 2     // double speed
action.timeScale = -1    // play in reverse

// Pause / resume
action.playing = false
action.playing = true

// Stop and remove
mixer.stop(action)
mixer.stopAll()

// Advance all active actions
mixer.update(clock.getDelta())
```

---

## buildClip — fluent multi-target helper

For animating many properties at once across multiple objects:

```typescript
import { buildClip, easeInOutSine } from '@st-keyframe'

const clip = buildClip('intro', [
  {
    time: 0,
    targets: [
      [bloom.parameters,    { strength: 0 }],
      [shader.parameters,   { opacity: 0, roughness: 1 }],
    ],
    easing: easeInOutSine,
  },
  {
    time: 2,
    targets: [
      [bloom.parameters,    { strength: 1 }],
      [shader.parameters,   { opacity: 1, roughness: 0.3 }],
    ],
    easing: easeInOutSine,
  },
  {
    time: 4,
    targets: [
      [bloom.parameters,    { strength: 0 }],
      [shader.parameters,   { opacity: 1, roughness: 0.3 }],
    ],
  },
])
```

Each step describes the state of all targets at that time. The easing on each step applies to the segment leading to the *next* step.

---

## KeyframeTrack.sample — read-only evaluation

```typescript
// Does not modify the target
const val = track.sample(2.5)
console.log(val)   // interpolated value at t=2.5
```

---

## Ecosystem Pipeline

```
st-modifier-core           st-shader-core          st-compositor-core
  modifier.parameters  ←──── st-keyframe ────→  compositor.parameters
  stack.apply()                                   compositor.render()
       ↓                                                 ↓
  BufferGeometry → THREE.Mesh → renderer → post-processing → screen
```

`st-keyframe` sits at the centre — it drives `parameters` objects from any package.
It has zero dependencies on any ecosystem package.

---

## Full Example

```typescript
import * as THREE from 'three'
import { KeyframeTrack, AnimationClip, AnimationMixer, easeInOutSine } from '@st-keyframe'
import { BloomPass, CompositorGraph } from '@st-compositor-core'

const bloom = new BloomPass({ strength: 0, radius: 0.4, threshold: 0.2 })
const graph = new CompositorGraph()
graph.add(bloom)

const mixer = new AnimationMixer()
mixer.play(new AnimationClip('pulse', [
  new KeyframeTrack(bloom.parameters, 'strength', [
    { time: 0, value: 0,   easing: easeInOutSine },
    { time: 1, value: 1.5, easing: easeInOutSine },
    { time: 2, value: 0 },
  ]),
]), { wrapMode: 'loop' })

// Render loop
function animate() {
  requestAnimationFrame(animate)
  mixer.update(clock.getDelta())   // drives bloom.parameters.strength
  graph.render(renderer, scene, camera)
}
animate()
```

---

## Example File

Open [`examples/example-keyframe-core.html`](../examples/example-keyframe-core.html) in a browser.
Animates rotation, scale, emissive intensity, and a simulated bloom parameter on a torus knot.
Switch easing modes and playback controls in the UI.
