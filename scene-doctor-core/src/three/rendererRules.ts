import { classifyFrame } from './frame.js'
import type { Rule } from '../core/types.js'
import type { ThreeSceneContext } from './types.js'

const DEFAULT_MAX_DRAW_CALLS = 500
const DEFAULT_MAX_TRIANGLES = 1_000_000
const RENDERER_PATH = 'renderer'

export const shaderCompileError: Rule<ThreeSceneContext> = {
  id: 'shader-compile-error',
  check(context, emit) {
    for (const message of context.shaderErrors ?? []) {
      emit({
        rule: 'shader-compile-error',
        severity: 'error',
        path: RENDERER_PATH,
        message,
        cause: 'GLSL failed to compile or link; the material renders as nothing or magenta',
      })
    }
  },
}

export const drawCallBudget: Rule<ThreeSceneContext> = {
  id: 'draw-call-budget',
  check(context, emit) {
    if (!context.renderer) return
    const { calls, triangles } = context.renderer.info.render
    const maxCalls = context.budgets?.maxDrawCalls ?? DEFAULT_MAX_DRAW_CALLS
    const maxTriangles = context.budgets?.maxTriangles ?? DEFAULT_MAX_TRIANGLES
    if (calls > maxCalls) {
      emit({
        rule: 'draw-call-budget',
        severity: 'warn',
        path: RENDERER_PATH,
        message: `${calls} draw calls exceeds budget ${maxCalls}`,
        cause: 'merge static meshes, use InstancedMesh, or share materials',
      })
    }
    if (triangles > maxTriangles) {
      emit({
        rule: 'triangle-budget',
        severity: 'warn',
        path: RENDERER_PATH,
        message: `${triangles} triangles exceeds budget ${maxTriangles}`,
        cause: 'reduce subdivision levels or add LOD',
      })
    }
  },
}

export const resourceLeak: Rule<ThreeSceneContext> = {
  id: 'resource-leak',
  check(context, emit) {
    for (const kind of context.leaks?.leaking() ?? []) {
      emit({
        rule: 'resource-leak',
        severity: 'warn',
        path: RENDERER_PATH,
        message: `${kind} count grows every frame and never drops`,
        cause: `objects are recreated without calling dispose() on old ${kind}`,
      })
    }
  },
}

export const emptyFrame: Rule<ThreeSceneContext> = {
  id: 'empty-frame',
  check(context, emit) {
    if (!context.frameSample) return
    const kind = classifyFrame(context.frameSample)
    if (kind === 'varied') return
    const black = kind === 'black'
    emit({
      rule: black ? 'black-frame' : 'uniform-frame',
      severity: black ? 'error' : 'warn',
      path: RENDERER_PATH,
      message: black ? 'sampled pixels are all black' : 'sampled pixels are one flat colour',
      cause: 'camera inside or facing away from content, no lights, failed shader, or render target not drawn to canvas',
    })
  },
}

export const rendererRules: Array<Rule<ThreeSceneContext>> = [
  shaderCompileError,
  drawCallBudget,
  resourceLeak,
  emptyFrame,
]
