import { BufferGeometry, MeshBasicMaterial } from 'three'
import { BaseModifier } from '../../core/BaseModifier.js'

export type BooleanOperation = 'union' | 'difference' | 'intersection'

export interface BooleanModifierOptions {
  operand: BufferGeometry
  operation?: BooleanOperation
  operandMatrix?: number[]
}

/**
 * BooleanModifier — Blender "Boolean" modifier equivalent.
 *
 * three-bvh-csg is loaded lazily (dynamic import) when a BooleanModifier is first
 * instantiated. This means @st-modifier-core can be imported without three-bvh-csg
 * in the importmap — the dependency is only required when you actually use this modifier.
 *
 * Await `modifier.ready()` before calling `stack.apply()` to ensure the library is loaded.
 *
 * ```typescript
 * const mod = new BooleanModifier({ operand: sphere, operation: 'difference' })
 * await mod.ready()
 * mesh.geometry = stack.apply()
 * ```
 */
export class BooleanModifier extends BaseModifier {
  get name() { return 'Boolean' }

  parameters: Record<string, number>

  private readonly _operand:       BufferGeometry
  private readonly _operandMatrix: number[] | null
  private          _evaluator:     unknown = null
  private          _csg:           Record<string, unknown> | null = null
  private readonly _ready:         Promise<void>

  constructor(opts: BooleanModifierOptions) {
    super()
    this._operand       = opts.operand
    this._operandMatrix = opts.operandMatrix ?? null

    const opIndex = opts.operation === 'union' ? 0
                  : opts.operation === 'intersection' ? 2
                  : 1

    this.parameters = { operation: opIndex }

    // Lazy-load three-bvh-csg — only fetched when this modifier is instantiated,
    // not when @st-modifier-core is imported. Keeps the package importable without
    // three-bvh-csg in the importmap.
    this._ready = (import('three-bvh-csg') as Promise<Record<string, unknown>>).then(m => {
      this._csg       = m
      const Evaluator = m['Evaluator'] as new () => unknown
      this._evaluator = new Evaluator()
    })
  }

  /** Resolves when three-bvh-csg has loaded. Await before calling stack.apply(). */
  ready(): Promise<void> { return this._ready }

  apply(geometry: BufferGeometry): BufferGeometry {
    if (!this._csg || !this._evaluator) {
      throw new Error(
        '@st-modifier-core BooleanModifier: three-bvh-csg is still loading.\n' +
        'Await `await modifier.ready()` before calling stack.apply().\n' +
        'Also add "three-bvh-csg" to your importmap:\n' +
        '  "three-bvh-csg": "https://unpkg.com/three-bvh-csg@0.0.18/build/index.module.js"',
      )
    }

    const { Brush, ADDITION, SUBTRACTION, INTERSECTION } = this._csg as Record<string, unknown>
    const opMap = { union: ADDITION, difference: SUBTRACTION, intersection: INTERSECTION }

    const opIndex = Math.round(this.parameters.operation)
    const opKey   = opIndex === 0 ? 'union' : opIndex === 2 ? 'intersection' : 'difference'
    const csgOp   = opMap[opKey]

    const BrushCls = Brush as new (g: BufferGeometry, m: MeshBasicMaterial) => { matrix: { fromArray(a: number[]): void }; matrixAutoUpdate: boolean; updateMatrixWorld(f: boolean): void }
    const EvalCls  = this._evaluator as { evaluate(a: unknown, b: unknown, op: unknown): { geometry: BufferGeometry } }

    const mat    = new MeshBasicMaterial()
    const brushA = new BrushCls(geometry,      mat)
    const brushB = new BrushCls(this._operand, mat)

    if (this._operandMatrix) {
      brushB.matrix.fromArray(this._operandMatrix)
      brushB.matrixAutoUpdate = false
      brushB.updateMatrixWorld(true)
    }

    brushA.updateMatrixWorld(true)
    brushB.updateMatrixWorld(true)

    const result = EvalCls.evaluate(brushA, brushB, csgOp)
    const out    = result.geometry.clone()
    mat.dispose()
    return out
  }
}
