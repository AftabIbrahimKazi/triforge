# st-geometry-nodes — Claude Code Guide

Blender Geometry Nodes-style procedural geometry graph for Three.js.

## Package Structure

```
src/
  core/
    GeometryNode.ts        — base class, OutputRef, evaluateGraph()
  nodes/
    primitives/
      Grid.ts              — flat plane grid
      UVSphere.ts          — latitude/longitude sphere
      IcoSphere.ts         — subdivided icosahedron
      Cylinder.ts          — cylinder with optional caps
      Cone.ts              — cone (Cylinder with radiusTop=0)
      Cube.ts              — axis-aligned box
      Circle.ts            — n-gon ring or filled disk
    geometry/
      TransformGeometry.ts — TRS transform
      JoinGeometry.ts      — merge geometry list + mergeGeometries()
      SetPosition.ts       — vertex displacement by field or constant
      SubdivisionSurface.ts— midpoint subdivision (triangles)
      MergeByDistance.ts   — weld nearby vertices
      FlipFaces.ts         — reverse winding + negate normals
    instances/
      DistributePointsOnFaces.ts — scatter points on mesh surface
      InstanceOnPoints.ts        — place instances at each point
  index.ts
```

## Core Pattern

```typescript
const grid = new Grid({ vertsX: 10, vertsY: 10 })
const sub  = new SubdivisionSurface({ geometry: grid.output('Geometry'), level: 2 })
const geo  = sub.output('Geometry').evaluate()  // → THREE.BufferGeometry
```

`OutputRef.evaluate()` walks the graph backward, memoizes node results per call, and returns the resolved value.

## Key Design Decisions

- **Lazy graph** — nodes are pure descriptions until `.evaluate()` is called. No computation at construction time.
- **Memoization** — each `evaluate()` call uses a fresh `WeakMap` cache keyed by node identity. Shared nodes (used by multiple consumers) are evaluated exactly once.
- **Array inputs** — `JoinGeometry` passes `_inputs.geometries` as an array of `OutputRef | SocketValue`. The evaluator resolves arrays element-wise before calling `_evaluate`.
- **Field functions** — `SetPosition.offset` and `InstanceOnPoints.scale` accept `(index, count) => value` callbacks for per-vertex variation. Runtime type check (`typeof result === 'number'`) distinguishes FloatField from VectorField.
- **Non-destructive** — all nodes clone geometry before modifying. Inputs are never mutated.

## Adding a New Node

1. Extend `GeometryNode` in the appropriate folder
2. Declare `parameters` plain object with all scalar inputs
3. Store connected socket inputs as `this._inputs.socketName = value` in constructor
4. Implement `_evaluate(inputs)` returning `Record<string, SocketValue>`
5. Export from `src/index.ts`
6. Add tests and update TUTORIAL.md

## Running

```bash
npm run build   # tsc
npm test        # node test/run-tests.js
npm run bench   # node bench/run-bench.js
```
