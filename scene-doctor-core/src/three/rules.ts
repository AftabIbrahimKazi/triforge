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

const MAX_TEXTURE_SIZE = 4096
const MAX_SHADOW_MAP_SIZE = 4096

interface SizedImage {
  width?: number
  height?: number
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0
}

export const oversizedTexture: Rule<ThreeSceneContext> = {
  id: 'oversized-texture',
  check(context, emit) {
    walkScene(context.scene, (node, path) => {
      for (const material of asMaterialList(node.material)) {
        for (const [slot, value] of Object.entries(material)) {
          const texture = value as SceneTexture | null | undefined // probing an arbitrary material slot; isTexture check below narrows it
          if (!texture || texture.isTexture !== true || !texture.image) continue
          const { width, height } = texture.image as SizedImage // image shape differs per loader; only the size fields are read
          if (typeof width !== 'number' || typeof height !== 'number') continue
          if (Math.max(width, height) > MAX_TEXTURE_SIZE) {
            emit({
              rule: 'oversized-texture',
              severity: 'warn',
              path,
              message: `texture in slot "${slot}" is ${width}x${height}`,
              cause: 'downscale or compress it; many mobile GPUs cap at 4096 and it costs memory',
            })
          } else if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
            emit({
              rule: 'npot-texture',
              severity: 'info',
              path,
              message: `texture in slot "${slot}" is ${width}x${height}, not a power of two`,
              cause: 'mipmaps and repeat wrapping can be slower or unsupported on older devices',
            })
          }
        }
      }
    })
  },
}

export const oversizedShadowMap: Rule<ThreeSceneContext> = {
  id: 'oversized-shadow-map',
  check(context, emit) {
    walkScene(context.scene, (node, path) => {
      const size = node.shadow?.mapSize
      if (!size || Math.max(size.x, size.y) <= MAX_SHADOW_MAP_SIZE) return
      emit({
        rule: 'oversized-shadow-map',
        severity: 'warn',
        path,
        message: `shadow map is ${size.x}x${size.y}`,
        cause: 'each light shadow map this large costs tens of MB of GPU memory; use 2048 or tighter shadow camera bounds',
      })
    })
  },
}

export const sceneRules: Array<Rule<ThreeSceneContext>> = [

  nonFiniteGeometry,

  nonFiniteTransform,

  zeroScale,

  unloadedTexture,

  oversizedTexture,

  oversizedShadowMap,

]
