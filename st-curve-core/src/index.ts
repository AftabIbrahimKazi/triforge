// Curve types
export { BaseCurve } from './core/BaseCurve.js'
export { BezierCurve, buildAutoHandles, buildAlignedHandles, buildVectorHandles, buildFreeHandles } from './core/BezierCurve.js'
export { NURBSCurve, buildOpenUniformKnots, buildNURBSCircle } from './core/NURBSCurve.js'
export { CatmullRomCurve } from './core/CatmullRomCurve.js'

// Operations
export { CurveTube, type CurveTubeOptions } from './operations/CurveTube.js'
export { CurveBevel, type CurveBevelOptions } from './operations/CurveBevel.js'
export { CurveLine, type CurveLineOptions } from './operations/CurveLine.js'
export { PathFollow } from './operations/PathFollow.js'

// Utils
export { computeRMFrames, frameToMatrix, frameToQuaternion, type CurveFrame } from './utils/frames.js'
