// Core
export { GeometryNode, OutputRef, evaluateGraph } from './core/GeometryNode.js'
export type { SocketValue, RawInputs, Inputs } from './core/GeometryNode.js'

// Primitives — Blender: Add > Mesh > …
export { Grid }     from './nodes/primitives/Grid.js'
export { UVSphere } from './nodes/primitives/UVSphere.js'
export { IcoSphere } from './nodes/primitives/IcoSphere.js'
export { Cylinder } from './nodes/primitives/Cylinder.js'
export { Cone }     from './nodes/primitives/Cone.js'
export { Cube }     from './nodes/primitives/Cube.js'
export { Circle }   from './nodes/primitives/Circle.js'

// Geometry Operations
export { TransformGeometry }  from './nodes/geometry/TransformGeometry.js'
export { JoinGeometry, mergeGeometries } from './nodes/geometry/JoinGeometry.js'
export { SetPosition }        from './nodes/geometry/SetPosition.js'
export { SubdivisionSurface } from './nodes/geometry/SubdivisionSurface.js'
export { MergeByDistance }    from './nodes/geometry/MergeByDistance.js'
export { FlipFaces }          from './nodes/geometry/FlipFaces.js'

// Geometry utilities
export { BoundingBox }   from './nodes/geometry/BoundingBox.js'
export { ConvexHull }    from './nodes/geometry/ConvexHull.js'
export { ExtrudeMesh }   from './nodes/geometry/ExtrudeMesh.js'

// Instances
export { DistributePointsOnFaces } from './nodes/instances/DistributePointsOnFaces.js'
export { InstanceOnPoints }        from './nodes/instances/InstanceOnPoints.js'
export { RealizeInstances }        from './nodes/instances/RealizeInstances.js'

// Utility nodes
export { Switch }           from './nodes/utility/Switch.js'
export { Index }            from './nodes/utility/Index.js'
export { GeometryLiteral }  from './nodes/utility/GeometryLiteral.js'
export { RepeatZone }       from './nodes/utility/RepeatZone.js'
export type { RepeatBody }  from './nodes/utility/RepeatZone.js'

// Instances (extended)
export { AlignRotationToVector } from './nodes/instances/AlignRotationToVector.js'

// Curve nodes — accepts any object with getPoint(t): Vector3
export { CurveToMesh }     from './nodes/curve/CurveToMesh.js'
export { ResampleCurve }   from './nodes/curve/ResampleCurve.js'
export { SetCurveRadius }  from './nodes/curve/SetCurveRadius.js'
