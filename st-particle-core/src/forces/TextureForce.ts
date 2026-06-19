import { DataTexture } from 'three'
import { BaseForce }   from '../core/BaseForce.js'
import type { Particle } from '../core/Particle.js'

export interface TextureForceOptions {
  /** World units covered by one full texture tile. Default 10. */
  scale?:    number
  /** Force multiplier. Default 1. */
  strength?: number
}

/**
 * TextureForce — per-particle force direction sampled from a DataTexture.
 * RGB (or XYZ float) channels map to world-space X/Y/Z force components.
 *
 * Uint8 textures: channels [0..255] are remapped to [-1..1].
 * FloatType textures: channels are used as-is.
 *
 * 2D sampling: particle.position XZ is projected onto the texture plane.
 * Tile wraps, so the field repeats every `scale` world units.
 * (Blender: Force Fields → Texture)
 */
export class TextureForce extends BaseForce {
  /** All scalar inputs — GSAP / keyframe compatible */
  parameters: {
    strength: number
    scale:    number
    /** World-space offset applied before UV projection */
    offsetX:  number
    offsetZ:  number
  }

  private readonly _data:     Uint8Array | Float32Array
  private readonly _width:    number
  private readonly _height:   number
  private readonly _isFloat:  boolean

  constructor(texture: DataTexture, opts: TextureForceOptions = {}) {
    super()
    this.parameters = {
      strength: opts.strength ?? 1.0,
      scale:    opts.scale    ?? 10.0,
      offsetX:  0,
      offsetZ:  0,
    }

    const img       = texture.image as unknown as { data: Uint8Array | Float32Array; width: number; height: number }
    this._data      = img.data
    this._width     = img.width
    this._height    = img.height
    this._isFloat   = this._data instanceof Float32Array
  }

  apply(particle: Particle, dt: number): void {
    const { strength, scale, offsetX, offsetZ } = this.parameters
    const invScale = 1 / Math.max(scale, 1e-6)

    // Map particle XZ to tiling UV [0..1)
    const u = (((particle.position.x - offsetX) * invScale % 1) + 1) % 1
    const v = (((particle.position.z - offsetZ) * invScale % 1) + 1) % 1

    const px  = Math.floor(u * this._width)  % this._width
    const py  = Math.floor(v * this._height) % this._height
    const idx = (py * this._width + px) * 4  // RGBA stride

    let fx: number, fy: number, fz: number
    if (this._isFloat) {
      const d = this._data as Float32Array
      fx = d[idx]
      fy = d[idx + 1]
      fz = d[idx + 2]
    } else {
      const d = this._data as Uint8Array
      // [0..255] → [-1..1]
      fx = d[idx]     / 127.5 - 1
      fy = d[idx + 1] / 127.5 - 1
      fz = d[idx + 2] / 127.5 - 1
    }

    particle.velocity.x += fx * strength * dt
    particle.velocity.y += fy * strength * dt
    particle.velocity.z += fz * strength * dt
  }
}
