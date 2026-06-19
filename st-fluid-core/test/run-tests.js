// st-fluid-core tests — plain Node.js, no framework
import assert from 'node:assert/strict'
import { FLIPSimulator } from '../dist/FLIPSimulator.js'
import { MACGrid }        from '../dist/MACGrid.js'
import { SPHSimulator }   from '../dist/SPHSimulator.js'
import { FluidEmitter }   from '../dist/FluidEmitter.js'
import { MarchingCubes }  from '../dist/MarchingCubes.js'

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++ }
  catch(e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++ }
}

// ── MACGrid ───────────────────────────────────────────────────────────────────
console.log('\nMACGrid')

test('constructs with correct dimensions', () => {
  const g = new MACGrid(8, 8, 8, 0.25)
  assert.equal(g.nx, 8)
  assert.equal(g.ny, 8)
  assert.equal(g.nz, 8)
  assert.equal(g.h, 0.25)
})

test('u array has size (nx+1)*ny*nz', () => {
  const g = new MACGrid(4, 4, 4, 0.5)
  assert.equal(g.u.length, 5 * 4 * 4)
})

test('v array has size nx*(ny+1)*nz', () => {
  const g = new MACGrid(4, 4, 4, 0.5)
  assert.equal(g.v.length, 4 * 5 * 4)
})

test('clearVelocities zeros all velocity arrays', () => {
  const g = new MACGrid(4, 4, 4, 0.5)
  g.u.fill(1); g.v.fill(1); g.w.fill(1)
  g.clearVelocities()
  assert.equal(g.u[0], 0)
  assert.equal(g.v[0], 0)
})

test('applyGravity increases v velocity downward', () => {
  const g = new MACGrid(4, 4, 4, 0.5)
  g.applyGravity(0, -9.8, 0, 1/60)
  assert.ok(g.v[g.vIdx(1, 1, 1)] < 0, 'v should be negative after downward gravity')
})

test('enforceBoundary zeros boundary faces', () => {
  const g = new MACGrid(4, 4, 4, 0.5)
  g.u.fill(5)
  g.enforceBoundary()
  assert.equal(g.u[g.uIdx(0, 1, 1)], 0, 'left u-face should be zero')
  assert.equal(g.u[g.uIdx(4, 1, 1)], 0, 'right u-face should be zero')
})

test('markCells sets fluid cells correctly', () => {
  const g = new MACGrid(6, 6, 6, 0.25)
  g.markCells((i, j, _k) => i === 3 && j === 3)
  assert.equal(g.cellType[g.idx(3, 3, 3)], 1, 'center cell should be fluid')
  assert.equal(g.cellType[g.idx(0, 0, 0)], 2, 'corner cell should be solid')
})

test('interpU returns 0 in empty grid', () => {
  const g = new MACGrid(8, 8, 8, 0.25, -1, -1, -1)
  assert.equal(g.interpU(0, 0, 0), 0)
})

// ── FLIPSimulator ─────────────────────────────────────────────────────────────
console.log('\nFLIPSimulator')

test('constructs with defaults', () => {
  const sim = new FLIPSimulator()
  assert.equal(sim.parameters.flipRatio, 0.95)
  assert.equal(sim.parameters.gravityY, -9.8)
  assert.equal(sim.particleCount, 2000)
})

test('constructs with custom options', () => {
  const sim = new FLIPSimulator({ resolution: 12, particleCount: 500, flipRatio: 0.8 })
  assert.equal(sim.particleCount, 500)
  assert.equal(sim.parameters.flipRatio, 0.8)
})

test('fillBox populates particles', () => {
  const sim = new FLIPSimulator({ resolution: 12, particleCount: 200 })
  sim.fillBox(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
  assert.ok(sim.liveCount > 0, 'should have particles after fillBox')
  assert.ok(sim.liveCount <= sim.particleCount, 'should not exceed particleCount')
})

test('getPositions returns Float32Array of correct length', () => {
  const sim = new FLIPSimulator({ resolution: 10, particleCount: 100 })
  sim.fillBox(-0.4, -0.4, -0.4, 0.4, 0.4, 0.4)
  const pos = sim.getPositions()
  assert.ok(pos instanceof Float32Array)
  assert.equal(pos.length, sim.liveCount * 3)
})

test('getVelocities returns Float32Array', () => {
  const sim = new FLIPSimulator({ resolution: 10, particleCount: 100 })
  sim.fillBox(-0.4, -0.4, -0.4, 0.4, 0.4, 0.4)
  const vel = sim.getVelocities()
  assert.ok(vel instanceof Float32Array)
  assert.equal(vel.length, sim.liveCount * 3)
})

test('step does not throw', () => {
  const sim = new FLIPSimulator({ resolution: 10, particleCount: 200, substeps: 1 })
  sim.fillBox(-0.4, -0.4, -0.4, 0.4, 0.4, 0.4)
  assert.doesNotThrow(() => sim.step(1/60))
})

test('particles fall under gravity after step', () => {
  const sim = new FLIPSimulator({ resolution: 14, particleCount: 300, substeps: 2 })
  sim.fillBox(-0.3, 0.2, -0.3, 0.3, 0.6, 0.3)
  const before = sim.getPositions()
  const avgY0 = before.reduce((s, v, i) => i % 3 === 1 ? s + v : s, 0) / sim.liveCount

  for (let i = 0; i < 20; i++) sim.step(1/60)

  const after = sim.getPositions()
  const avgY1 = after.reduce((s, v, i) => i % 3 === 1 ? s + v : s, 0) / sim.liveCount
  assert.ok(avgY1 < avgY0, `particles should fall: before=${avgY0.toFixed(3)} after=${avgY1.toFixed(3)}`)
})

test('particles stay inside domain after many steps', () => {
  const sim = new FLIPSimulator({ resolution: 12, particleCount: 100, substeps: 1,
    origin: [-1, -1, -1], domainSize: 2 })
  sim.fillBox(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
  for (let i = 0; i < 60; i++) sim.step(1/60)
  const pos = sim.getPositions()
  for (let i = 0; i < pos.length; i += 3) {
    assert.ok(pos[i]   >= -1.1 && pos[i]   <= 1.1, `X out of domain: ${pos[i]}`)
    assert.ok(pos[i+1] >= -1.1 && pos[i+1] <= 1.1, `Y out of domain: ${pos[i+1]}`)
    assert.ok(pos[i+2] >= -1.1 && pos[i+2] <= 1.1, `Z out of domain: ${pos[i+2]}`)
  }
})

test('positions change after step (simulation is live)', () => {
  const sim = new FLIPSimulator({ resolution: 12, particleCount: 100, substeps: 1 })
  sim.fillBox(-0.4, 0.1, -0.4, 0.4, 0.5, 0.4)
  const before = sim.getPositions().slice()
  for (let i = 0; i < 5; i++) sim.step(1/60)
  const after = sim.getPositions()
  let changed = false
  for (let i = 0; i < after.length; i++) {
    if (Math.abs(after[i] - before[i]) > 1e-6) { changed = true; break }
  }
  assert.ok(changed, 'particle positions should change after stepping')
})

test('grid is accessible via sim.grid', () => {
  const sim = new FLIPSimulator({ resolution: 8, particleCount: 50 })
  assert.ok(sim.grid instanceof MACGrid)
  assert.equal(sim.grid.nx, 8)
})

test('parameters are mutable at runtime', () => {
  const sim = new FLIPSimulator({ resolution: 8, particleCount: 50 })
  sim.parameters.flipRatio = 0.5
  sim.parameters.gravityY  = -4.9
  assert.equal(sim.parameters.flipRatio, 0.5)
  assert.equal(sim.parameters.gravityY,  -4.9)
})

test('pure PIC (flipRatio=0) stays stable', () => {
  const sim = new FLIPSimulator({ resolution: 10, particleCount: 80, substeps: 1 })
  sim.parameters.flipRatio = 0
  sim.fillBox(-0.4, -0.4, -0.4, 0.4, 0.4, 0.4)
  assert.doesNotThrow(() => { for (let i = 0; i < 30; i++) sim.step(1/60) })
})

// ── SPHSimulator ─────────────────────────────────────────────────────────────
console.log('\nSPHSimulator')

test('constructs with defaults', () => {
  const s = new SPHSimulator()
  assert.equal(s.particleCount, 500)
  assert.equal(s.parameters.smoothingRadius, 0.3)
  assert.equal(s.parameters.restDensity, 1000)
})

test('constructs with custom options', () => {
  const s = new SPHSimulator({ particleCount: 100, smoothingRadius: 0.2, viscosity: 0.5 })
  assert.equal(s.particleCount, 100)
  assert.equal(s.parameters.smoothingRadius, 0.2)
  assert.equal(s.parameters.viscosity, 0.5)
})

test('setPositions updates particle locations', () => {
  const s = new SPHSimulator({ particleCount: 3 })
  s.setPositions([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const geo = s.getGeometry()
  const pos = geo.getAttribute('position')
  assert.equal(pos.getX(0), 1)
  assert.equal(pos.getY(0), 2)
  assert.equal(pos.getZ(0), 3)
})

test('getGeometry returns correct particle count', () => {
  const s = new SPHSimulator({ particleCount: 50 })
  const geo = s.getGeometry()
  assert.equal(geo.getAttribute('position').count, 50)
})

test('step advances simulation time', () => {
  const s = new SPHSimulator({ particleCount: 20 })
  s.step(1/60)
  assert.ok(s.time > 0)
})

test('particles fall under gravity', () => {
  const s = new SPHSimulator({ particleCount: 10, substeps: 1 })
  const before = s.getGeometry().getAttribute('position').getY(0)
  for (let i = 0; i < 30; i++) s.step(1/60)
  const after = s.getGeometry().getAttribute('position').getY(0)
  assert.ok(after <= before, 'particles should fall under gravity')
})

test('domain boundary enforces containment', () => {
  const s = new SPHSimulator({ particleCount: 5, substeps: 1 })
  s.setDomain([-1,-1,-1],[1,1,1])
  s.setPositions([0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0])
  for (let i = 0; i < 100; i++) s.step(1/30)
  const geo = s.getGeometry()
  const pos = geo.getAttribute('position')
  for (let i = 0; i < 5; i++) {
    assert.ok(pos.getX(i) >= -1.1 && pos.getX(i) <= 1.1, `particle ${i} X out of domain`)
    assert.ok(pos.getY(i) >= -1.1 && pos.getY(i) <= 1.1, `particle ${i} Y out of domain`)
  }
})

test('getDensity returns positive value after step', () => {
  const s = new SPHSimulator({ particleCount: 50 })
  s.step(1/60)
  const d = s.getDensity(0)
  assert.ok(d > 0, `density should be positive, got ${d}`)
})

test('updateGeometry mutates existing geometry', () => {
  const s = new SPHSimulator({ particleCount: 10 })
  const geo = s.getGeometry()
  const pos = geo.getAttribute('position')
  const y0  = pos.getY(0)
  for (let i = 0; i < 10; i++) s.step(1/60)
  s.updateGeometry(geo)
  const y1 = pos.getY(0)
  assert.ok(y1 !== y0, 'position should change after step + updateGeometry')
})

// ── SPH viscosity modes ───────────────────────────────────────────────────────
console.log('\nSPH viscosity modes')

test('viscosityType defaults to standard', () => {
  const s = new SPHSimulator()
  assert.equal(s.viscosityType, 'standard')
})

test('viscosityType xsph can be set at construction', () => {
  const s = new SPHSimulator({ viscosityType: 'xsph' })
  assert.equal(s.viscosityType, 'xsph')
})

test('viscosityType stiff can be set at construction', () => {
  const s = new SPHSimulator({ viscosityType: 'stiff' })
  assert.equal(s.viscosityType, 'stiff')
})

test('xsph mode step does not throw', () => {
  const s = new SPHSimulator({ particleCount: 20, substeps: 1, viscosityType: 'xsph' })
  assert.doesNotThrow(() => s.step(1/60))
})

test('stiff mode step does not throw', () => {
  const s = new SPHSimulator({ particleCount: 20, substeps: 1, viscosityType: 'stiff' })
  assert.doesNotThrow(() => s.step(1/60))
})

test('xsph mode particles fall under gravity', () => {
  const s = new SPHSimulator({ particleCount: 10, substeps: 1, viscosityType: 'xsph' })
  const before = s.getGeometry().getAttribute('position').getY(0)
  for (let i = 0; i < 30; i++) s.step(1/60)
  const after = s.getGeometry().getAttribute('position').getY(0)
  assert.ok(after <= before, 'xsph particles should fall under gravity')
})

test('stiff mode particles fall under gravity', () => {
  const s = new SPHSimulator({ particleCount: 10, substeps: 1, viscosityType: 'stiff' })
  const before = s.getGeometry().getAttribute('position').getY(0)
  for (let i = 0; i < 30; i++) s.step(1/60)
  const after = s.getGeometry().getAttribute('position').getY(0)
  assert.ok(after <= before, 'stiff particles should fall under gravity')
})

test('xsphFactor and stiffFactor are in parameters', () => {
  const s = new SPHSimulator()
  assert.ok('xsphFactor'  in s.parameters)
  assert.ok('stiffFactor' in s.parameters)
})

test('viscosityType can be changed at runtime', () => {
  const s = new SPHSimulator({ particleCount: 10 })
  s.viscosityType = 'xsph'
  assert.doesNotThrow(() => s.step(1/60))
  s.viscosityType = 'stiff'
  assert.doesNotThrow(() => s.step(1/60))
  s.viscosityType = 'standard'
  assert.doesNotThrow(() => s.step(1/60))
})

// ── FluidEmitter ──────────────────────────────────────────────────────────────
console.log('\nFluidEmitter')

test('constructs with defaults', () => {
  const e = new FluidEmitter()
  assert.equal(e.parameters.radius, 0.5)
  assert.equal(e.parameters.velX, 0)
  assert.ok(e.enabled)
})

test('samplePosition lies within radius', () => {
  const e = new FluidEmitter({ position: [5, 5, 5], radius: 1 })
  for (let i = 0; i < 20; i++) {
    const [x, y, z] = e.samplePosition()
    const dx = x - 5, dy = y - 5, dz = z - 5
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
    assert.ok(dist <= 1.001, `sample outside radius: ${dist}`)
  }
})

test('sampleVelocity includes jitter', () => {
  const e = new FluidEmitter({ velocity: [1, 0, 0], jitter: 0.5 })
  let allSame = true
  const first = e.sampleVelocity()
  for (let i = 0; i < 10; i++) {
    const v = e.sampleVelocity()
    if (v[0] !== first[0]) allSame = false
  }
  assert.ok(!allSame, 'jitter should vary velocity samples')
})

// ── MarchingCubes ─────────────────────────────────────────────────────────────
console.log('\nMarchingCubes')

test('constructs with defaults', () => {
  const mc = new MarchingCubes()
  assert.equal(mc.parameters.resolution, 32)
  assert.equal(mc.parameters.isoLevel, 0.5)
})

test('extract returns null without field', () => {
  const mc = new MarchingCubes()
  assert.equal(mc.extract(), null)
})

test('extract returns geometry with field', () => {
  const mc = new MarchingCubes({ resolution: 8 })
  mc.setBounds([-1,-1,-1],[1,1,1])
  // Half-space: x < 0 inside. Guaranteed to produce surface triangles.
  mc.setField((x, _y, _z) => x < 0 ? 1 : 0)
  const geo = mc.extract()
  assert.ok(geo !== null)
  assert.ok(geo.getAttribute('position').count > 0)
})

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
