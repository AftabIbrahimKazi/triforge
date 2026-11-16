import { rendererRules } from './rendererRules.js'
import { sceneRules } from './rules.js'
import type { Rule } from '../core/types.js'
import type { ThreeSceneContext } from './types.js'

export type {
  SceneVec3,
  SceneAttribute,
  SceneGeometry,
  SceneTexture,
  SceneMaterial,
  SceneNode,
  SceneGl,
  SceneRendererInfo,
  SceneRenderer,
  RenderBudgets,
  LeakSource,
  ThreeSceneContext,
} from './types.js'
export type { FrameGl } from './frame.js'
export { walkScene } from './traverse.js'
export {
  nonFiniteGeometry,
  nonFiniteTransform,
  zeroScale,
  unloadedTexture,
  oversizedTexture,
  oversizedShadowMap,
  sceneRules,
} from './rules.js'
export {
  shaderCompileError,
  drawCallBudget,
  resourceLeak,
  emptyFrame,
  rendererRules,
} from './rendererRules.js'
export { ShaderErrorCollector } from './ShaderErrorCollector.js'
export { ResourceTracker } from './ResourceTracker.js'
export { readFrameSample, classifyFrame } from './frame.js'

export const defaultRules: Array<Rule<ThreeSceneContext>> = [...sceneRules, ...rendererRules]
export { registerSceneObjects } from './registerScene.js'
