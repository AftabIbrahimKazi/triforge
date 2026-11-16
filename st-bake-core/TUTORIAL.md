# st-bake-core Tutorial

Bakes light into textures ahead of time. You give it meshes, a sun and a sky; it gives back one lightmap texture per mesh. The result is the light leaving each surface (sun + sky + one bounce off other surfaces), so you can show it with a cheap unlit material.

Be honest about what it is for: it wins in **enclosed static interiors** (error vs a path-traced reference dropped from 39 to 3.5). Outdoors it gives no real gain (3.4 vs 4.1). Nothing in the scene may move after baking.

---

## Quick Start

```javascript
import { LightBaker } from '@triforge/bake-core'
import { MeshBasicMaterial } from 'three'

// Every mesh needs a second UV set called "uv1" where nothing overlaps.
const baker = new LightBaker([floor, wall], {
  sun: { direction: [-1, 1, 0], color: [1, 1, 1], intensity: 3 }, // direction points from the surface towards the sun
  sky: (direction) => [0.3, 0.45, 0.7],                            // colour of the sky in any direction
  texelsPerMeter: 4,
})

const lightmaps = baker.bake() // Map<Mesh, DataTexture>

for (const [mesh, texture] of lightmaps) {
  mesh.geometry.setAttribute('uv', mesh.geometry.getAttribute('uv1'))
  mesh.material = new MeshBasicMaterial({ map: texture })
}
```

The input meshes are never changed. The baker reads their world transform, so move and rotate them first, then bake.

---

## Options

| Option | Default | What it does |
|---|---|---|
| `sun` | required | `{ direction, color, intensity }`. Direction is normalised for you. |
| `sky` | required | `(direction) => [r, g, b]`. Called for rays that escape the scene. |
| `texelsPerMeter` | required | Lightmap detail. Texture size is worked out from surface area. |
| `samples` | 64 | Bounce rays per texel. More is smoother and slower. |
| `maxTexels` | 1024 | Largest texture edge (1 to 8192). |
| `seed` | 1337 | Same seed + same scene = identical output. |
| `albedo` | material colour | `(mesh) => [r, g, b]` surface colour if you do not want the material's. |
| `createIntersector` | built-in | Swap the ray caster (see below). |

All the number options live on `baker.parameters` (`texelsPerMeter`, `samples`, `maxTexels`, `seed`, `sunIntensity`), so you can change or animate them before the next `bake()`. Sun direction and colour are `baker.sunDirection` and `baker.sunColor`; the sky is `baker.sky`.

---

## Getting good UVs

The baker uses your `uv1` exactly as given, so the quality of the lightmap depends on it:

- Give each face a UV rectangle proportional to its world size, so every face gets the same number of texels per metre. `examples/bake/box-atlas.js` shows a small packer for boxes.
- A face thinner than one texel (a 0.2 m wall edge at 4 texels/m) gets almost no data. Raise `texelsPerMeter` if those edges matter.
- On the example room, baked face centres match the hand-written analytic baker within a mean of 0.014 radiance for faces wider than 0.5 m.

---

## Rooms (BackSide meshes)

A mesh whose material uses `side: BackSide` (the usual way to make a room from a box) is lit on its inside. Meshes with normals are lit on the side the normals point to.

---

## Keep the page responsive

```javascript
const lightmaps = await baker.bakeAsync((p) => {
  progress.value = p.rowsDone / p.rowsTotal   // per mesh
})
```

A 60 m outdoor scene at 4 texels/m took about 4 s on the CPU. Run it once at load, or in a worker.

---

## Faster rays for big meshes (optional)

The built-in ray caster needs no dependencies. For large meshes you can opt in to `three-mesh-bvh`. It is never imported for you:

```javascript
import { MeshBVH } from 'three-mesh-bvh'
import { LightBaker, meshBVHIntersector } from '@triforge/bake-core'

new LightBaker(meshes, { sun, sky, texelsPerMeter: 4, createIntersector: meshBVHIntersector(MeshBVH) })
```

On the small benchmark scene (60 triangles) the built-in caster is faster; three-mesh-bvh is for much bigger meshes. See `bench/results-*.md`.

---

## When it throws

- `no uv1 (lightmap UV) attribute` — add a second, non-overlapping UV set (`uv2` is also accepted).
- `no usable lightmap UV area` — every triangle of that mesh has zero UV area.
- `RangeError` — a number option is not finite or out of range, or your `sky` function returned `NaN`.
