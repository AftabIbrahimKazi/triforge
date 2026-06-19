/**
 * IKeyframeTarget — any plain object whose numeric properties can be driven
 * by KeyframeTrack or QuaternionTrack from st-keyframe.
 *
 * In practice this is always the `.parameters` object of an IAnimatable,
 * but it can also be any other record of numbers — e.g. a camera's uniforms,
 * a custom simulation state, or a UI value.
 *
 * @example
 * const target: IKeyframeTarget = { opacity: 1, scale: 1 }
 * const track = new KeyframeTrack(target, 'opacity', [
 *   { time: 0, value: 0 },
 *   { time: 1, value: 1, easing: easeInOutSine },
 * ])
 */
export type IKeyframeTarget = Record<string, number>
