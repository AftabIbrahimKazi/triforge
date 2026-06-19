/** Cheap 3D value noise using integer hashing. Returns value in [-1, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const ux = xf*xf*(3-2*xf), uy = yf*yf*(3-2*yf), uz = zf*zf*(3-2*zf)

  const hash = (a: number, b: number, c: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
    return (n - Math.floor(n)) * 2 - 1
  }

  const v000 = hash(xi,   yi,   zi  ), v100 = hash(xi+1, yi,   zi  )
  const v010 = hash(xi,   yi+1, zi  ), v110 = hash(xi+1, yi+1, zi  )
  const v001 = hash(xi,   yi,   zi+1), v101 = hash(xi+1, yi,   zi+1)
  const v011 = hash(xi,   yi+1, zi+1), v111 = hash(xi+1, yi+1, zi+1)

  const lerp = (a: number, b: number, t: number) => a + (b-a)*t
  return lerp(
    lerp(lerp(v000, v100, ux), lerp(v010, v110, ux), uy),
    lerp(lerp(v001, v101, ux), lerp(v011, v111, ux), uy),
    uz,
  )
}
