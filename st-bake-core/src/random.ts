const UINT32_RANGE = 4294967296
const MULBERRY_STEP = 0x6d2b79f5
const SEED_SPREAD = 0x9e3779b9
const SHIFT_A = 15
const SHIFT_B = 7
const SHIFT_C = 14
const OR_MASK = 61

export function makeRandom(seed: number, stream: number): () => number {
  let state = (seed + Math.imul(stream + 1, SEED_SPREAD)) >>> 0
  return (): number => {
    state = (state + MULBERRY_STEP) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> SHIFT_A), t | 1)
    t ^= t + Math.imul(t ^ (t >>> SHIFT_B), t | OR_MASK)
    return ((t ^ (t >>> SHIFT_C)) >>> 0) / UINT32_RANGE
  }
}
