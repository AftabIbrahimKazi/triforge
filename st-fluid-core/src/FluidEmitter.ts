/**
 * FluidEmitter — defines a region that spawns fluid particles.
 * Blender: Fluid > Emitter object.
 *
 * Used to spawn batches of particles from SPHSimulator.spawnFrom(emitter).
 */
export interface FluidEmitterOptions {
  /** World-space position [x,y,z]. Default [0,0,0]. */
  position?: [number, number, number]
  /** Spawn radius. Default 0.5. */
  radius?: number
  /** Initial velocity of spawned particles [x,y,z]. Default [0,0,0]. */
  velocity?: [number, number, number]
  /** Jitter applied to initial velocity. Default 0.1. */
  jitter?: number
}

export class FluidEmitter {
  parameters: {
    posX:     number
    posY:     number
    posZ:     number
    radius:   number
    velX:     number
    velY:     number
    velZ:     number
    jitter:   number
  }

  enabled = true

  constructor(opts: FluidEmitterOptions = {}) {
    const p = opts.position ?? [0, 0, 0]
    const v = opts.velocity ?? [0, 0, 0]
    this.parameters = {
      posX:   p[0], posY: p[1], posZ: p[2],
      radius: opts.radius ?? 0.5,
      velX:   v[0], velY: v[1], velZ: v[2],
      jitter: opts.jitter ?? 0.1,
    }
  }

  /** Sample a random spawn position within the emitter sphere. */
  samplePosition(): [number, number, number] {
    const r = this.parameters.radius * Math.cbrt(Math.random())
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const sinPhi = Math.sin(phi)
    return [
      this.parameters.posX + r * sinPhi * Math.cos(theta),
      this.parameters.posY + r * sinPhi * Math.sin(theta),
      this.parameters.posZ + r * Math.cos(phi),
    ]
  }

  /** Sample initial velocity with jitter. */
  sampleVelocity(): [number, number, number] {
    const j = this.parameters.jitter
    return [
      this.parameters.velX + (Math.random() - 0.5) * j * 2,
      this.parameters.velY + (Math.random() - 0.5) * j * 2,
      this.parameters.velZ + (Math.random() - 0.5) * j * 2,
    ]
  }
}
