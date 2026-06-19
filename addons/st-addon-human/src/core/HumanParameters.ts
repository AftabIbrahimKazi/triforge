/**
 * All parameters that drive the HumanGenerator.
 * Every field is a plain scalar — fully compatible with GSAP and st-keyframe.
 */
export interface HumanParameters {
  // ── Body ────────────────────────────────────────────────────────────────────
  /** Total height in metres. Default 1.75 */
  height: number
  /** Body mass index proxy 0–1 (0 = very thin, 0.5 = average, 1 = heavy). Default 0.35 */
  bmi: number
  /** Gender blend 0–1 (0 = fully male, 1 = fully female). Default 0.5 */
  gender: number
  /** Age 0–1 (0 = young adult, 0.5 = middle age, 1 = elderly). Default 0.2 */
  age: number
  /** Muscle definition 0–1. Default 0.3 */
  muscle: number

  // ── Proportions ──────────────────────────────────────────────────────────────
  /** Shoulder width relative to height. Default 0.5 */
  shoulderWidth: number
  /** Hip width relative to height. Default 0.45 */
  hipWidth: number
  /** Waist width relative to shoulder. Default 0.55 */
  waistRatio: number
  /** Chest depth front-to-back relative to shoulder width. Default 0.5 */
  chestDepth: number
  /** Arm length relative to body. Default 1.0 */
  armLength: number
  /** Leg length relative to body. Default 1.0 */
  legLength: number
  /** Upper-to-lower arm ratio. Default 0.5 */
  elbowRatio: number
  /** Upper-to-lower leg ratio. Default 0.5 */
  kneeRatio: number
  /** Neck length 0–1. Default 0.3 */
  neckLength: number
  /** Foot size relative to height. Default 0.5 */
  footSize: number

  // ── Head ────────────────────────────────────────────────────────────────────
  /** Head size relative to body. Default 0.5 */
  headSize: number
  /** Face width 0–1 (0 = narrow, 1 = wide). Default 0.5 */
  faceWidth: number
  /** Jaw width 0–1. Default 0.4 */
  jawWidth: number
  /** Brow prominence 0–1. Default 0.3 */
  browProminence: number
  /** Nose length 0–1. Default 0.4 */
  noseLength: number
  /** Nose width 0–1. Default 0.35 */
  noseWidth: number
  /** Chin prominence 0–1. Default 0.3 */
  chinProminence: number
  /** Eye size 0–1. Default 0.4 */
  eyeSize: number
  /** Eye spacing 0–1. Default 0.5 */
  eyeSpacing: number

  // ── Skin material ────────────────────────────────────────────────────────────
  /** Skin base colour hex. Default '#c68642' */
  skinColor: string
  /** Skin SSS radius 0–1. Default 0.4 */
  sssRadius: number
  /** Skin roughness 0–1. Default 0.6 */
  skinRoughness: number
  /** Skin specular 0–1. Default 0.3 */
  skinSpecular: number

  // ── Eye material ─────────────────────────────────────────────────────────────
  /** Iris colour hex. Default '#3a6e8c' */
  irisColor: string

  // ── Subdivision ──────────────────────────────────────────────────────────────
  /** Geometry subdivision level 0–3. Default 2 */
  subdivision: number
}

export const DEFAULT_PARAMETERS: HumanParameters = {
  height: 1.75, bmi: 0.35, gender: 0.5, age: 0.2, muscle: 0.3,
  shoulderWidth: 0.5, hipWidth: 0.45, waistRatio: 0.55, chestDepth: 0.5,
  armLength: 1.0, legLength: 1.0, elbowRatio: 0.5, kneeRatio: 0.5,
  neckLength: 0.3, footSize: 0.5,
  headSize: 0.5, faceWidth: 0.5, jawWidth: 0.4, browProminence: 0.3,
  noseLength: 0.4, noseWidth: 0.35, chinProminence: 0.3,
  eyeSize: 0.4, eyeSpacing: 0.5,
  skinColor: '#c68642', sssRadius: 0.4, skinRoughness: 0.6, skinSpecular: 0.3,
  irisColor: '#3a6e8c',
  subdivision: 2,
}
