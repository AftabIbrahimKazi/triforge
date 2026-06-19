import { RadiusParametricGeometry } from '../dist/index.js'

console.log('\n--- PERFORMANCE BENCHMARK ---\n')

const standardOpts = { radiusSegments: 128, heightSegments: 64 }
const optimizedOpts = { radiusSegments: 32, heightSegments: 16 }

const radiusFn = (u, v) => 1 + 0.3 * Math.sin(u * Math.PI * 2)
const heightFn = (u, v) => v - 0.5

// Build standard
const t0 = performance.now()
const standard = new RadiusParametricGeometry(radiusFn, heightFn, standardOpts)
const buildStd = (performance.now() - t0).toFixed(2)

// Build optimized
const t1 = performance.now()
const optimized = new RadiusParametricGeometry(radiusFn, heightFn, optimizedOpts)
const buildOpt = (performance.now() - t1).toFixed(2)

const stdStats = standard.getStats()
const optStats = optimized.getStats()

const triangleReduction = ((1 - optStats.triangleCount / stdStats.triangleCount) * 100).toFixed(1)
const memoryReduction = ((1 - optStats.totalMemory / stdStats.totalMemory) * 100).toFixed(1)

console.log('  Standard  (128x64):')
console.log(`    Triangles : ${stdStats.triangleCount.toLocaleString()}`)
console.log(`    Vertices  : ${stdStats.vertexCount.toLocaleString()}`)
console.log(`    Memory    : ${(stdStats.totalMemory / 1024).toFixed(1)} KB`)
console.log(`    Build time: ${buildStd} ms`)

console.log('\n  Optimized (32x16):')
console.log(`    Triangles : ${optStats.triangleCount.toLocaleString()}`)
console.log(`    Vertices  : ${optStats.vertexCount.toLocaleString()}`)
console.log(`    Memory    : ${(optStats.totalMemory / 1024).toFixed(1)} KB`)
console.log(`    Build time: ${buildOpt} ms`)

console.log(`\n  Triangle reduction : ${triangleReduction}%`)
console.log(`  Memory reduction   : ${memoryReduction}%`)

if (parseFloat(triangleReduction) >= 90) {
  console.log('\n  Performance target met (>=90% reduction)\n')
} else {
  console.log(`\n  WARNING: ${triangleReduction}% is below the 90% target\n`)
}
