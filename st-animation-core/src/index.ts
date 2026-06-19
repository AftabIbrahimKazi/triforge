// Shape Keys
export { type ShapeKey, shapeKeyFromGeometry, shapeKeyFromDeltas } from './shapekey/ShapeKey.js'
export { ShapeKeyMesh } from './shapekey/ShapeKeyMesh.js'

// Armature / Bones
export { PoseBone } from './armature/PoseBone.js'
export { Armature, type BoneDefinition } from './armature/Armature.js'
export { SkinBinding, computeEnvelopeWeights, type SkinWeight } from './armature/SkinBinding.js'
export { TrackToConstraint, CopyRotationConstraint, CopyLocationConstraint } from './armature/BoneConstraints.js'
export type { BoneConstraint } from './armature/BoneConstraints.js'

// NLA
export { type NLAStrip } from './nla/NLAStrip.js'
export { NLATrack } from './nla/NLATrack.js'
export { NLAEditor } from './nla/NLAEditor.js'

// Drivers
export { ExpressionDriver } from './driver/ExpressionDriver.js'
export type { ExpressionDriverOptions } from './driver/ExpressionDriver.js'
