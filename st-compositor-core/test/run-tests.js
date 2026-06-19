/**
 * Test suite for @st-compositor-core.
 * Runs in Node.js (ESM) — no DOM / WebGL required.
 * Tests construction, parameters, dependency declarations, and backend errors.
 */

import assert from 'assert'
import {
  BasePass,
  Bloom, DepthOfField, Blur, ChromaticAberration,
  Vignette, FilmGrain, ColorBalance, HueSaturation,
  BrightnessContrast, Gamma, Exposure, Mix, Pixelate, Sharpen,
  AlphaOver, SetAlpha, ZCombine, SeparateRGBA, CombineRGBA, SSAO, SSR,
} from '../dist/index.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

// ── All pass classes ──────────────────────────────────────────────────────────

const ALL_PASSES = [
  ['Bloom',               () => new Bloom()],
  ['DepthOfField',        () => new DepthOfField()],
  ['Blur',                () => new Blur()],
  ['ChromaticAberration', () => new ChromaticAberration()],
  ['Vignette',            () => new Vignette()],
  ['FilmGrain',           () => new FilmGrain()],
  ['ColorBalance',        () => new ColorBalance()],
  ['HueSaturation',       () => new HueSaturation()],
  ['BrightnessContrast',  () => new BrightnessContrast()],
  ['Gamma',               () => new Gamma()],
  ['Exposure',            () => new Exposure()],
  ['Mix',                 () => new Mix()],
  ['Pixelate',            () => new Pixelate()],
  ['Sharpen',             () => new Sharpen()],
]

// ── Construction & parameters ─────────────────────────────────────────────────

console.log('\nConstruction & parameters')

for (const [name, make] of ALL_PASSES) {
  test(`${name} — constructs with defaults`, () => {
    const p = make()
    assert.ok(p instanceof BasePass, 'should extend BasePass')
    assert.ok(typeof p.parameters === 'object', 'should have parameters object')
    assert.strictEqual(p.enabled, true, 'should be enabled by default')
    assert.strictEqual(typeof p.passType, 'string', 'passType should be string')
  })

  test(`${name} — parameters are plain numbers`, () => {
    const p = make()
    for (const [key, val] of Object.entries(p.parameters)) {
      assert.strictEqual(typeof val, 'number', `parameters.${key} should be number, got ${typeof val}`)
    }
  })
}

// ── Custom constructor options ────────────────────────────────────────────────

console.log('\nCustom constructor options')

test('Bloom — accepts custom options', () => {
  const b = new Bloom({ threshold: 0.3, strength: 2.5, radius: 0.7 })
  assert.strictEqual(b.parameters.threshold, 0.3)
  assert.strictEqual(b.parameters.strength,  2.5)
  assert.strictEqual(b.parameters.radius,    0.7)
})

test('Blur — accepts custom radius', () => {
  const b = new Blur({ radius: 10, x: 0.5, y: 0.5 })
  assert.strictEqual(b.parameters.radius, 10)
  assert.strictEqual(b.parameters.x, 0.5)
  assert.strictEqual(b.parameters.y, 0.5)
})

test('ChromaticAberration — accepts custom offset', () => {
  const c = new ChromaticAberration({ offset: 0.01 })
  assert.strictEqual(c.parameters.offset, 0.01)
})

test('Vignette — accepts custom darkness and offset', () => {
  const v = new Vignette({ darkness: 0.9, offset: 0.8 })
  assert.strictEqual(v.parameters.darkness, 0.9)
  assert.strictEqual(v.parameters.offset,   0.8)
})

test('FilmGrain — greyscale converts to number', () => {
  const f = new FilmGrain({ intensity: 0.6, greyscale: true })
  assert.strictEqual(f.parameters.greyscale, 1)
  assert.strictEqual(f.parameters.intensity, 0.6)
})

test('ColorBalance — accepts lift/gamma/gain per channel', () => {
  const c = new ColorBalance({ liftR: 0.1, gammaG: 1.2, gainB: 0.8 })
  assert.strictEqual(c.parameters.liftR,  0.1)
  assert.strictEqual(c.parameters.gammaG, 1.2)
  assert.strictEqual(c.parameters.gainB,  0.8)
  // Unspecified channels should be defaults
  assert.strictEqual(c.parameters.liftG,  0)
  assert.strictEqual(c.parameters.gammaR, 1)
})

test('HueSaturation — accepts all options', () => {
  const h = new HueSaturation({ hue: 0.7, saturation: 2.0, value: 0.8, fac: 0.5 })
  assert.strictEqual(h.parameters.hue,        0.7)
  assert.strictEqual(h.parameters.saturation, 2.0)
  assert.strictEqual(h.parameters.value,      0.8)
  assert.strictEqual(h.parameters.fac,        0.5)
})

test('BrightnessContrast — accepts brightness and contrast', () => {
  const b = new BrightnessContrast({ brightness: 0.2, contrast: 0.5 })
  assert.strictEqual(b.parameters.brightness, 0.2)
  assert.strictEqual(b.parameters.contrast,   0.5)
})

test('Gamma — accepts gamma value', () => {
  const g = new Gamma({ gamma: 2.2 })
  assert.strictEqual(g.parameters.gamma, 2.2)
})

test('Exposure — accepts EV stops', () => {
  const e = new Exposure({ exposure: -1 })
  assert.strictEqual(e.parameters.exposure, -1)
})

test('Mix — accepts fac', () => {
  const m = new Mix({ fac: 0.3 })
  assert.strictEqual(m.parameters.fac, 0.3)
})

test('Pixelate — accepts pixelSize', () => {
  const p = new Pixelate({ pixelSize: 16 })
  assert.strictEqual(p.parameters.pixelSize, 16)
})

test('Sharpen — accepts intensity', () => {
  const s = new Sharpen({ intensity: 0.9 })
  assert.strictEqual(s.parameters.intensity, 0.9)
})

// ── Runtime parameter mutation ────────────────────────────────────────────────

console.log('\nRuntime parameter mutation (GSAP compatibility)')

test('parameters are directly mutable', () => {
  const b = new Bloom({ strength: 1.0 })
  b.parameters.strength = 3.0
  assert.strictEqual(b.parameters.strength, 3.0)
})

test('enabled flag is mutable', () => {
  const b = new Blur()
  b.enabled = false
  assert.strictEqual(b.enabled, false)
})

// ── _threePassDeps ────────────────────────────────────────────────────────────

console.log('\n_threePassDeps declarations')

test('Bloom declares UnrealBloomPass', () => {
  assert.ok(new Bloom()._threePassDeps().includes('UnrealBloomPass'))
})

test('DepthOfField declares BokehPass', () => {
  assert.ok(new DepthOfField()._threePassDeps().includes('BokehPass'))
})

test('FilmGrain declares FilmPass', () => {
  assert.ok(new FilmGrain()._threePassDeps().includes('FilmPass'))
})

test('ShaderPass-based passes declare ShaderPass', () => {
  const shaderPasses = [
    new Blur(), new ChromaticAberration(), new Vignette(),
    new ColorBalance(), new HueSaturation(), new BrightnessContrast(),
    new Gamma(), new Exposure(), new Mix(), new Pixelate(), new Sharpen(),
  ]
  for (const p of shaderPasses) {
    assert.ok(
      p._threePassDeps().includes('ShaderPass'),
      `${p.passType} should declare ShaderPass`
    )
  }
})

// ── pmndrs _isPmndrsEffect ────────────────────────────────────────────────────

console.log('\npmndrs effect flags')

test('Bloom is a pmndrs effect', ()  => assert.strictEqual(new Bloom()._isPmndrsEffect, true))
test('Vignette is a pmndrs effect',  () => assert.strictEqual(new Vignette()._isPmndrsEffect, true))
test('Pixelate is a pmndrs effect',  () => assert.strictEqual(new Pixelate()._isPmndrsEffect, true))
test('Exposure is a pmndrs effect',  () => assert.strictEqual(new Exposure()._isPmndrsEffect, true))
test('Blur is NOT a pmndrs effect (ShaderPass-only)', () => assert.strictEqual(new Blur()._isPmndrsEffect, false))
test('ColorBalance is NOT a pmndrs effect', () => assert.strictEqual(new ColorBalance()._isPmndrsEffect, false))

// ── _buildThree with empty registry throws clear error ────────────────────────

console.log('\n_buildThree error handling')

test('Bloom throws clear error when UnrealBloomPass missing', () => {
  assert.throws(
    () => new Bloom()._buildThree(1920, 1080, {}),
    /UnrealBloomPass not found/
  )
})

test('DepthOfField throws clear error when BokehPass missing', () => {
  assert.throws(
    () => new DepthOfField()._buildThree(1920, 1080, {}),
    /BokehPass not found/
  )
})

test('Blur throws clear error when ShaderPass missing', () => {
  assert.throws(
    () => new Blur()._buildThree(1920, 1080, {}),
    /ShaderPass not found/
  )
})

// ── _buildPmndrs default throws for unsupported passes ───────────────────────

console.log('\n_buildPmndrs default behaviour')

test('Mix._buildPmndrs throws — not a pmndrs effect', () => {
  assert.throws(() => new Mix()._buildPmndrs({}), /pmndrs backend is not supported/)
})

test('ColorBalance._buildPmndrs throws — not a pmndrs effect', () => {
  assert.throws(() => new ColorBalance()._buildPmndrs({}), /pmndrs backend is not supported/)
})

test('Bloom._buildPmndrs throws clear error when BloomEffect missing from registry', () => {
  assert.throws(() => new Bloom()._buildPmndrs({}), /BloomEffect not found/)
})

// ── Phase 2 — Compositing operations ─────────────────────────────────────────

console.log('\nPhase 2 — Compositing operations')

test('AlphaOver constructs with defaults', () => {
  const p = new AlphaOver()
  assert.strictEqual(p.passType, 'AlphaOver')
  assert.strictEqual(p.parameters.fac, 1.0)
  assert.strictEqual(p.parameters.bgR, 0)
})

test('AlphaOver respects background colour', () => {
  const p = new AlphaOver({ background: '#ff0000' })
  assert(Math.abs(p.parameters.bgR - 1.0) < 0.01)
  assert(Math.abs(p.parameters.bgG) < 0.01)
})

test('AlphaOver _threePassDeps returns ShaderPass', () => {
  assert.deepStrictEqual(new AlphaOver()._threePassDeps(), ['ShaderPass'])
})

test('AlphaOver _buildThree throws when ShaderPass missing', () => {
  assert.throws(() => new AlphaOver()._buildThree(1, 1, {}), /ShaderPass not found/)
})

test('SetAlpha constructs with defaults', () => {
  const p = new SetAlpha()
  assert.strictEqual(p.passType, 'SetAlpha')
  assert.strictEqual(p.parameters.alpha, 1.0)
})

test('SetAlpha custom alpha', () => {
  assert.strictEqual(new SetAlpha({ alpha: 0.5 }).parameters.alpha, 0.5)
})

test('SetAlpha _threePassDeps returns ShaderPass', () => {
  assert.deepStrictEqual(new SetAlpha()._threePassDeps(), ['ShaderPass'])
})

test('ZCombine constructs with defaults', () => {
  const p = new ZCombine()
  assert.strictEqual(p.passType, 'ZCombine')
  assert.strictEqual(p.parameters.split, 0.5)
  assert.strictEqual(p.parameters.softness, 0.1)
})

test('ZCombine _buildThree throws when ShaderPass missing', () => {
  assert.throws(() => new ZCombine()._buildThree(1, 1, {}), /ShaderPass not found/)
})

test('SeparateRGBA constructs with defaults', () => {
  const p = new SeparateRGBA()
  assert.strictEqual(p.passType, 'SeparateRGBA')
  assert.strictEqual(p.parameters.channel, 0)
})

test('SeparateRGBA respects channel option', () => {
  assert.strictEqual(new SeparateRGBA({ channel: 2 }).parameters.channel, 2)
})

test('SeparateRGBA _buildThree throws when ShaderPass missing', () => {
  assert.throws(() => new SeparateRGBA()._buildThree(1, 1, {}), /ShaderPass not found/)
})

test('CombineRGBA constructs with defaults', () => {
  const p = new CombineRGBA()
  assert.strictEqual(p.passType, 'CombineRGBA')
  assert.strictEqual(p.parameters.r, 1.0)
  assert.strictEqual(p.parameters.alpha, 1.0)
})

test('CombineRGBA custom channel gains', () => {
  const p = new CombineRGBA({ r: 2.0, g: 0.5, b: 0.0, alpha: 0.8 })
  assert.strictEqual(p.parameters.r, 2.0)
  assert.strictEqual(p.parameters.b, 0.0)
})

test('CombineRGBA _buildThree throws when ShaderPass missing', () => {
  assert.throws(() => new CombineRGBA()._buildThree(1, 1, {}), /ShaderPass not found/)
})

// ── Phase 3 — Advanced passes ─────────────────────────────────────────────────

console.log('\nPhase 3 — Advanced passes')

test('SSAO constructs with defaults', () => {
  const p = new SSAO()
  assert.strictEqual(p.passType, 'SSAO')
  assert.strictEqual(p.parameters.radius, 0.5)
  assert.strictEqual(p.parameters.minDistance, 0.005)
})

test('SSAO _threePassDeps returns SSAOPass', () => {
  assert.deepStrictEqual(new SSAO()._threePassDeps(), ['SSAOPass'])
})

test('SSAO _buildThree throws when SSAOPass missing', () => {
  assert.throws(() => new SSAO()._buildThree(1, 1, {}), /SSAOPass not found/)
})

test('SSAO _buildThree throws when scene missing', () => {
  assert.throws(() => new SSAO()._buildThree(1, 1, { SSAOPass: class {} }), /scene not provided/)
})

test('SSR constructs with defaults', () => {
  const p = new SSR()
  assert.strictEqual(p.passType, 'SSR')
  assert.strictEqual(p.parameters.maxDistance, 180)
  assert.strictEqual(p.parameters.opacity, 0.5)
  assert.strictEqual(p.parameters.maxRoughness, 0.8)
})

test('SSR _threePassDeps returns SSRPass', () => {
  assert.deepStrictEqual(new SSR()._threePassDeps(), ['SSRPass'])
})

test('SSR _buildThree throws when SSRPass missing', () => {
  assert.throws(() => new SSR()._buildThree(1, 1, {}), /SSRPass not found/)
})

test('SSR enabled flag works', () => {
  const p = new SSR()
  p.enabled = false
  assert.strictEqual(p.enabled, false)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
