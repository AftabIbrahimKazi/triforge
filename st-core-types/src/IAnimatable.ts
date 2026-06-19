/**
 * IAnimatable — any object whose scalar inputs live in a flat `parameters`
 * object, making them compatible with GSAP and st-keyframe.
 *
 * Every node, modifier, force, renderer, and simulator in the ecosystem
 * implements this interface on its `parameters` property.
 *
 * @example
 * // Drive any IAnimatable with st-keyframe:
 * const track = new KeyframeTrack(node.parameters, 'scale', [...])
 *
 * // Drive with GSAP:
 * gsap.to(modifier.parameters, { strength: 1.0, duration: 2 })
 */
export interface IAnimatable {
  parameters: Record<string, number | [number, number, number]>
}
