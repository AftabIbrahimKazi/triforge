import * as THREE from 'three'
import type { HumanParameters } from '../core/HumanParameters.js'

/** Smooth step t∈[0,1] */
function smooth(t: number): number { return t * t * (3 - 2 * t) }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }

// ── Lathe profile helpers ─────────────────────────────────────────────────────

/** Build a BufferGeometry from a 2D profile (radii along Y axis) via revolution. */
function lathe(profile: Array<[number, number]>, segments = 16): THREE.BufferGeometry {
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(points, segments)
}

/** Merge an array of positioned geometries into one BufferGeometry. */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = THREE.BufferGeometryUtils.mergeGeometries(parts, false)
  parts.forEach(g => g.dispose())
  return merged!
}

// ── Individual body part geometry builders ────────────────────────────────────

function buildTorso(p: HumanParameters, H: number): THREE.BufferGeometry {
  const sw   = p.shoulderWidth  * H * 0.26   // shoulder half-width
  const hw   = lerp(sw * 0.75, sw * 1.1, p.gender) * lerp(1, 1.15, p.bmi)
              * p.hipWidth / 0.45             // hip half-width
  const ww   = lerp(sw, hw, 0.5) * p.waistRatio * lerp(1, 1.2, p.bmi)
  const cd   = sw * p.chestDepth             // chest depth
  const tH   = H * 0.3                       // torso height
  const bH   = H * 0.055                     // belly section

  // Torso profile: shoulder → chest → waist → hip (Y = bottom at 0, top at tH+bH)
  const profile: Array<[number, number]> = [
    [hw * 0.9,  0],
    [hw,        bH * 0.4],
    [ww * 1.05, bH],
    [ww,        bH + tH * 0.25],
    [ww * 0.95, bH + tH * 0.5],
    [sw * 0.92, bH + tH * 0.75],
    [sw,        bH + tH],
    [sw * 0.85, bH + tH + H * 0.01],
  ]

  const geo = lathe(profile, 20)
  // Scale Z to simulate chest depth vs width difference
  geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, p.chestDepth * 1.4 + 0.3))
  geo.translate(0, -bH * 0.5, 0)
  return geo
}

function buildHead(p: HumanParameters, H: number, yBase: number): THREE.BufferGeometry {
  const hR   = H * 0.075 * (0.8 + p.headSize * 0.4)
  const fw   = lerp(0.85, 1.1, p.faceWidth)
  const jw   = lerp(0.7, 1.0, p.jawWidth)

  const profile: Array<[number, number]> = [
    [0,            -hR * 1.1],
    [hR * jw,      -hR * 0.55],
    [hR * fw,       hR * 0.05],
    [hR * fw * 0.95, hR * 0.5],
    [hR * 0.9,     hR * 0.9],
    [hR * 0.6,     hR * 1.15],
    [0,            hR * 1.2],
  ]

  const geo = lathe(profile, 24)
  // Slight front-back squish for realistic head shape
  geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 0.82))
  geo.translate(0, yBase + hR * 0.1, 0)
  return geo
}

function buildNeck(p: HumanParameters, H: number, yBase: number): THREE.BufferGeometry {
  const nR = H * 0.028 * lerp(1.1, 0.85, p.gender)
  const nH = H * 0.045 * (0.6 + p.neckLength * 0.8)
  const geo = new THREE.CylinderGeometry(nR * 0.95, nR, nH, 12)
  geo.translate(0, yBase + nH * 0.5, 0)
  return geo
}

function buildArm(p: HumanParameters, H: number, yBase: number, side: 1 | -1): THREE.BufferGeometry {
  const sw      = p.shoulderWidth * H * 0.26
  const xOff    = side * (sw + H * 0.01)
  const armH    = H * 0.29 * p.armLength
  const upperH  = armH * (0.45 + p.elbowRatio * 0.1)
  const lowerH  = armH - upperH
  const upR     = H * 0.024 * lerp(1.05, 0.88, p.gender) * lerp(1, 1.15, p.muscle)
  const loR     = upR * 0.88
  const wristR  = upR * 0.65

  const upper = new THREE.CylinderGeometry(loR, upR, upperH, 10)
  upper.translate(xOff, yBase - upperH * 0.5, 0)

  const lower = new THREE.CylinderGeometry(wristR, loR, lowerH, 10)
  lower.translate(xOff, yBase - upperH - lowerH * 0.5, 0)

  // Hand blob — squashed sphere
  const handR = H * 0.038 * (0.8 + p.footSize * 0.15)
  const hand  = new THREE.SphereGeometry(handR, 8, 6)
  hand.applyMatrix4(new THREE.Matrix4().makeScale(0.65, 0.9, 0.4))
  hand.translate(xOff, yBase - upperH - lowerH - handR * 0.5, 0)

  return merge([upper, lower, hand])
}

function buildLeg(p: HumanParameters, H: number, yBase: number, side: 1 | -1): THREE.BufferGeometry {
  const hw      = lerp(p.shoulderWidth * 0.75, p.shoulderWidth * 1.1, p.gender) * H * 0.26 * p.hipWidth / 0.45
  const xOff    = side * hw * 0.42
  const legH    = H * 0.44 * p.legLength
  const upperH  = legH * (0.48 + p.kneeRatio * 0.08)
  const lowerH  = legH - upperH
  const thighR  = H * 0.044 * lerp(1.05, 0.95, p.gender) * lerp(1, 1.2, p.bmi)
  const calfR   = thighR * 0.68
  const ankleR  = thighR * 0.45

  const upper = new THREE.CylinderGeometry(calfR * 0.95, thighR, upperH, 10)
  upper.translate(xOff, yBase - upperH * 0.5, 0)

  const lower = new THREE.CylinderGeometry(ankleR, calfR, lowerH, 10)
  lower.translate(xOff, yBase - upperH - lowerH * 0.5, 0)

  // Foot
  const footL = H * 0.12 * p.footSize
  const footH = H * 0.022
  const foot  = new THREE.BoxGeometry(footL * 0.38, footH, footL)
  foot.translate(xOff + side * footL * 0.06, yBase - upperH - lowerH - footH * 0.5, footL * 0.1)

  return merge([upper, lower, foot])
}

function buildEye(p: HumanParameters, H: number, headY: number, side: 1 | -1): THREE.BufferGeometry {
  const hR   = H * 0.075 * (0.8 + p.headSize * 0.4)
  const eR   = H * 0.018 * (0.7 + p.eyeSize * 0.6)
  const xOff = side * hR * (0.25 + p.eyeSpacing * 0.2)
  const yOff = headY + hR * 0.15
  const zOff = hR * 0.75

  const geo  = new THREE.SphereGeometry(eR, 10, 8)
  geo.translate(xOff, yOff, zOff)
  return geo
}

// ── Main builder ──────────────────────────────────────────────────────────────

export interface BodyGeometryResult {
  body:  THREE.BufferGeometry   // skin geometry (torso + head + neck + limbs)
  eyes:  THREE.BufferGeometry   // eye geometry (separate material)
  /** World-space bone positions for the generated proportions */
  skeleton: {
    root:        THREE.Vector3
    hip:         THREE.Vector3
    spine:       THREE.Vector3
    neck:        THREE.Vector3
    head:        THREE.Vector3
    shoulderL:   THREE.Vector3
    shoulderR:   THREE.Vector3
    elbowL:      THREE.Vector3
    elbowR:      THREE.Vector3
    wristL:      THREE.Vector3
    wristR:      THREE.Vector3
    hipL:        THREE.Vector3
    hipR:        THREE.Vector3
    kneeL:       THREE.Vector3
    kneeR:       THREE.Vector3
    ankleL:      THREE.Vector3
    ankleR:      THREE.Vector3
  }
}

export function buildBodyGeometry(p: HumanParameters): BodyGeometryResult {
  const H     = p.height
  const bmiS  = lerp(1, 1.12, p.bmi)

  // Y positions (from ground up)
  const hipY     = H * 0.48 * p.legLength
  const torsoH   = H * 0.355
  const shouldY  = hipY + torsoH
  const neckH    = H * 0.045 * (0.6 + p.neckLength * 0.8)
  const neckY    = shouldY + neckH
  const headR    = H * 0.075 * (0.8 + p.headSize * 0.4)
  const headCY   = neckY + headR * 0.9   // head centre

  const torso  = buildTorso(p, H)
  torso.translate(0, hipY, 0)

  const neck   = buildNeck(p, H, shouldY)
  const head   = buildHead(p, H, neckY)
  const armL   = buildArm(p, H, shouldY, -1)
  const armR   = buildArm(p, H, shouldY,  1)
  const legL   = buildLeg(p, H, hipY, -1)
  const legR   = buildLeg(p, H, hipY,  1)

  // Scale for BMI (uniform scale on skin, not eyes)
  const bodyParts = [torso, neck, head, armL, armR, legL, legR]
  bodyParts.forEach(g => g.applyMatrix4(new THREE.Matrix4().makeScale(bmiS, 1, bmiS)))

  const body = merge(bodyParts)
  body.computeVertexNormals()

  // Eyes (separate geometry, not BMI-scaled)
  const eyeL = buildEye(p, H, headCY, -1)
  const eyeR = buildEye(p, H, headCY,  1)
  const eyes = merge([eyeL, eyeR])
  eyes.computeVertexNormals()

  // Skeleton positions
  const sw = p.shoulderWidth * H * 0.26 * bmiS
  const hw = lerp(sw * 0.75, sw * 1.1, p.gender) * lerp(1, 1.15, p.bmi) * p.hipWidth / 0.45
  const armH   = H * 0.29 * p.armLength
  const upperA = armH * (0.45 + p.elbowRatio * 0.1)
  const legH   = H * 0.44 * p.legLength
  const upperL = legH * (0.48 + p.kneeRatio * 0.08)

  const skeleton = {
    root:      new THREE.Vector3(0, 0, 0),
    hip:       new THREE.Vector3(0, hipY, 0),
    spine:     new THREE.Vector3(0, hipY + torsoH * 0.5, 0),
    neck:      new THREE.Vector3(0, shouldY, 0),
    head:      new THREE.Vector3(0, headCY, 0),
    shoulderL: new THREE.Vector3(-sw, shouldY, 0),
    shoulderR: new THREE.Vector3( sw, shouldY, 0),
    elbowL:    new THREE.Vector3(-sw, shouldY - upperA, 0),
    elbowR:    new THREE.Vector3( sw, shouldY - upperA, 0),
    wristL:    new THREE.Vector3(-sw, shouldY - armH, 0),
    wristR:    new THREE.Vector3( sw, shouldY - armH, 0),
    hipL:      new THREE.Vector3(-hw * 0.42, hipY, 0),
    hipR:      new THREE.Vector3( hw * 0.42, hipY, 0),
    kneeL:     new THREE.Vector3(-hw * 0.42, hipY - upperL, 0),
    kneeR:     new THREE.Vector3( hw * 0.42, hipY - upperL, 0),
    ankleL:    new THREE.Vector3(-hw * 0.42, hipY - legH, 0),
    ankleR:    new THREE.Vector3( hw * 0.42, hipY - legH, 0),
  }

  return { body, eyes, skeleton }
}
