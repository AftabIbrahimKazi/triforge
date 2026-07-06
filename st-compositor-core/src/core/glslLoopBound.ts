/**
 * Compile-time GLSL loop-bound sanitizer.
 *
 * Several passes bake a JS number directly into a GLSL `for` loop bound, e.g.
 * `for (int i = 0; i < ${n}; i++)`. Per the root ecosystem rule ("ALWAYS cap
 * GLSL loop iterations to a compile-time constant"), that number must be a
 * finite integer within a sane range before it reaches the shader source:
 *
 *  - `NaN`/`Infinity` would produce a shader that fails to compile.
 *  - An absurdly large value (e.g. a mistyped `samples: 1e6`) would compile a
 *    loop that hangs the GPU.
 *
 * This clamps to [min, max] and rounds to an integer, so the emitted bound is
 * always a small compile-time constant.
 */
export function glslLoopBound(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  const rounded = Math.round(value)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}
