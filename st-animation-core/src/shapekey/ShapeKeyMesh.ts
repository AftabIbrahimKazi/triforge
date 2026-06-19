import { Mesh, BufferGeometry, BufferAttribute, Material } from 'three'
import type { ShapeKey } from './ShapeKey.js'

/**
 * ShapeKeyMesh — a Three.js Mesh with Blender-style named shape keys.
 * Blender: Object Data > Shape Keys panel.
 *
 * Shape keys are applied in software (CPU) by lerping vertex positions.
 * The result is written to the geometry's position attribute each frame.
 *
 * All per-key influences live in `parameters` — animatable with st-keyframe or GSAP:
 *   gsap.to(mesh.parameters, { smile: 1, duration: 0.5 })
 *   new KeyframeTrack(mesh.parameters, 'smile', [...])
 *
 * Usage:
 *   const mesh = new ShapeKeyMesh(baseGeo, material)
 *   mesh.addShapeKey({ name: 'smile',  positions: smilePositions })
 *   mesh.addShapeKey({ name: 'blink',  positions: blinkPositions })
 *   mesh.parameters.smile = 0.8  // 80% toward smile pose
 *   mesh.update()                 // write blended positions to GPU
 */
export class ShapeKeyMesh extends Mesh {
  /**
   * Per-key influence values, keyed by shape key name.
   * Range [0, 1]. 0 = basis (no effect), 1 = fully this shape.
   * GSAP/st-keyframe compatible.
   */
  parameters: Record<string, number> = {}

  private _keys: ShapeKey[] = []
  private _basis: Float32Array
  private _work: Float32Array

  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    super(geometry, material)
    const pos    = geometry.getAttribute('position') as BufferAttribute
    this._basis  = new Float32Array(pos.array)
    this._work   = new Float32Array(pos.array.length)
  }

  get shapeKeys(): readonly ShapeKey[] { return this._keys }

  /**
   * Add a shape key. The name becomes a key in `parameters` (default influence 0).
   * "Basis" is reserved — adding it replaces the rest pose.
   */
  addShapeKey(key: ShapeKey): void {
    if (key.name === 'Basis') {
      // Replace basis positions
      this._basis.set(key.positions)
      this._work  = new Float32Array(this._basis.length)
      return
    }
    const existing = this._keys.findIndex(k => k.name === key.name)
    if (existing !== -1) {
      this._keys[existing] = key
    } else {
      this._keys.push(key)
      if (!(key.name in this.parameters)) this.parameters[key.name] = 0
    }
  }

  removeShapeKey(name: string): void {
    this._keys = this._keys.filter(k => k.name !== name)
    delete this.parameters[name]
  }

  /**
   * Blend all shape key influences and write to the geometry's position attribute.
   * Call this every frame (or whenever parameters change).
   * O(V × K) where V = vertex count, K = key count.
   */
  update(): void {
    const n = this._basis.length
    // Start from basis
    this._work.set(this._basis)

    for (const key of this._keys) {
      const influence = this.parameters[key.name] ?? 0
      if (influence === 0) continue

      const kp = key.positions
      for (let i = 0; i < n; i++) {
        this._work[i] += (kp[i] - this._basis[i]) * influence
      }
    }

    const attr = this.geometry.getAttribute('position') as BufferAttribute
    attr.array.set(this._work)
    attr.needsUpdate = true
    this.geometry.computeVertexNormals()
  }

  /**
   * Evaluate what the blended positions would be at given influences
   * WITHOUT writing to the geometry. Returns a new Float32Array.
   */
  sample(influences: Record<string, number>): Float32Array {
    const n   = this._basis.length
    const out = new Float32Array(this._basis)
    for (const key of this._keys) {
      const inf = influences[key.name] ?? 0
      if (inf === 0) continue
      const kp = key.positions
      for (let i = 0; i < n; i++) out[i] += (kp[i] - this._basis[i]) * inf
    }
    return out
  }
}
