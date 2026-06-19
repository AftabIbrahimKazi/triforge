/**
 * IStrand — a single hair or fur strand: an ordered list of world-space
 * control points from root to tip.
 *
 * Used by st-hair-core (HairSystem, HairDynamics, StrandGenerator) and any
 * code that generates or consumes strand geometry without importing st-hair-core.
 *
 * @example
 * const strand: IStrand = {
 *   points: [[0,0,0], [0,0.3,0], [0.1,0.6,0], [0.2,1.0,0]],
 *   normal: [0, 0, 1],
 *   width: 0.8,
 * }
 */
export interface IStrand {
  /** World-space control points [x,y,z], root first. Minimum 2. */
  points: [number, number, number][]
  /** Root surface normal — used to orient ribbons and for physics. */
  normal?: [number, number, number]
  /** Per-strand width multiplier [0..1]. */
  width?: number
}
