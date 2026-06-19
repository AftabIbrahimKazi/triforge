import type { EasingFn } from '../easing/easings.js'
import { linear } from '../easing/easings.js'
import { KeyframeTrack } from './KeyframeTrack.js'
import { AnimationClip } from './AnimationClip.js'

/**
 * Fluent builder for creating KeyframeTracks from a simple {time, values} sequence.
 *
 * Usage:
 *   const clip = buildClip('fade', [
 *     { time: 0,   targets: [[bloom.parameters, { strength: 0 }]] },
 *     { time: 2,   targets: [[bloom.parameters, { strength: 1 }]], easing: easeInOutSine },
 *     { time: 4,   targets: [[bloom.parameters, { strength: 0 }]] },
 *   ])
 */

export interface ClipStep {
  time: number
  targets: [Record<string, number>, Record<string, number>][]
  easing?: EasingFn
}

/**
 * Build an AnimationClip from a sequence of steps.
 * Each step describes target states at a given time.
 * The easing on each step applies from that step to the *next*.
 */
export function buildClip(name: string, steps: ClipStep[]): AnimationClip {
  // Group tracks by target object + property
  const trackMap = new Map<string, KeyframeTrack>()

  steps.forEach((step, si) => {
    const easing = step.easing ?? linear
    for (const [target, values] of step.targets) {
      for (const [prop, value] of Object.entries(values)) {
        const key = `${si}_${prop}_${JSON.stringify(target)}`
        void key // key is only used below per track lookup

        // Find or create track for (target, prop)
        const tKey = `${prop}__${getObjId(target)}`
        if (!trackMap.has(tKey)) {
          trackMap.set(tKey, new KeyframeTrack(target, prop))
        }
        const track = trackMap.get(tKey)!
        track.addKeyframe({ time: step.time, value, easing })
      }
    }
  })

  return new AnimationClip(name, Array.from(trackMap.values()))
}

const _objIds = new WeakMap<object, number>()
let _nextId = 0
function getObjId(obj: object): number {
  if (!_objIds.has(obj)) _objIds.set(obj, _nextId++)
  return _objIds.get(obj)!
}
