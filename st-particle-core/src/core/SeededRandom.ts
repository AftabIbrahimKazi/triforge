/**
 * Seeded LCG random — same seed always produces the same sequence.
 * Matches Blender's particle seed behaviour.
 */
export class SeededRandom {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.s = (Math.imul(1664525, this.s) + 1013904223) >>> 0
    return this.s / 4294967296
  }

  /** Returns a float in [-1, 1) */
  signed(): number {
    return this.next() * 2 - 1
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Reset the generator to a new seed — reuse the instance instead of allocating. */
  reset(seed: number): void {
    this.s = seed >>> 0
  }
}
