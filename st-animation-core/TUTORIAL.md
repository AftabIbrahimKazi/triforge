# st-animation-core Tutorial

Shape keys (morph targets), armature/bones with FK + 2-bone IK, CPU skinning, and NLA layered animation.
Drives Three.js meshes. Integrates with `st-keyframe` for timeline animation of all parameters.

---

## Quick Start — Shape Keys

```typescript
import { ShapeKeyMesh, shapeKeyFromGeometry, shapeKeyFromDeltas } from '@st-animation-core'
import * as THREE from 'three'

const geo  = new THREE.SphereGeometry(1, 32, 32)
const mat  = new THREE.MeshStandardMaterial({ color: 0x3366ff })
const mesh = new ShapeKeyMesh(geo, mat)

// Add a shape key from a posed geometry
mesh.addShapeKey(shapeKeyFromGeometry('puff', puffedGeo))

// Or from deltas (offset from basis)
const deltas = new Float32Array(geo.getAttribute('position').count * 3)
// ... fill deltas with per-vertex offsets ...
mesh.addShapeKey(shapeKeyFromDeltas('smile', geo, deltas))

// Animate with st-keyframe
import { KeyframeTrack, AnimationClip, AnimationMixer, easeInOutSine } from '@st-keyframe'
const mixer = new AnimationMixer()
mixer.play(new AnimationClip('face', [
  new KeyframeTrack(mesh.parameters, 'smile', [
    { time: 0, value: 0, easing: easeInOutSine },
    { time: 1, value: 1 },
  ]),
]), { wrapMode: 'loop' })

// Render loop:
mixer.update(clock.getDelta())
mesh.update()   // MUST call after parameters change
```

---

## Shape Key API

```typescript
mesh.parameters.smile = 0.8   // set influence directly
mesh.parameters.blink = 1.0

mesh.update()    // blend all keys → write to geometry

// Read-only sampling (does not modify geometry)
const positions = mesh.sample({ smile: 0.5, blink: 1 })

// Manage keys
mesh.addShapeKey({ name: 'frown', positions: new Float32Array([...]) })
mesh.removeShapeKey('frown')
console.log(mesh.shapeKeys)     // readonly array
```

`"Basis"` is reserved — adding a Basis key replaces the rest-pose vertex positions.

---

## Armature — Forward Kinematics

```typescript
import { Armature, type BoneDefinition } from '@st-animation-core'

const bones: BoneDefinition[] = [
  { name: 'hips',  head: new THREE.Vector3(0, 0, 0), tail: new THREE.Vector3(0, 1, 0) },
  { name: 'spine', head: new THREE.Vector3(0, 1, 0), tail: new THREE.Vector3(0, 2, 0), parent: 'hips' },
  { name: 'armL',  head: new THREE.Vector3(0, 1.8, 0), tail: new THREE.Vector3(-1, 1.4, 0), parent: 'spine' },
]

const arm = new Armature(bones)

// Pose bones — all channels are plain numbers (st-keyframe compatible)
arm.pose.armL.parameters.rotationZ = Math.PI / 4   // 45° rotation

// Animate with st-keyframe
new KeyframeTrack(arm.pose.armL.parameters, 'rotationX', [...])

// Recompute world matrices — call every frame after changing parameters
arm.update()

// Read world positions / matrices
const pos   = arm.getBoneWorldPosition('armL')
const quat  = arm.getBoneWorldQuaternion('armL')
const mats  = arm.getBoneMatrices()   // one Matrix4 per bone (for GPU skinning)
```

### 2-Bone Analytical IK

```typescript
// Solve upper_arm + forearm to reach a target point
const target = new THREE.Vector3(2, 0, 0)
arm.solveIK2Bone('upper_arm', 'forearm', target, poleAngle = 0)
arm.update()   // recompute world matrices after IK
```

---

## CPU Skinning

```typescript
import { SkinBinding, computeEnvelopeWeights } from '@st-animation-core'

// Automatic nearest-bone weights (one bone per vertex)
const weights = computeEnvelopeWeights(geometry, armature)

// Or supply manual weights
const weights: SkinWeight[][] = [
  [{ bone: 'hips', weight: 0.7 }, { bone: 'spine', weight: 0.3 }],  // vertex 0
  [{ bone: 'spine', weight: 1.0 }],                                   // vertex 1
  // ...
]

const skin = new SkinBinding(armature, geometry, weights)

// Render loop — call after armature.update()
armature.update()
skin.apply()    // transforms geometry positions + normals
```

For > 2k vertices, prefer `THREE.SkinnedMesh` (GPU skinning) with `armature.getBoneMatrices()`.

---

## NLA — Non-Linear Animation

Layer multiple animation clips with independent timing and blending.

```typescript
import { NLATrack, NLAEditor } from '@st-animation-core'
// Clips are any { duration: number, evaluate(t): void }
// — including AnimationClip from st-keyframe

const walkClip  = new AnimationClip('walk', walkTracks)
const waveClip  = new AnimationClip('wave', waveTracks)

const trackBody = new NLATrack('body', [
  { name: 'Walk', clip: walkClip, start: 0, end: 10,  influence: 1, repeat: true,  extrapolation: 'hold' },
])
const trackArm  = new NLATrack('arm', [
  { name: 'Wave', clip: waveClip, start: 3, end: 6,   influence: 1, repeat: false, extrapolation: 'nothing' },
])

const nla = new NLAEditor()
nla.addTrack(trackBody)
nla.addTrack(trackArm)  // evaluated on top

// Render loop:
nla.update(clock.getDelta())  // advances nla.time, evaluates all strips
```

### NLA strip options

| Option | Values | Blender equivalent |
|---|---|---|
| `influence` | 0–1 | Strip influence slider |
| `repeat` | true/false | Strip repeats (loops clip within strip time range) |
| `extrapolation` | `'nothing'` / `'hold'` | Nothing = strip inactive outside range; Hold = clamp to endpoints |

### Muting and timing

```typescript
trackArm.muted = true     // disable without removing
nla.timeScale  = 0.5      // half speed
nla.playing    = false     // pause
nla.time       = 0        // seek to start
```

---

## Ecosystem Integration

```
st-keyframe → st-animation-core
  KeyframeTrack(bone.parameters, 'rotationX', [...])
  KeyframeTrack(mesh.parameters, 'smile', [...])
  NLAStrip.clip = AnimationClip (from st-keyframe)
```

```typescript
// Full pipeline: keyframe → armature → CPU skinning → render
const mixer = new AnimationMixer()
mixer.play(new AnimationClip('walk', [
  new KeyframeTrack(arm.pose.legL.parameters, 'rotationX', legKeyframes),
  new KeyframeTrack(arm.pose.legR.parameters, 'rotationX', legKeyframes.map(k => ({ ...k, time: k.time + 0.5 }))),
]))

function animate() {
  requestAnimationFrame(animate)
  mixer.update(clock.getDelta())
  arm.update()
  skin.apply()
  renderer.render(scene, camera)
}
```

---

## Example File

Open [`examples/example-animation-core.html`](../examples/example-animation-core.html) in a browser.
- **Shape Keys**: sphere morphs between puff / spike / flatten via sine-wave drivers
- **Armature**: stick figure walks with FK bone rotation on arms, legs, spine
- **NLA**: two overlapping NLA strips drive puff + flatten shape keys with independent timing
