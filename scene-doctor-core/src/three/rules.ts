import { asMaterialList, countNonFinite, isFiniteVec, walkScene } from './traverse.js'
import type { Rule } from '../core/types.js'
import type { SceneTexture, ThreeSceneContext } from './types.js'

export const nonFiniteGeometry: Rule<ThreeSceneContext> = {
  id: 'non-finite-geometry',
  check(context, emit) {
    walkScene(context.scene, (node, path) => {
      const position = node.geometry?.attributes.position
      if (!position) return
      const bad = countNonFinite(position.array)
      if (bad === 0) return
      emit({
        rule: 'non-finite-geometry',
        severity: 'error',
        path,
        message: `${bad} NaN/Infinity values in position attribute`,
        cause: 'a modifier, node or custom math produced a non-finite vertex',
      })
    })
  },
}

export const nonFiniteTransform: Rule<ThreeSceneContext> = {
  id: 'non-finite-transform',
  check(context, emit) {
    walkScene(context.scene, (node, path) => {
      if (isFiniteVec(node.position) && isFiniteVec(node.scale)) return
      emit({
        rule: 'non-finite-transform',
        severity: 'error',
        path,
        message: 'position or scale contains NaN/Infinity',
        cause: 'an animation, driver or physics step wrote a non-finite value',
      })
    })
  },
}

export const zeroScale: Rule<ThreeSceneContext> = {
  id: 'zero-scale',
  check(context, emit) {
    walkScene(context.scene, (node, path) => {
      if (!node.visible || !isFiniteVec(node.scale)) return
      const { x, y, z } = node.scale
      if (x !== 0 && y !== 0 && z !== 0) return
      emit({
        rule: 'zero-scale',
        severity: 'warn',
        path,
        message: 'visible object has a zero scale axis and renders nothing',
        cause: 'scale reset or animated to 0 without setting visible=false',
      })
    })
  },
}

export const unloadedTexture: Rule<ThreeSceneContext> = {
  id: 'unloaded-texture',
  check(context, emit) {
    walkScene(context.scene, (node, path) => {
      for (const material of asMaterialList(node.material)) {
        for (const [slot, value] of Object.entries(material)) {
          const texture = value as SceneTexture | null | undefined // probing an arbitrary material slot; isTexture check below narrows it
          if (!texture || texture.isTexture !== true || texture.image) continue
          emit({
            rule: 'unloaded-texture',
            severity: 'warn',
            path,
            message: `texture in slot "${slot}" has no image`,
            cause: 'load failed, wrong URL, or texture used before loading finished',
          })
        }
      }
    })
  },
}

export const sceneRules: Array<Rule<ThreeSceneContext>> = [
  nonFiniteGeometry,
  nonFiniteTransform,
  zeroScale,
  unloadedTexture,
]
