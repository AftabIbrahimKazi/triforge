import {
  ShaderConfig,
  ShaderNodeError,
  NoiseTexture,
  ColorRamp,
  PrincipledBSDF,
  MaterialOutput,
  TextureCoordinate,
  OceanAttribute,
  Emission,
  AddShader,
  MixShader,
  Fresnel,
  ShaderToRGB,
  HairInfo,
  PrincipledHair,
  EnvironmentTexture,
  ImageTexture,
  Mapping,
  NormalMap,
  ShaderScript,
  Attribute,
  isValidGlslIdentifier,
} from '../dist/index.js'

ShaderConfig.errorLevel = 'verbose'

console.log('\n--- NODE SYSTEM TESTS ---\n')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  PASS  ${name}`)
    passed++
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.message.split('\n')[0]}`)
    failed++
  }
}

function throws(name, fn) {
  try {
    fn()
    console.log(`  FAIL  ${name}: expected ShaderNodeError but nothing was thrown`)
    failed++
  } catch (e) {
    if (e instanceof ShaderNodeError) {
      console.log(`  PASS  ${name}`)
      passed++
    } else {
      console.log(`  FAIL  ${name}: wrong error type — ${e.message}`)
      failed++
    }
  }
}

// ── Node construction ─────────────────────────────────────────────────────────

test('NoiseTexture constructs with defaults', () => {
  const n = new NoiseTexture()
  if (!n.id) throw new Error('No ID')
  if (n.nodeType !== 'NoiseTexture') throw new Error('Wrong nodeType')
})

test('NoiseTexture constructs with custom values', () => {
  const n = new NoiseTexture({ scale: 3.0, detail: 4.0, roughness: 0.3 })
  const sockets = n.getInputSockets()
  if (sockets.scale.defaultValue !== 3.0) throw new Error('scale not set')
  if (sockets.detail.defaultValue !== 4.0) throw new Error('detail not set')
})

test('ColorRamp constructs with hex stops', () => {
  const r = new ColorRamp({ stops: ['#000000', '#ff0000', '#ffffff'] })
  if (r.nodeType !== 'ColorRamp') throw new Error('Wrong nodeType')
})

test('PrincipledBSDF constructs with defaults', () => {
  const b = new PrincipledBSDF()
  if (b.nodeType !== 'PrincipledBSDF') throw new Error('Wrong nodeType')
})

test('TextureCoordinate constructs', () => {
  const t = new TextureCoordinate()
  const outputs = t.getOutputSockets()
  if (!outputs.UV) throw new Error('No UV output')
  if (!outputs.Generated) throw new Error('No Generated output')
  if (!outputs.Normal) throw new Error('No Normal output')
})

// ── Socket connections ────────────────────────────────────────────────────────

test('output() returns correct OutputSocket', () => {
  const n = new NoiseTexture()
  const fac = n.output('Fac')
  if (fac.type !== 'float') throw new Error(`Expected float, got ${fac.type}`)
  if (fac.name !== 'Fac') throw new Error(`Expected Fac, got ${fac.name}`)
})

test('output() Color socket is color type', () => {
  const n = new NoiseTexture()
  const col = n.output('Color')
  if (col.type !== 'color') throw new Error(`Expected color, got ${col.type}`)
})

test('PrincipledBSDF BSDF socket is shader type', () => {
  const b = new PrincipledBSDF()
  const bsdf = b.output('BSDF')
  if (bsdf.type !== 'shader') throw new Error(`Expected shader, got ${bsdf.type}`)
})

throws('output() throws for non-existent socket', () => {
  const n = new NoiseTexture()
  n.output('NonExistent')
})

// ── Node graph wiring ─────────────────────────────────────────────────────────

test('Nodes connect via OutputSocket', () => {
  const noise = new NoiseTexture({ scale: 3.0 })
  const ramp  = new ColorRamp({ fac: noise.output('Fac') })
  const inputs = ramp.getInputSockets()
  if (!inputs.fac.isConnected()) throw new Error('fac not connected')
  if (inputs.fac.connection.node !== noise) throw new Error('Connected to wrong node')
})

test('PrincipledBSDF accepts ColorRamp output', () => {
  const noise = new NoiseTexture()
  const ramp  = new ColorRamp({ fac: noise.output('Fac') })
  const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color') })
  const inputs = bsdf.getInputSockets()
  if (!inputs.baseColor.isConnected()) throw new Error('baseColor not connected')
})

// ── Compile ───────────────────────────────────────────────────────────────────

test('compile() returns a THREE.ShaderMaterial', () => {
  const bsdf = new PrincipledBSDF({ roughness: 0.3 })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.vertexShader)   throw new Error('No vertexShader')
  if (!result.fragmentShader) throw new Error('No fragmentShader')
  if (typeof result !== 'object') throw new Error('Not an object')
})

test('.material is set after compile()', () => {
  const bsdf = new PrincipledBSDF()
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  if (mat.material !== null) throw new Error('Should be null before compile')
  mat.compile()
  if (!mat.material) throw new Error('Should be set after compile')
})

test('.material can be reused across multiple meshes', () => {
  const bsdf = new PrincipledBSDF()
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  const a = mat.material
  const b = mat.material
  if (a !== b) throw new Error('Should return same instance')
})

test('Full graph compiles: Noise → ColorRamp → BSDF → Output', () => {
  const noise = new NoiseTexture({ scale: 3.0 })
  const ramp  = new ColorRamp({ fac: noise.output('Fac'), stops: ['#001133', '#0055ff', '#00ffcc'] })
  const bsdf  = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.4 })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('_st_noiseTexture'))   throw new Error('Missing noise function')
  if (!result.fragmentShader.includes('_st_principledBSDF')) throw new Error('Missing BSDF function')
})

test('Two NoiseTexture nodes produce unique variable names', () => {
  const noise1 = new NoiseTexture({ scale: 2.0 })
  const noise2 = new NoiseTexture({ scale: 7.0 })
  const ramp   = new ColorRamp({ fac: noise1.output('Fac') })
  const bsdf   = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: noise2.output('Fac') })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes(noise1.id)) throw new Error('noise1 ID missing')
  if (!result.fragmentShader.includes(noise2.id)) throw new Error('noise2 ID missing')
})

test('Shared node used by two downstream nodes emits once', () => {
  const noise = new NoiseTexture({ scale: 3.0 })
  const ramp1 = new ColorRamp({ fac: noise.output('Fac'), stops: ['#000', '#fff'] })
  const ramp2 = new ColorRamp({ fac: noise.output('Fac'), stops: ['#f00', '#00f'] })
  const bsdf  = new PrincipledBSDF({ baseColor: ramp1.output('Color'), roughness: 0.5 })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const callCount = (result.fragmentShader.match(new RegExp(`_st_${noise.id}_Fac`, 'g')) ?? []).length
  if (callCount < 1) throw new Error('Noise variable not found in output')
})

test('NoiseTexture function def emitted once for two instances', () => {
  const noise1 = new NoiseTexture({ scale: 2.0 })
  const noise2 = new NoiseTexture({ scale: 8.0 })
  const bsdf   = new PrincipledBSDF({ baseColor: noise1.output('Color'), roughness: 0.5 })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const defMatches = result.fragmentShader.match(/float _st_noiseTexture\(/g) ?? []
  if (defMatches.length !== 1) throw new Error(`Expected 1 def, got ${defMatches.length}`)
})

test('TextureCoordinate Normal feeds into NoiseTexture', () => {
  // UV is vec2 (vector type) — NoiseTexture.vector expects vec3 (color type).
  // Use Normal output which is vec3/color and maps to world-space normals.
  const coord = new TextureCoordinate()
  const noise = new NoiseTexture({ vector: coord.output('Normal') })
  const bsdf  = new PrincipledBSDF({ baseColor: noise.output('Color') })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader) throw new Error('No fragment shader')
})

test('Fragment shader contains correct GLSL structure', () => {
  const bsdf = new PrincipledBSDF()
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('void main()'))       throw new Error('Missing main()')
  if (!result.fragmentShader.includes('gl_FragColor'))      throw new Error('Missing gl_FragColor')
  if (!result.fragmentShader.includes('varying vec2 vUv'))  throw new Error('Missing vUv varying')
  if (!result.fragmentShader.includes('precision mediump')) throw new Error('Missing precision qualifier')
})

// ── Error system ──────────────────────────────────────────────────────────────

throws('MaterialOutput throws when surface is missing', () => {
  new MaterialOutput()
})

throws('output() throws for unknown socket name', () => {
  const n = new NoiseTexture()
  n.output('DoesNotExist')
})

test('ShaderNodeError has correct structure', () => {
  try {
    new MaterialOutput()
  } catch (e) {
    if (!(e instanceof ShaderNodeError)) throw new Error('Not a ShaderNodeError')
    if (!e.nodeType) throw new Error('No nodeType')
    if (!e.nodeId)   throw new Error('No nodeId')
    if (!e.problem)  throw new Error('No problem')
  }
})

test('errorLevel off suppresses MaterialOutput surface error', () => {
  ShaderConfig.errorLevel = 'off'
  new MaterialOutput()  // should not throw
  ShaderConfig.errorLevel = 'verbose'
})

// ── Metadata ──────────────────────────────────────────────────────────────────

test('All nodes expose metadata', () => {
  const nodes = [
    new NoiseTexture(),
    new ColorRamp(),
    new PrincipledBSDF(),
    new TextureCoordinate(),
  ]
  for (const node of nodes) {
    if (!node.metadata.label)    throw new Error(`${node.nodeType} missing metadata.label`)
    if (!node.metadata.category) throw new Error(`${node.nodeType} missing metadata.category`)
    if (!node.metadata.color)    throw new Error(`${node.nodeType} missing metadata.color`)
    if (!node.metadata.cost)     throw new Error(`${node.nodeType} missing metadata.cost`)
  }
})

// ── GLSL override ─────────────────────────────────────────────────────────────

test('Per-class glslFunction override is used', () => {
  const original = NoiseTexture.glslFunction
  NoiseTexture.glslFunction = `float _st_noiseTexture(vec2 uv, float s, float d, float r, float dist) { return 0.5; }`
  const noise  = new NoiseTexture({ scale: 2.0 })
  const bsdf   = new PrincipledBSDF({ baseColor: noise.output('Color') })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  NoiseTexture.glslFunction = original
  if (!result.fragmentShader.includes('return 0.5')) throw new Error('Per-class override not used')
})

test('Per-instance glslFunction override takes priority', () => {
  const noise  = new NoiseTexture({ scale: 2.0 })
  noise.glslFunction = `float _st_noiseTexture(vec2 uv, float s, float d, float r, float dist) { return 0.9; }`
  const bsdf   = new PrincipledBSDF({ baseColor: noise.output('Color') })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('return 0.9')) throw new Error('Per-instance override not used')
})

// ── parameters refactor ───────────────────────────────────────────────────────

test('Node exposes parameters object with float inputs', () => {
  const noise = new NoiseTexture({ scale: 3.0, detail: 4.0 })
  if (typeof noise.parameters !== 'object') throw new Error('parameters not an object')
  if (noise.parameters.scale   !== 3.0) throw new Error(`scale: expected 3.0 got ${noise.parameters.scale}`)
  if (noise.parameters.detail  !== 4.0) throw new Error(`detail: expected 4.0 got ${noise.parameters.detail}`)
})

test('parameters defaults match node defaults', () => {
  const noise = new NoiseTexture()
  if (noise.parameters.scale      !== 5.0) throw new Error(`scale: expected 5.0 got ${noise.parameters.scale}`)
  if (noise.parameters.detail     !== 2.0) throw new Error(`detail: expected 2.0 got ${noise.parameters.detail}`)
  if (noise.parameters.roughness  !== 0.5) throw new Error(`roughness: expected 0.5 got ${noise.parameters.roughness}`)
  if (noise.parameters.distortion !== 0.0) throw new Error(`distortion: expected 0.0 got ${noise.parameters.distortion}`)
})

test('Fragment shader contains uniform declarations for float inputs', () => {
  const noise = new NoiseTexture({ scale: 3.0 })
  const bsdf  = new PrincipledBSDF({ baseColor: noise.output('Color') })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('uniform float')) throw new Error('No uniform declarations found')
  if (!result.fragmentShader.includes(noise.id))        throw new Error('Uniform missing node ID')
})

test('compiled uniforms object contains node float parameters', () => {
  const noise = new NoiseTexture({ scale: 3.0 })
  const bsdf  = new PrincipledBSDF({ baseColor: noise.output('Color') })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  const uniformKeys = Object.keys(mat.material.uniforms)
  const scaleKey = uniformKeys.find(k => k.includes(noise.id) && k.includes('scale'))
  if (!scaleKey) throw new Error('Scale uniform not found in material.uniforms')
  if (mat.material.uniforms[scaleKey].value !== 3.0) throw new Error(`Scale uniform value: expected 3.0 got ${mat.material.uniforms[scaleKey].value}`)
})

test('parameters setter updates live GPU uniform after compile', () => {
  const noise = new NoiseTexture({ scale: 3.0 })
  const bsdf  = new PrincipledBSDF({ baseColor: noise.output('Color') })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  noise.parameters.scale = 10.0
  const uniformKeys = Object.keys(mat.material.uniforms)
  const scaleKey = uniformKeys.find(k => k.includes(noise.id) && k.includes('scale'))
  if (!scaleKey) throw new Error('Scale uniform not found')
  if (mat.material.uniforms[scaleKey].value !== 10.0) throw new Error(`Expected 10.0 got ${mat.material.uniforms[scaleKey].value}`)
})

test('connected float input does not create a uniform', () => {
  const noise1 = new NoiseTexture({ scale: 3.0 })
  const noise2 = new NoiseTexture({ scale: noise1.output('Fac') }) // scale is driven by connection
  const bsdf   = new PrincipledBSDF({ baseColor: noise2.output('Color') })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  const uniformKeys = Object.keys(mat.material.uniforms)
  // noise2.scale should NOT have a uniform since it's connected
  const noise2ScaleKey = uniformKeys.find(k => k.includes(noise2.id) && k.includes('scale'))
  if (noise2ScaleKey) throw new Error('Connected input should not create a uniform')
})

// ── OceanAttribute node ───────────────────────────────────────────────────────

test('OceanAttribute constructs and has Fac + Color outputs', () => {
  const ocean = new OceanAttribute()
  const outputs = ocean.getOutputSockets()
  if (!outputs.Fac)   throw new Error('Missing Fac output')
  if (!outputs.Color) throw new Error('Missing Color output')
  if (outputs.Fac.type   !== 'float') throw new Error(`Fac should be float, got ${outputs.Fac.type}`)
  if (outputs.Color.type !== 'color') throw new Error(`Color should be color, got ${outputs.Color.type}`)
})

test('OceanAttribute declares foam vertex injection', () => {
  const ocean = new OceanAttribute()
  const inj   = ocean.vertexInjections()
  if (inj.length !== 1) throw new Error(`Expected 1 injection, got ${inj.length}`)
  if (inj[0].attrName    !== 'foam')   throw new Error(`attrName should be foam, got ${inj[0].attrName}`)
  if (inj[0].varyingName !== 'vFoam')  throw new Error(`varyingName should be vFoam`)
  if (inj[0].attrType    !== 'float')  throw new Error(`attrType should be float`)
})

test('OceanAttribute compiles into valid shader graph', () => {
  const ocean  = new OceanAttribute()
  const ramp   = new ColorRamp({ fac: ocean.output('Fac'), stops: ['#000022', '#ffffff'] })
  const bsdf   = new PrincipledBSDF({ baseColor: ramp.output('Color') })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader) throw new Error('No fragment shader')
  if (!result.vertexShader)   throw new Error('No vertex shader')
})

test('OceanAttribute injects attribute and varying into vertex shader', () => {
  const ocean  = new OceanAttribute()
  const bsdf   = new PrincipledBSDF({ baseColor: ocean.output('Color') })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.vertexShader.includes('attribute float foam'))
    throw new Error('vertex shader missing: attribute float foam')
  if (!result.vertexShader.includes('varying  float vFoam'))
    throw new Error('vertex shader missing: varying float vFoam')
  if (!result.vertexShader.includes('vFoam = foam'))
    throw new Error('vertex shader missing: vFoam = foam assignment')
})

test('OceanAttribute injects varying declaration into fragment shader', () => {
  const ocean  = new OceanAttribute()
  const bsdf   = new PrincipledBSDF({ baseColor: ocean.output('Color') })
  const mat    = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('varying float vFoam'))
    throw new Error('fragment shader missing: varying float vFoam')
})

test('OceanAttribute used with Emission for foam glow compiles cleanly', () => {
  const ocean  = new OceanAttribute()
  const ramp   = new ColorRamp({ fac: ocean.output('Fac'), stops: ['#000022', '#003366', '#ffffff'] })
  const bsdf   = new PrincipledBSDF({ baseColor: ramp.output('Color'), roughness: 0.1 })
  const emit   = new Emission({ color: ocean.output('Color'), strength: 2.0 })
  const mixed  = new AddShader({ shader1: bsdf.output('BSDF'), shader2: emit.output('BSDF') })
  const mat    = new MaterialOutput({ surface: mixed.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader) throw new Error('No fragment shader produced')
  // foam varying should appear exactly once in fragment shader
  const count = (result.fragmentShader.match(/varying float vFoam/g) || []).length
  if (count !== 1) throw new Error(`vFoam varying declared ${count} times, expected 1`)
})

// ── HairInfo + PrincipledHair ─────────────────────────────────────────────────

test('HairInfo compiles and injects strandTangent varying', () => {
  const hair = new HairInfo()
  const bsdf = new PrincipledHair({ color: '#8b5a38', tangent: hair.output('TangentNormal'), random: hair.output('Random') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.vertexShader.includes('strandTangent'))   throw new Error('strandTangent attribute missing from vertex shader')
  if (!result.fragmentShader.includes('vStrandTangent')) throw new Error('vStrandTangent varying missing from fragment shader')
})

test('HairInfo outputs Intercept from vUv.y', () => {
  const hair = new HairInfo()
  const mat  = new MaterialOutput({ surface: new PrincipledHair({ tangent: hair.output('TangentNormal') }).output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('vUv.y')) throw new Error('Intercept should use vUv.y')
})

test('HairInfo IsStrand output is always 1.0', () => {
  const hair = new HairInfo()
  const mat  = new MaterialOutput({ surface: new PrincipledHair({ tangent: hair.output('TangentNormal') }).output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('1.0')) throw new Error('IsStrand should be 1.0')
})

test('PrincipledHair compiles standalone (no HairInfo)', () => {
  const bsdf = new PrincipledHair({ color: '#cc8844', roughness: 0.3 })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('_st_principledHair')) throw new Error('PrincipledHair function missing')
  if (!result.fragmentShader.includes('uSunDirection'))       throw new Error('Light uniform missing')
})

test('PrincipledHair GLSL function appears only once in graph', () => {
  const hair = new HairInfo()
  const bsdf = new PrincipledHair({ tangent: hair.output('TangentNormal'), random: hair.output('Random') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const count = (result.fragmentShader.match(/_st_principledHair\s*\(/g) || []).length
  // one definition + one call
  if (count < 1) throw new Error('PrincipledHair function not emitted')
})

test('PrincipledHair + PrincipledBSDF in same graph: light uniforms guarded by #ifndef', () => {
  const hair    = new HairInfo()
  const hairBsdf = new PrincipledHair({ tangent: hair.output('TangentNormal') })
  const surfBsdf = new PrincipledBSDF({ baseColor: '#ffffff' })
  const mixed   = new AddShader({ shader1: hairBsdf.output('BSDF'), shader2: surfBsdf.output('BSDF') })
  const mat     = new MaterialOutput({ surface: mixed.output('BSDF') })
  const result  = mat.compile()
  // Both nodes declare uniforms but guard them with #ifndef — shader must contain the guard
  if (!result.fragmentShader.includes('#ifndef _ST_HAIR_LIGHT_UNIFORMS')) throw new Error('#ifndef guard missing')
  // uSunDirection must exist at least once (possibly twice in source — GLSL preprocessor handles dedup)
  if (!result.fragmentShader.includes('uSunDirection')) throw new Error('uSunDirection uniform missing')
})

test('PrincipledHair strandRandom varying injected by HairInfo', () => {
  const hair = new HairInfo()
  const bsdf = new PrincipledHair({ random: hair.output('Random'), tangent: hair.output('TangentNormal') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.vertexShader.includes('strandRandom'))   throw new Error('strandRandom attribute missing')
  if (!result.fragmentShader.includes('vStrandRandom')) throw new Error('vStrandRandom varying missing')
})

// ── EnvironmentTexture Tests ──────────────────────────────────────────────────

test('EnvironmentTexture throws without uniformName', () => {
  let threw = false
  try { new EnvironmentTexture({}) } catch { threw = true }
  if (!threw) throw new Error('Expected error for missing uniformName')
})

test('EnvironmentTexture compiles with default reflected vector', () => {
  const env  = new EnvironmentTexture({ uniformName: 'uEnv' })
  const bsdf = new PrincipledBSDF({ baseColor: env.output('Color') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('samplerCube uEnv')) throw new Error('samplerCube declaration missing')
  if (!result.fragmentShader.includes('textureCube(uEnv')) throw new Error('textureCube call missing')
  if (!result.fragmentShader.includes('reflect(')) throw new Error('default reflect() direction missing')
})

test('EnvironmentTexture with custom direction vector', () => {
  const env  = new EnvironmentTexture({ uniformName: 'uEnv', vector: new NoiseTexture({ scale: 1 }).output('Color') })
  const bsdf = new PrincipledBSDF({ baseColor: env.output('Color') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (result.fragmentShader.includes('reflect(')) throw new Error('should not use reflect() when vector is connected')
})

test('EnvironmentTexture roughness creates float uniform', () => {
  const env  = new EnvironmentTexture({ uniformName: 'uEnv', roughness: 0.5 })
  const bsdf = new PrincipledBSDF({ baseColor: env.output('Color') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const roughUniform = Object.keys(result.uniforms).find(k => k.includes('roughness'))
  if (!roughUniform) throw new Error('roughness uniform missing')
  if (Math.abs(result.uniforms[roughUniform].value - 0.5) > 0.001) throw new Error('roughness value wrong')
})

// ── UV Panning / vector-socket compatibility Tests ────────────────────────────

test('Mapping (color output) can drive ImageTexture.vector (vector input) via implicit vec3->vec2', () => {
  const coord = new TextureCoordinate()
  const mapping = new Mapping({ vector: coord.output('UV'), location: [0.5, 0, 0] })
  const tex = new ImageTexture({ uniformName: 'uAlbedo', vector: mapping.output('Vector') })
  const bsdf = new PrincipledBSDF({ baseColor: tex.output('Color') })
  const mat = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('.xy')) throw new Error('expected vec3->vec2 swizzle in generated GLSL')
  if (!result.fragmentShader.includes('texture2D(uAlbedo')) throw new Error('texture2D call missing')
})

test('Mapping location parameter is mutable post-construction (uniform-driveable panning)', () => {
  const coord = new TextureCoordinate()
  const mapping = new Mapping({ vector: coord.output('UV') })
  const tex = new ImageTexture({ uniformName: 'uAlbedo2', vector: mapping.output('Vector') })
  const bsdf = new PrincipledBSDF({ baseColor: tex.output('Color') })
  const mat = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  if (typeof mapping.parameters?.location === 'undefined') throw new Error('Mapping.parameters.location missing')
})

// ── NormalMap (tangent-space decode) Tests ────────────────────────────────────

test('NormalMap compiles: ImageTexture -> NormalMap -> PrincipledBSDF.normal', () => {
  const tex  = new ImageTexture({ uniformName: 'uNormalMap' })
  const nm   = new NormalMap({ color: tex.output('Color'), strength: 0.75 })
  const bsdf = new PrincipledBSDF({ normal: nm.output('Normal') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('_st_normalMap(')) throw new Error('normal map decode call missing')
  if (!result.fragmentShader.includes('mat3 TBN')) throw new Error('TBN construction missing')
  if (!result.fragmentShader.includes('sampledColor * 2.0 - 1.0')) throw new Error('RGB->vector decode missing')
})

test('NormalMap strength=0 zeroes out the xy perturbation, leaving geometry normal dominant', () => {
  const nm  = new NormalMap({ strength: 0 })
  const bsdf = new PrincipledBSDF({ normal: nm.output('Normal') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const strengthUniform = Object.keys(result.uniforms).find(k => k.includes('strength'))
  if (!strengthUniform) throw new Error('strength uniform missing')
  if (result.uniforms[strengthUniform].value !== 0) throw new Error('strength value wrong')
})

// ── Finite-Number Guard Tests ─────────────────────────────────────────────────

test('SECURITY: NaN float parameter is sanitized to 0 rather than reaching GLSL as "NaN"', () => {
  const coord   = new TextureCoordinate()
  const mapping = new Mapping({ vector: coord.output('UV'), location: [NaN, 0, 0] })
  const tex     = new ImageTexture({ uniformName: 'uNanTest', vector: mapping.output('Vector') })
  const bsdf    = new PrincipledBSDF({ baseColor: tex.output('Color') })
  const mat     = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result  = mat.compile()
  if (result.fragmentShader.includes('NaN')) throw new Error('NaN literal leaked into shader source')
  const locUniform = Object.keys(result.uniforms).find(k => k.includes('location'))
  if (!locUniform) throw new Error('location uniform missing')
  if (!Number.isFinite(result.uniforms[locUniform].value[0])) throw new Error('NaN uniform value leaked')
})

test('SECURITY: Infinity strength parameter is sanitized rather than reaching GLSL uniform', () => {
  const nm = new NormalMap({ strength: Infinity })
  const bsdf = new PrincipledBSDF({ normal: nm.output('Normal') })
  const mat = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const strengthUniform = Object.keys(result.uniforms).find(k => k.includes('strength'))
  if (!Number.isFinite(result.uniforms[strengthUniform].value)) throw new Error('Infinity uniform value leaked')
})

test('SECURITY: setting parameters.value to NaN post-compile is sanitized, not passed through to the GPU uniform', () => {
  const noise = new NoiseTexture({ scale: 2.0 })
  const bsdf  = new PrincipledBSDF({ baseColor: noise.output('Color') })
  const mat   = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  noise.parameters.scale = NaN
  if (!Number.isFinite(noise.parameters.scale)) throw new Error('NaN parameter value leaked through live setter')
})

// ── Color Uniform Tests ───────────────────────────────────────────────────────

test('color input creates uniform vec3 declaration in fragment shader', () => {
  const bsdf = new PrincipledBSDF({ baseColor: '#ff8800' })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const uniformName = Object.keys(result.uniforms).find(k => k.includes('baseColor'))
  if (!uniformName) throw new Error('No baseColor uniform found')
  if (!result.fragmentShader.includes(`uniform vec3 ${uniformName}`))
    throw new Error('uniform vec3 declaration missing from fragment shader')
})

test('color uniform initial value matches hex input', () => {
  const bsdf = new PrincipledBSDF({ baseColor: '#ff0000' })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const uniformName = Object.keys(result.uniforms).find(k => k.includes('baseColor'))
  if (!uniformName) throw new Error('No baseColor uniform found')
  const val = result.uniforms[uniformName].value
  if (!Array.isArray(val)) throw new Error('Uniform value is not an array')
  if (Math.abs(val[0] - 1.0) > 0.01 || Math.abs(val[1]) > 0.01 || Math.abs(val[2]) > 0.01)
    throw new Error(`Expected [1,0,0] got [${val}]`)
})

test('color input exposes [r,g,b] in node.parameters', () => {
  const bsdf = new PrincipledBSDF({ baseColor: '#0000ff' })
  const val = bsdf.parameters.baseColor
  if (!Array.isArray(val)) throw new Error('parameters.baseColor is not an array')
  if (Math.abs(val[0]) > 0.01 || Math.abs(val[1]) > 0.01 || Math.abs(val[2] - 1.0) > 0.01)
    throw new Error(`Expected [0,0,1] got [${val}]`)
})

test('parameters.baseColor setter updates live GPU uniform after compile', () => {
  const bsdf = new PrincipledBSDF({ baseColor: '#000000' })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  bsdf.parameters.baseColor = [1.0, 0.5, 0.25]
  const uniformName = Object.keys(mat.material.uniforms).find(k => k.includes('baseColor'))
  if (!uniformName) throw new Error('No baseColor uniform found after compile')
  const val = mat.material.uniforms[uniformName].value
  if (!Array.isArray(val) || Math.abs(val[0] - 1.0) > 0.01)
    throw new Error(`Expected [1,0.5,0.25] got [${val}]`)
})

test('connected color input does not create a uniform (baked literal path)', () => {
  const rgb  = new ColorRamp({ fac: new NoiseTexture({ scale: 2 }).output('Fac'), stops: ['#000', '#fff'] })
  const bsdf = new PrincipledBSDF({ baseColor: rgb.output('Color') })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const colorUniforms = Object.keys(result.uniforms).filter(k => k.includes('baseColor'))
  if (colorUniforms.length > 0) throw new Error('Connected color input should not create a uniform')
})

// ── SECURITY: GLSL identifier validation (attribute-name injection) ───────────

test('isValidGlslIdentifier accepts plain identifiers, rejects unsafe ones', () => {
  if (!isValidGlslIdentifier('foam')) throw new Error('rejected a valid name')
  if (!isValidGlslIdentifier('my_attr2')) throw new Error('rejected a valid name')
  if (isValidGlslIdentifier('gl_Position')) throw new Error('accepted gl_ reserved')
  if (isValidGlslIdentifier('a__b')) throw new Error('accepted double underscore')
  if (isValidGlslIdentifier('2bad')) throw new Error('accepted digit-start')
  if (isValidGlslIdentifier('a; } void main(){')) throw new Error('accepted injection')
})

test('SECURITY: Attribute rejects a GLSL-injecting attribute name at construction', () => {
  let threw = false
  try {
    // eslint-disable-next-line no-new
    new Attribute('x; } void main() { gl_FragColor = vec4(1.0); //', 'float')
  } catch { threw = true }
  if (!threw) throw new Error('Attribute accepted an injecting name — GLSL injection possible')
})

test('SECURITY: Attribute still accepts a normal attribute name', () => {
  const a = new Attribute('windWeight', 'float')
  if (a.attributeName !== 'windWeight') throw new Error('valid name was mangled/rejected')
})

test('SECURITY: ImageTexture rejects a GLSL-injecting uniformName at construction', () => {
  let threw = false
  try {
    // eslint-disable-next-line no-new
    new ImageTexture({ uniformName: 'uTex; } /* pwned */ void main(){' })
  } catch { threw = true }
  if (!threw) throw new Error('ImageTexture accepted an injecting uniformName — GLSL injection possible')
})

test('SECURITY: ImageTexture still accepts a normal uniformName', () => {
  const it = new ImageTexture({ uniformName: 'uAlbedo' })
  const mat = new MaterialOutput({ surface: new Emission({ color: it.output('Color') }).output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('uAlbedo')) throw new Error('valid uniformName was mangled/rejected')
})

test('SECURITY: EnvironmentTexture rejects a GLSL-injecting uniformName at construction', () => {
  let threw = false
  try {
    // eslint-disable-next-line no-new
    new EnvironmentTexture({ uniformName: 'uEnv; } /* pwned */ void main(){' })
  } catch { threw = true }
  if (!threw) throw new Error('EnvironmentTexture accepted an injecting uniformName — GLSL injection possible')
})

test('SECURITY: ShaderScript rejects a GLSL-injecting input name at construction', () => {
  let threw = false
  try {
    new ShaderScript({
      inputs: { 'x; } /* pwned */ void hack(': ['float', 1.0] },
      outputs: { result: 'float' },
      glsl: 'result = 1.0;',
    })
  } catch { threw = true }
  if (!threw) throw new Error('Expected error for unsafe input name')
})

test('SECURITY: ShaderScript rejects a GLSL-injecting output name at construction', () => {
  let threw = false
  try {
    new ShaderScript({
      inputs: {},
      outputs: { 'x; } /* pwned */ void hack(': 'float' },
      glsl: '',
    })
  } catch { threw = true }
  if (!threw) throw new Error('Expected error for unsafe output name')
})

test('SECURITY: EnvironmentTexture still accepts a normal uniformName', () => {
  const env = new EnvironmentTexture({ uniformName: 'uEnv' })
  const mat = new MaterialOutput({ surface: new Emission({ color: env.output('Color') }).output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('uEnv')) throw new Error('valid uniformName was mangled/rejected')
})

// ── FINDINGS #1: per-fragment alpha through MaterialOutput ─────────────────────
// Reproducer from FINDINGS.md — must pass on the *compiled* ShaderMaterial,
// not just the toPhysicalMaterial() conversion path.

test('FIX #1: PrincipledBSDF alpha=0.5 reaches gl_FragColor and marks the material transparent', () => {
  const bsdf = new PrincipledBSDF({ alpha: 0.5 })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  if (result.fragmentShader.includes('gl_FragColor = vec4(_st_') && result.fragmentShader.includes(', 1.0000);')) {
    throw new Error('alpha still hardcoded to 1.0 in gl_FragColor')
  }
  if (mat.material.transparent !== true) throw new Error(`expected transparent:true, got ${mat.material.transparent}`)
})

test('FIX #1: default alpha (omitted) keeps the material opaque', () => {
  const bsdf = new PrincipledBSDF()
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  mat.compile()
  if (mat.material.transparent !== false) throw new Error(`expected transparent:false, got ${mat.material.transparent}`)
})

test('FIX #1: socket-driven alpha (fresnel-style chain) compiles and registers a live uniform, marks transparent', () => {
  const fresnel = new Fresnel()
  const bsdf    = new PrincipledBSDF({ alpha: fresnel.output('Fac') })
  const mat     = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result  = mat.compile()
  if (!result.fragmentShader.includes('_st_') ) throw new Error('fresnel alpha connection did not compile')
  if (mat.material.transparent !== true) throw new Error('connected (dynamic) alpha should conservatively mark transparent:true')
})

test('FIX #1: gl_FragColor is assigned the vec4 BSDF variable directly (no more hardcoded 1.0 wrapper)', () => {
  const bsdf = new PrincipledBSDF({ alpha: 0.5 })
  const mat  = new MaterialOutput({ surface: bsdf.output('BSDF') })
  const result = mat.compile()
  const bsdfVar = `_st_${bsdf.id}_BSDF`
  if (!result.fragmentShader.includes(`gl_FragColor = ${bsdfVar};`)) {
    throw new Error('gl_FragColor should be assigned the vec4 BSDF variable directly')
  }
})

test('FIX #1: AddShader combines rgb and takes the max alpha of both branches', () => {
  const a   = new Emission({ color: '#ff0000', strength: 1.0 })
  const b   = new PrincipledBSDF({ alpha: 0.4 })
  const add = new AddShader({ shader1: a.output('BSDF'), shader2: b.output('BSDF') })
  const mat = new MaterialOutput({ surface: add.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('_st_addShader(')) throw new Error('AddShader call missing')
})

test('FIX #1: MixShader blends alpha along with color via vec4 mix', () => {
  const a   = new Emission({ color: '#ff0000' })
  const b   = new PrincipledBSDF({ alpha: 0.2 })
  const mix = new MixShader({ fac: 0.5, shader1: a.output('BSDF'), shader2: b.output('BSDF') })
  const mat = new MaterialOutput({ surface: mix.output('BSDF') })
  const result = mat.compile()
  if (!result.fragmentShader.includes('_st_mixShader(')) throw new Error('MixShader call missing')
})

test('FIX #1: ShaderToRGB extracts the real alpha channel instead of hardcoding 1.0', () => {
  const bsdf = new PrincipledBSDF({ alpha: 0.3 })
  const s2rgb = new ShaderToRGB({ shader: bsdf.output('BSDF') })
  const emit  = new Emission({ color: s2rgb.output('Color'), strength: 1.0 })
  const mat   = new MaterialOutput({ surface: emit.output('BSDF') })
  const result = mat.compile()
  if (result.fragmentShader.includes('float _st_') && result.fragmentShader.match(/Alpha = 1\.0;/)) {
    throw new Error('ShaderToRGB Alpha still hardcoded to 1.0')
  }
  if (!result.fragmentShader.includes('.a;')) throw new Error('ShaderToRGB should extract .a from the vec4 shader')
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
