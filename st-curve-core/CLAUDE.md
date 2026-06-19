# st-curve-core — Claude Code Guide

CPU-side Bezier / NURBS / Catmull-Rom curves with geometry generation and path-follow.
Mirrors Blender's curve object: same curve types, same parameters.
Root CLAUDE.md rules always take precedence.

---

## Package Structure

```
src/
  core/
    BaseCurve.ts           — abstract base: getPoint, getTangent, getLength, arc-length LUT
    BezierCurve.ts         — cubic Bezier multi-segment + buildAutoHandles()
    NURBSCurve.ts          — NURBS with Cox-de Boor + buildOpenUniformKnots() + buildNURBSCircle()
    CatmullRomCurve.ts     — Catmull-Rom interpolating spline (closed or open)
  operations/
    CurveTube.ts           — extrude circle cross-section along curve → BufferGeometry
    CurveBevel.ts          — extrude arbitrary 2D profile along curve → BufferGeometry
    CurveLine.ts           — sample curve as line BufferGeometry (for THREE.Line)
    PathFollow.ts          — drives Object3D along a curve; parameters.offset for st-keyframe
  utils/
    frames.ts              — rotation-minimizing frames (RMF), frameToMatrix, frameToQuaternion
  index.ts
test/
  run-tests.js             — 49 tests, plain Node.js, imports from dist/
bench/
  run-bench.js
  results-YYYY-MM-DD.md
dist/
```

---

## Key Invariants

### getPoint(t) contract
- t ∈ [0,1]: 0 = start, 1 = end. Values outside this range are clamped.
- Always returns a NEW Vector3 (or writes into optional `target` param).
- Never mutates internal state.

### Arc-length parameterization
`buildArcLengthLUT()` + `getUtoTmapping(u, lut)` provide uniform arc-length spacing.
`getSpacedPoints(count)` uses this internally.
All geometry builders (CurveTube, CurveBevel) use arc-length spacing via `computeRMFrames`.

### Rotation-minimizing frames (RMF)
`computeRMFrames(curve, count)` returns CurveFrame[] using the Double Reflection Method.
- Avoids the twisting of Frenet frames at inflection points.
- PathFollow precomputes these in the constructor.
- Used by CurveTube and CurveBevel for cross-section orientation.

### NURBSCurve order clamping
`order` is automatically clamped to `min(order, n)` where n = point count.
A cubic NURBS (order 4) needs at least 4 control points.
This prevents silent degenerate output.

### No Three.js geometry mutation
CurveTube, CurveBevel, CurveLine always return NEW BufferGeometry.
Never mutate input geometry.

---

## Blender Mapping

| st-curve-core | Blender |
|---|---|
| `CatmullRomCurve` | Path / NURBS Path spline (Catmull-Rom interpolation) |
| `BezierCurve` | Bezier spline type |
| `NURBSCurve` | NURBS spline type |
| `buildAutoHandles()` | Bezier Auto handle type |
| `CurveTube` | Curve Geometry > Bevel > Round mode |
| `CurveBevel` | Curve Geometry > Bevel Object (2D profile curve) |
| `PathFollow` | Follow Path constraint / Curve modifier (Path mode) |
| `PathFollow.parameters.offset` | Follow Path > Offset Factor |
| `computeRMFrames` | Curve tilt + normal calculation |

---

## Adding a New Curve Type

1. Extend `BaseCurve` in `src/core/`
2. Implement `getPoint(t)` — the only required method
3. Override `getTangent(t)` if an analytic derivative is available (faster/smoother)
4. Expose all numeric parameters in a `parameters` object
5. Export from `src/index.ts`
6. Add tests; rebuild: `npm run build && npm test`
7. Update both TUTORIAL.md files

---

## Testing

```bash
cd st-curve-core
npm run build   # required: tests import from dist/
npm test        # 49 tests
```

---

## Performance Notes

- `getPoint` at 0.3–0.4 µs: suitable for per-frame path-follow
- `computeRMFrames(64)` at 62 µs: precomputed once in PathFollow constructor
- `CurveTube.apply(64×12)` at 140 µs: call once when curve changes, not per-frame
- NURBS `basisFunction` is recursive — memoization could speed up dense meshes
