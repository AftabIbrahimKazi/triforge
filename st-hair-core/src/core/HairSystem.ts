import { BufferGeometry } from 'three'
import type { Strand } from './Strand.js'
import { buildTubeGeometry }    from '../geometry/tubeGeometry.js'
import { buildRibbonGeometry }  from '../geometry/ribbonGeometry.js'
import { buildLineGeometry }    from '../geometry/lineGeometry.js'
import { applyKink, type KinkType } from '../modifiers/KinkModifier.js'
import { applyClump }           from '../modifiers/ClumpModifier.js'

export type HairMode = 'tube' | 'ribbon' | 'line'

export interface HairSystemOptions {
  /** Render mode. */
  mode?:          HairMode
  /** Interpolation steps per strand segment. Blender: Display Steps. */
  steps?:         number
  /** Tube cross-section sides (tube mode). Blender: B-Spline. */
  crossSections?: number
  /** Root radius (tube mode). Blender: Radius Root. */
  radiusRoot?:    number
  /** Tip radius (tube mode). Blender: Radius Tip. */
  radiusTip?:     number
  /** Ribbon width at root. */
  widthRoot?:     number
  /** Ribbon width at tip. */
  widthTip?:      number
  /** Ribbon up vector (ribbon mode). */
  ribbonUp?:      [number, number, number]
  /** Kink type. Blender: Kink > Type. */
  kinkType?:      KinkType
  /** Kink amplitude. */
  kinkAmplitude?: number
  /** Kink frequency. */
  kinkFrequency?: number
}

/**
 * HairSystem — manages a collection of strands and generates geometry.
 * Blender: Particle System > Hair modifier.
 *
 * Workflow:
 *   1. Create HairSystem with rendering options
 *   2. Set strands via `setStrands()` or `addStrand()`
 *   3. Call `build()` to generate BufferGeometry
 *   4. Assign to THREE.Mesh (tube/ribbon) or THREE.LineSegments (line)
 *
 * All scalar parameters live in `parameters` for GSAP / st-keyframe:
 *   gsap.to(hair.parameters, { radiusRoot: 0.01 })
 */
export class HairSystem {
  parameters: {
    mode:          HairMode
    steps:         number
    crossSections: number
    radiusRoot:    number
    radiusTip:     number
    widthRoot:     number
    widthTip:      number
    kinkType:      KinkType
    kinkAmplitude: number
    kinkFrequency: number
    kinkShape:     number
    clumpFactor:   number
    clumpShape:    number
  }

  private _strands: Strand[] = []
  private _parents: Strand[] = []
  ribbonUp: [number, number, number]

  constructor(opts: HairSystemOptions = {}) {
    this.parameters = {
      mode:          opts.mode          ?? 'tube',
      steps:         opts.steps         ?? 8,
      crossSections: opts.crossSections ?? 4,
      radiusRoot:    opts.radiusRoot    ?? 0.02,
      radiusTip:     opts.radiusTip     ?? 0.004,
      widthRoot:     opts.widthRoot     ?? 0.04,
      widthTip:      opts.widthTip      ?? 0.008,
      kinkType:      opts.kinkType      ?? 'NOTHING',
      kinkAmplitude: opts.kinkAmplitude ?? 0.05,
      kinkFrequency: opts.kinkFrequency ?? 3,
      kinkShape:     0,
      clumpFactor:   0,
      clumpShape:    1,
    }
    this.ribbonUp = opts.ribbonUp ?? [0, 1, 0]
  }

  // ── Strand management ─────────────────────────────────────────────────────

  addStrand(strand: Strand): void { this._strands.push(strand) }

  setStrands(strands: Strand[]): void { this._strands = strands }

  /** Set parent/guide strands for clumping. */
  setParents(parents: Strand[]): void { this._parents = parents }

  get strandCount(): number { return this._strands.length }

  getStrands(): Readonly<Strand[]> { return this._strands }

  // ── Build ─────────────────────────────────────────────────────────────────

  /**
   * Generate BufferGeometry from current strands.
   * Apply kink and clump modifiers, then extrude geometry.
   */
  build(): BufferGeometry {
    const {
      mode, steps, crossSections, radiusRoot, radiusTip,
      widthRoot, widthTip,
      kinkType, kinkAmplitude, kinkFrequency, kinkShape,
      clumpFactor, clumpShape,
    } = this.parameters

    let strands = this._strands

    // Apply kink
    if (kinkType !== 'NOTHING' && kinkAmplitude > 0) {
      strands = strands.map(s => applyKink(s, { type: kinkType, amplitude: kinkAmplitude, frequency: kinkFrequency, shape: kinkShape }))
    }

    // Apply clump
    if (clumpFactor > 0 && this._parents.length > 0) {
      strands = applyClump(strands, this._parents, { factor: clumpFactor, shape: clumpShape })
    }

    if (strands.length === 0) return new BufferGeometry()

    switch (mode) {
      case 'ribbon':
        return buildRibbonGeometry(strands, steps, widthRoot, widthTip, this.ribbonUp)
      case 'line':
        return buildLineGeometry(strands, steps)
      default:
        return buildTubeGeometry(strands, steps, crossSections, radiusRoot, radiusTip)
    }
  }
}
