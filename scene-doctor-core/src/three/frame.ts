const GRID = 8
const CHANNELS = 4
const HALF = 0.5

export interface FrameGl {
  RGBA: number
  UNSIGNED_BYTE: number
  readPixels(x: number, y: number, w: number, h: number, format: number, type: number, out: Uint8Array): void
}

export function readFrameSample(gl: FrameGl, width: number, height: number): Uint8Array {
  const out = new Uint8Array(GRID * GRID * CHANNELS)
  const pixel = new Uint8Array(CHANNELS)
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = Math.min(width - 1, Math.floor(((gx + HALF) / GRID) * width))
      const y = Math.min(height - 1, Math.floor(((gy + HALF) / GRID) * height))
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      out.set(pixel, (gy * GRID + gx) * CHANNELS)
    }
  }
  return out
}

export function classifyFrame(sample: ArrayLike<number>): 'black' | 'uniform' | 'varied' {
  if (sample.length < CHANNELS) return 'varied'
  let allBlack = true
  let uniform = true
  for (let i = 0; i < sample.length; i += CHANNELS) {
    if (sample[i] !== 0 || sample[i + 1] !== 0 || sample[i + 2] !== 0) allBlack = false
    for (let c = 0; c < CHANNELS; c++) {
      if (sample[i + c] !== sample[c]) uniform = false
    }
  }
  if (allBlack) return 'black'
  return uniform ? 'uniform' : 'varied'
}
