/** Blender F-Curve interpolation modes, plus standard web easings. */

export type EasingFn = (t: number) => number

/** Linear — Blender: LINEAR */
export const linear: EasingFn = (t) => t

/** Constant — Blender: CONSTANT (step, no interpolation) */
export const constant: EasingFn = (t) => (t < 1 ? 0 : 1)

// --- Quadratic ---
export const easeInQuad:    EasingFn = (t) => t * t
export const easeOutQuad:   EasingFn = (t) => t * (2 - t)
export const easeInOutQuad: EasingFn = (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t

// --- Cubic ---
export const easeInCubic:    EasingFn = (t) => t * t * t
export const easeOutCubic:   EasingFn = (t) => (--t) * t * t + 1
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1

// --- Quartic ---
export const easeInQuart:    EasingFn = (t) => t * t * t * t
export const easeOutQuart:   EasingFn = (t) => 1 - (--t)*t*t*t
export const easeInOutQuart: EasingFn = (t) =>
  t < 0.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t

// --- Sine — Blender: SINE ---
export const easeInSine:    EasingFn = (t) => 1 - Math.cos(t * Math.PI / 2)
export const easeOutSine:   EasingFn = (t) => Math.sin(t * Math.PI / 2)
export const easeInOutSine: EasingFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2

// --- Exponential — Blender: EXPO ---
export const easeInExpo:    EasingFn = (t) => t === 0 ? 0 : Math.pow(2, 10*t - 10)
export const easeOutExpo:   EasingFn = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10*t)
export const easeInOutExpo: EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 :
  t < 0.5 ? Math.pow(2, 20*t - 10) / 2 : (2 - Math.pow(2, -20*t + 10)) / 2

// --- Circular — Blender: CIRC ---
export const easeInCirc:    EasingFn = (t) => 1 - Math.sqrt(1 - t*t)
export const easeOutCirc:   EasingFn = (t) => Math.sqrt(1 - (--t)*t)
export const easeInOutCirc: EasingFn = (t) =>
  t < 0.5
    ? (1 - Math.sqrt(1 - 4*t*t)) / 2
    : (Math.sqrt(1 - (-2*t+2)*(-2*t+2)) + 1) / 2

// --- Elastic — Blender: ELASTIC ---
const c4 = (2 * Math.PI) / 3
const c5 = (2 * Math.PI) / 4.5
export const easeInElastic:    EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10*t-10) * Math.sin((t*10-10.75)*c4)
export const easeOutElastic:   EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10*t) * Math.sin((t*10-0.75)*c4) + 1
export const easeInOutElastic: EasingFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 :
  t < 0.5
    ? -(Math.pow(2, 20*t-10) * Math.sin((20*t-11.125)*c5)) / 2
    : (Math.pow(2, -20*t+10) * Math.sin((20*t-11.125)*c5)) / 2 + 1

// --- Back — Blender: BACK ---
const c1 = 1.70158
const c2 = c1 * 1.525
const c3 = c1 + 1
export const easeInBack:    EasingFn = (t) => c3*t*t*t - c1*t*t
export const easeOutBack:   EasingFn = (t) => 1 + c3*(--t)*t*t + c1*t*t
export const easeInOutBack: EasingFn = (t) =>
  t < 0.5
    ? (Math.pow(2*t, 2) * ((c2+1)*2*t - c2)) / 2
    : (Math.pow(2*t-2, 2) * ((c2+1)*(t*2-2) + c2) + 2) / 2

// --- Bounce — Blender: BOUNCE ---
function bounceOut(t: number): number {
  const n1 = 7.5625, d1 = 2.75
  if (t < 1/d1)       return n1*t*t
  if (t < 2/d1)       return n1*(t-=1.5/d1)*t   + 0.75
  if (t < 2.5/d1)     return n1*(t-=2.25/d1)*t  + 0.9375
                       return n1*(t-=2.625/d1)*t + 0.984375
}
export const easeInBounce:    EasingFn = (t) => 1 - bounceOut(1-t)
export const easeOutBounce:   EasingFn = bounceOut
export const easeInOutBounce: EasingFn = (t) =>
  t < 0.5 ? (1 - bounceOut(1-2*t)) / 2 : (1 + bounceOut(2*t-1)) / 2

/** Named easing registry — matches Blender F-Curve Interpolation names where possible. */
export const Easings: Record<string, EasingFn> = {
  linear,
  constant,
  easeInQuad,    easeOutQuad,    easeInOutQuad,
  easeInCubic,   easeOutCubic,   easeInOutCubic,
  easeInQuart,   easeOutQuart,   easeInOutQuart,
  easeInSine,    easeOutSine,    easeInOutSine,
  easeInExpo,    easeOutExpo,    easeInOutExpo,
  easeInCirc,    easeOutCirc,    easeInOutCirc,
  easeInElastic, easeOutElastic, easeInOutElastic,
  easeInBack,    easeOutBack,    easeInOutBack,
  easeInBounce,  easeOutBounce,  easeInOutBounce,
  // Blender aliases
  LINEAR:   linear,
  CONSTANT: constant,
  BEZIER:   easeInOutCubic,
  SINE:     easeInOutSine,
  EXPO:     easeInOutExpo,
  CIRC:     easeInOutCirc,
  BOUNCE:   easeOutBounce,
  ELASTIC:  easeOutElastic,
  BACK:     easeOutBack,
}
