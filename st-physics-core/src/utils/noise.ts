/** Cheap 3D value noise using integer hashing. Returns value in [-1, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy), uz = fz*fz*(3-2*fz)

  const h = (n: number) => {
    let v = n ^ (n >> 16); v = Math.imul(v, 0x45d9f3b); v ^= v >> 16
    return (v & 0xffff) / 0xffff * 2 - 1
  }
  const hash = (a: number, b: number, c: number) => h(a * 1619 + b * 31337 + c * 6971)

  const v000 = hash(ix,   iy,   iz  ), v100 = hash(ix+1, iy,   iz  )
  const v010 = hash(ix,   iy+1, iz  ), v110 = hash(ix+1, iy+1, iz  )
  const v001 = hash(ix,   iy,   iz+1), v101 = hash(ix+1, iy,   iz+1)
  const v011 = hash(ix,   iy+1, iz+1), v111 = hash(ix+1, iy+1, iz+1)

  const lerp = (a: number, b: number, t: number) => a + (b-a)*t
  return lerp(lerp(lerp(v000,v100,ux), lerp(v010,v110,ux), uy),
              lerp(lerp(v001,v101,ux), lerp(v011,v111,ux), uy), uz)
}
