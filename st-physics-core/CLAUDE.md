# st-physics-core — Claude Code Guide

Blender-matched cloth simulation using Verlet integration.

## Package Structure

```
src/
  collision/
    BaseCollider.ts        — abstract base with enabled flag + resolve()
    PlaneCollider.ts       — infinite plane (point + normal)
    SphereCollider.ts      — sphere push-out
    CapsuleCollider.ts     — segment closest-point + hemisphere caps
  forces/
    WindForce.ts           — directional wind with value-noise turbulence
  cloth/
    ClothSimulator.ts      — main simulator (Verlet + spring constraints)
  index.ts                 — public exports
```

## Key Design Decisions

- Springs are packed as `Float64Array` in groups of 4: `[i_base, j_base, restLen, isBend]`. Using base indices (× 3) avoids repeated multiplication in the hot constraint loop.
- Rest lengths are 0 at build time and filled in after `setFromGeometry()` / `setFromArray()`. Call `_rebuildRestLengths()` whenever positions change externally.
- `parameters` is a plain object on both `ClothSimulator` and `WindForce` — GSAP/st-keyframe compatible.
- No cross-package imports. Accepts `BufferGeometry` as input/output; uses Three.js primitives only.

## Adding a New Collider

1. Extend `BaseCollider` in `src/collision/`
2. Add a `parameters` plain object with all scalar inputs
3. Implement `resolve(px, py, pz): [number,number,number] | null`
4. Export from `src/index.ts`
5. Add tests and update TUTORIAL.md

## Running

```bash
npm run build   # tsc
npm test        # node test/run-tests.js
npm run bench   # node bench/run-bench.js
```
