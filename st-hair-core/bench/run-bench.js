import { BufferGeometry, BufferAttribute } from 'three'
import {
  HairSystem, StrandGenerator,
  applyKink, applyClump,
} from '../dist/index.js'

function bench(label, fn, runs = 50) {
  fn() // warmup
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) fn()
  const ms = (performance.now() - t0) / runs
  console.log(`  ${label}: ${ms.toFixed(3)} ms/call`)
  return ms
}

// ── Test mesh: UV sphere r=1, 16 segs, 8 rings ─────────────────────────────
function makeSphere(segs = 16, rings = 8, r = 1) {
  const pos = [], nor = [], idx = []
  for (let i = 0; i <= rings; i++) {
    const phi = i / rings * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi)
    for (let j = 0; j <= segs; j++) {
      const th = j / segs * Math.PI * 2
      const x = Math.cos(th) * sp, y = cp, z = Math.sin(th) * sp
      pos.push(x*r, y*r, z*r); nor.push(x, y, z)
    }
  }
  const cols = segs + 1
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i*cols+j, b = a+cols
    idx.push(a, b, a+1, b, b+1, a+1)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal',   new BufferAttribute(new Float32Array(nor), 3))
  geo.setIndex(idx)
  return geo
}

const sphereGeo = makeSphere()

console.log('\nst-hair-core benchmark — 2026-05-26')
console.log('=====================================')

// ── StrandGenerator ──────────────────────────────────────────────────────────
console.log('\nStrandGenerator.generate()')
const gen100  = new StrandGenerator({ count: 100,  length: 0.5, segments: 6 })
const gen500  = new StrandGenerator({ count: 500,  length: 0.5, segments: 6 })
const gen2000 = new StrandGenerator({ count: 2000, length: 0.5, segments: 6 })
const t_gen100  = bench('100 strands  × 6 seg', () => gen100.generate(sphereGeo))
const t_gen500  = bench('500 strands  × 6 seg', () => gen500.generate(sphereGeo))
const t_gen2000 = bench('2000 strands × 6 seg', () => gen2000.generate(sphereGeo))

// ── applyKink ────────────────────────────────────────────────────────────────
console.log('\napplyKink (WAVE, per-strand)')
const strands500  = gen500.generate(sphereGeo)
const strands2000 = gen2000.generate(sphereGeo)
const t_kink500  = bench('500 strands WAVE',  () => strands500.map(s  => applyKink(s, { type:'WAVE', amplitude:0.05, frequency:3 })))
const t_kink2000 = bench('2000 strands WAVE', () => strands2000.map(s => applyKink(s, { type:'WAVE', amplitude:0.05, frequency:3 })))

// ── HairSystem.build() — tube ────────────────────────────────────────────────
console.log('\nHairSystem.build() — tube mode (steps=8, crossSections=4)')
const hair500  = new HairSystem({ mode:'tube', steps:8, crossSections:4, radiusRoot:0.01, radiusTip:0.002 })
const hair2000 = new HairSystem({ mode:'tube', steps:8, crossSections:4, radiusRoot:0.01, radiusTip:0.002 })
hair500.setStrands(strands500)
hair2000.setStrands(strands2000)
const t_tube500  = bench('500 strands', () => hair500.build())
const t_tube2000 = bench('2000 strands', () => hair2000.build())

// ── HairSystem.build() — ribbon ──────────────────────────────────────────────
console.log('\nHairSystem.build() — ribbon mode (steps=8)')
const rib500  = new HairSystem({ mode:'ribbon', steps:8, widthRoot:0.02, widthTip:0.004 })
const rib2000 = new HairSystem({ mode:'ribbon', steps:8, widthRoot:0.02, widthTip:0.004 })
rib500.setStrands(strands500)
rib2000.setStrands(strands2000)
const t_rib500  = bench('500 strands',  () => rib500.build())
const t_rib2000 = bench('2000 strands', () => rib2000.build())

// ── HairSystem.build() — line ────────────────────────────────────────────────
console.log('\nHairSystem.build() — line mode (steps=8)')
const line500  = new HairSystem({ mode:'line', steps:8 })
const line2000 = new HairSystem({ mode:'line', steps:8 })
line500.setStrands(strands500)
line2000.setStrands(strands2000)
const t_line500  = bench('500 strands',  () => line500.build())
const t_line2000 = bench('2000 strands', () => line2000.build())

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\nSummary')
console.log('-------')
console.log(`Generate 2000 strands: ${t_gen2000.toFixed(2)} ms`)
console.log(`Kink 2000 strands:     ${t_kink2000.toFixed(2)} ms`)
console.log(`Build tube 2000×8s×4c: ${t_tube2000.toFixed(2)} ms`)
console.log(`Build ribbon 2000×8s:  ${t_rib2000.toFixed(2)} ms`)
console.log(`Build line 2000×8s:    ${t_line2000.toFixed(2)} ms`)

const budget = 16
const total = t_gen2000 + t_kink2000 + t_tube2000
console.log(`\nFull pipeline (2000 strands, tube): ${total.toFixed(2)} ms  [budget: ${budget} ms per frame]`)
if (total < budget) console.log('  ✓ within 16 ms budget')
else console.log('  ✗ EXCEEDS 16 ms budget')
