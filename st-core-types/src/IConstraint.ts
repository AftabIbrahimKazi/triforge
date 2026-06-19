/**
 * IConstraint — the contract every st-physics-core rigid-body constraint fulfils.
 *
 * Constraints are solved iteratively each physics step by RigidBodyWorld.
 * All position/velocity corrections happen inside solve().
 */
export interface IConstraint {
  readonly type: string
  parameters: Record<string, number>
  enabled: boolean
  /** Apply one position+velocity correction pass. Called each substep. */
  solve(): void
}
