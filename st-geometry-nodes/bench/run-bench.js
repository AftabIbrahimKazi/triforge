import {
  Grid, UVSphere, IcoSphere, Cube,
  TransformGeometry, JoinGeometry, SubdivisionSurface,
  DistributePointsOnFaces, InstanceOnPoints,
} from '../dist/index.js'

function bench(name, fn, iters = 500) {
  fn()
  const t0 = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const ms = (performance.now() - t0) / iters
  console.log(`  ${name}: ${ms.toFixed(3)} ms/call`)
}

console.log('\nst-geometry-nodes benchmark\n')

console.log('Primitives — evaluate()')
bench('Grid 100×100',          () => new Grid({ vertsX: 100, vertsY: 100 }).output('Geometry').evaluate())
bench('UVSphere 64×32',        () => new UVSphere({ segments: 64, rings: 32 }).output('Geometry').evaluate())
bench('IcoSphere level 4',     () => new IcoSphere({ subdivisions: 4 }).output('Geometry').evaluate())
bench('Cube',                  () => new Cube().output('Geometry').evaluate())

console.log('\nSubdivision')
bench('IcoSphere level 0 → Sub level 1', () => {
  const ico = new IcoSphere({ subdivisions: 0 })
  const sub = new SubdivisionSurface({ geometry: ico.output('Geometry'), level: 1 })
  sub.output('Geometry').evaluate()
})
bench('IcoSphere level 0 → Sub level 3', () => {
  const ico = new IcoSphere({ subdivisions: 0 })
  const sub = new SubdivisionSurface({ geometry: ico.output('Geometry'), level: 3 })
  sub.output('Geometry').evaluate()
})

console.log('\nInstance on Points')
bench('100 cubes on sphere', () => {
  const sphere = new UVSphere({ segments: 10, rings: 5 })
  const pts    = new DistributePointsOnFaces({ mesh: sphere.output('Geometry'), count: 100 })
  const inst   = new Cube({ size: 0.1 })
  const iop    = new InstanceOnPoints({ points: pts.output('Points'), instance: inst.output('Geometry') })
  iop.output('Geometry').evaluate()
}, 100)

console.log('\nJoin 10 transformed grids')
bench('10-grid join', () => {
  const grids = Array.from({ length: 10 }, (_, i) =>
    new TransformGeometry({ geometry: new Grid({ vertsX: 5, vertsY: 5 }).output('Geometry'), translation: [i * 2, 0, 0] }).output('Geometry')
  )
  new JoinGeometry(grids).output('Geometry').evaluate()
}, 200)

console.log('\nDone.')
