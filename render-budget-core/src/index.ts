export type {
  HardwareProfile,
  NetworkProfile,
  RenderBudgetPlan,
  RenderBudgetOverride,
  TextureVariantTier,
  ShaderComplexityTier,
  HardwareProbeEnv,
  NetworkProbeEnv,
  BudgetStorage,
} from './core/types.js'

export {
  profileHardware,
  profileNetwork,
  createBrowserHardwareEnv,
  createBrowserNetworkEnv,
} from './core/DeviceProfiler.js'

export { planBudget } from './core/BudgetPlanner.js'

export {
  init as initRenderBudget,
  getUserOverride,
  setUserOverride,
  clearUserOverride,
} from './core/RenderBudgetSystem.js'
export type { RenderBudgetSystemConfig } from './core/RenderBudgetSystem.js'
