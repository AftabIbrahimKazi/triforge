import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface SchwarzschildMarchInputs {
  rayPos?:    OutputSocket
  rayDir?:    OutputSocket
  Rs?:        number | OutputSocket
  diskInn?:   number | OutputSocket
  diskOut?:   number | OutputSocket
  diskThk?:   number | OutputSocket
  doppler?:   number | OutputSocket
  rotSpd?:    number | OutputSocket
  psBright?:  number | OutputSocket
  psWidth?:   number | OutputSocket
  psFresnel?: number | OutputSocket
  steps?:     number | OutputSocket
  stepSz?:    number | OutputSocket
  time?:      number | OutputSocket
  exposure?:  number | OutputSocket

  // ── Texture Maker: Ring / Stripe layer ──────────────────────────────────
  rFreq?:     number | OutputSocket   // ring frequency (concentric band density)
  rDist?:     number | OutputSocket   // ring distortion (wave noise phase offset)
  rDet?:      number | OutputSocket   // ring detail octaves
  rContr?:    number | OutputSocket   // ring contrast (power curve sharpness)

  // ── Texture Maker: Surface texture (Noise 1 × Noise 2) ──────────────────
  n1Scale?:   number | OutputSocket   // noise 1 — large scale cloud structure
  n1Det?:     number | OutputSocket
  n1Rough?:   number | OutputSocket
  nScale?:   number | OutputSocket   // noise 2 — fine grain
  nDet?:     number | OutputSocket
  nRough?:   number | OutputSocket
  sBlend?:    number | OutputSocket   // 0=N1 dominant, 1=N2 dominant

  // ── Texture Maker: Combine ────────────────────────────────────────────────
  ringStr?:   number | OutputSocket
  surfStr?:   number | OutputSocket
  warpSc?:    number | OutputSocket   // warp noise scale
  warpStr?:   number | OutputSocket   // warp strength

  // ── Texture Maker: Color mapping (live vec3 uniforms) ─────────────────────
  cDark?:     string | [number,number,number] | OutputSocket
  cMid?:      string | [number,number,number] | OutputSocket
  cBright?:   string | [number,number,number] | OutputSocket
  cMidPt?:    number | OutputSocket
  cLow?:      number | OutputSocket
  cHigh?:     number | OutputSocket
  bright?: number | OutputSocket
}

export class SchwarzschildMarch extends ProcessNode {
  get nodeType() { return 'SchwarzschildMarch' }
  static instanceSpecificDef = true

  get metadata(): NodeMetadata {
    return {
      label:    'Schwarzschild March',
      category: 'Raymarcher',
      color:    '#223344',
      cost:     'high',
      costNote: 'Full geodesic integration — GPU heavy at high step counts.',
    }
  }

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, OutputSocket>

  constructor(inputs: SchwarzschildMarchInputs = {}) {
    super('SchwarzschildMarch')

    this._inputs = this.createInputs(inputs as Record<string, unknown>, {
      rayPos:    ['color',  null],
      rayDir:    ['color',  null],
      Rs:        ['float',  inputs.Rs        ?? 0.2],
      diskInn:   ['float',  inputs.diskInn   ?? 0.55],
      diskOut:   ['float',  inputs.diskOut   ?? 2.0],
      diskThk:   ['float',  inputs.diskThk   ?? 0.01],
      doppler:   ['float',  inputs.doppler   ?? 1.0],
      rotSpd:    ['float',  inputs.rotSpd    ?? 0.05],
      psBright:  ['float',  inputs.psBright  ?? 0.5],
      psWidth:   ['float',  inputs.psWidth   ?? 0.01],
      psFresnel: ['float',  inputs.psFresnel ?? 10.0],
      steps:     ['float',  inputs.steps     ?? 500.0],
      stepSz:    ['float',  inputs.stepSz    ?? 0.015],
      time:      ['float',  inputs.time      ?? 0.0],
      exposure:  ['float',  inputs.exposure  ?? 3.0],
      // Ring / stripe
      rFreq:     ['float',  inputs.rFreq     ?? 40.75],
      rDist:     ['float',  inputs.rDist     ?? 8.0],
      rDet:      ['float',  inputs.rDet      ?? 8.0],
      rContr:    ['float',  inputs.rContr    ?? 1.0],
      // Surface noise
      n1Scale:   ['float',  inputs.n1Scale   ?? 30.0],
      n1Det:     ['float',  inputs.n1Det     ?? 1.0],
      n1Rough:   ['float',  inputs.n1Rough   ?? 0.25],
      nScale:   ['float',  inputs.nScale   ?? 40.0],
      nDet:     ['float',  inputs.nDet     ?? 8.0],
      nRough:   ['float',  inputs.nRough   ?? 1.0],
      sBlend:    ['float',  inputs.sBlend    ?? 0.25],
      // Combine
      ringStr:   ['float',  inputs.ringStr   ?? 0.5],
      surfStr:   ['float',  inputs.surfStr   ?? 1.0],
      warpSc:    ['float',  inputs.warpSc    ?? 10.0],
      warpStr:   ['float',  inputs.warpStr   ?? 0.05],
      // Color mapping (color type → live vec3 uniforms)
      cDark:     ['color',  inputs.cDark     ?? '#000000'],
      cMid:      ['color',  inputs.cMid      ?? '#926649'],
      cBright:   ['color',  inputs.cBright   ?? '#ff8800'],
      cMidPt:    ['float',  inputs.cMidPt    ?? 0.25],
      cLow:      ['float',  inputs.cLow      ?? 0.15],
      cHigh:     ['float',  inputs.cHigh     ?? 1.0],
      bright: ['float',  inputs.bright ?? 5.0],
    })

    this._outputs = this.createOutputs({ Color: 'color' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }

  compileDefs(): string {
    const p = `_sm${this.id}`
    return `
float ${p}H2(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float ${p}H3(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}
float ${p}SN(vec2 q){
  vec2 i=floor(q),f=fract(q);f=f*f*(3.0-2.0*f);
  return mix(mix(${p}H2(i),${p}H2(i+vec2(1,0)),f.x),
             mix(${p}H2(i+vec2(0,1)),${p}H2(i+vec2(1,1)),f.x),f.y);
}

// Geodesic acceleration — inward bending (correct sign for lensing)
vec3 ${p}Accel(vec3 pos,vec3 vel,float M){
  float r=max(length(pos),M*1.04);float r3=r*r*r;
  vec3 rh=pos/r;float vr=dot(vel,rh);float v2=dot(vel,vel);
  return (M/r3)*(2.0*vr*vel-(v2-3.0*vr*vr)*rh);
}
void ${p}RK4(inout vec3 pos,inout vec3 vel,float h,float M){
  vec3 k1v=${p}Accel(pos,vel,M);vec3 k1p=vel;
  vec3 k2v=${p}Accel(pos+.5*h*k1p,vel+.5*h*k1v,M);vec3 k2p=vel+.5*h*k1v;
  vec3 k3v=${p}Accel(pos+.5*h*k2p,vel+.5*h*k2v,M);vec3 k3p=vel+.5*h*k2v;
  vec3 k4v=${p}Accel(pos+h*k3p,vel+h*k3v,M);vec3 k4p=vel+h*k3v;
  pos+=(h/6.0)*(k1p+2.0*k2p+2.0*k3p+k4p);
  vel+=(h/6.0)*(k1v+2.0*k2v+2.0*k3v+k4v);
  vel=normalize(vel);
}

// ── Disk colour — Texture Maker recipe: Ring + (Noise1 × Noise2) ────────────
// All the ring/surface/color parameters come in as uniforms, identical to the
// sliders in example-texture-maker.html, so what you design there is what you see here.
vec3 ${p}DiskCol(vec3 hit, float hitCnt,
    float dInn, float dOut,
    float dopp, float rSpd, float t,
    float rFreq, float rDist, float rDet, float rContr,
    float n1Scale, float n1Det, float n1Rough,
    float nScale, float nDet, float nRough,
    float sBlend, float ringStr, float surfStr,
    float warpSc, float warpStr,
    vec3 cDark, vec3 cMid, vec3 cBright,
    float cMidPt, float cLow, float cHigh, float texBri) {

  float r   = length(hit.xz);
  float fac = clamp((r - dInn) / max(dOut - dInn, 0.001), 0.0, 1.0);

  // Smooth radial mask — outer 25% fades gracefully, inner 5% ramps up
  float radialMask = smoothstep(1.0, 0.75, fac) * smoothstep(0.0, 0.05, fac);

  // Angular position — used ONLY for Doppler (sin(ang) is continuous at ±π seam)
  // NOT used for noise UV lookups — atan2 has a ±π discontinuity at the left
  // of the disk that creates a visible cut line. Cartesian (hit.x, hit.z) are
  // continuous everywhere and completely eliminate the seam.
  float ang = atan(hit.z, hit.x) + t * rSpd;

  // ── ① Ring / stripe layer ─────────────────────────────────────────────────
  // Exact match of the Texture Maker's ring computation:
  //   VectorMath(LENGTH, pos) → warp noise → WaveTexture(scale=rFreq, SINE)
  // Scale applied directly (no extra multiplier) so slider values are identical.
  // Warp sampled in Cartesian — no ±π seam.
  float wN = ${p}SN(vec2(hit.x * warpSc + t * 0.04, hit.z * warpSc));
  float wR = r + wN * warpStr;

  // WaveTexture SINE: phase = input * scale * 2π  (texture maker uses 2π, not π)
  float phase = wR * rFreq * 6.28318;
  float rings = sin(phase + rDist * ${p}SN(vec2(hit.x * 1.8, hit.z * 1.8))) * 0.5 + 0.5;
  float rA = 0.5;
  for (int ri = 0; ri < 8; ri++) {
    if (float(ri) >= rDet) break;
    float sc = pow(2.1, float(ri+1));
    rings += rA * (sin(phase * pow(2.0, float(ri+1))
                 + rDist * ${p}SN(vec2(hit.x * sc, hit.z * sc))) * 0.5 + 0.5);
    rA *= 0.5;
  }
  rings /= max(2.0 - rA, 0.001);
  rings = pow(clamp(rings, 0.0, 1.0), rContr);

  // ── ② Surface texture (Noise 1 × Noise 2) ────────────────────────────────
  // Scale applied directly — matches NoiseTexture(scale=n1Scale) in texture maker.
  // No arbitrary multipliers: n1Scale=30 here = n1Scale=30 in texture maker.
  // Cartesian UVs throughout — zero seam.
  vec2 n1uv = vec2(hit.x * n1Scale + t * rSpd * 0.4, hit.z * n1Scale + t * rSpd * 0.2);
  float n1 = ${p}SN(n1uv) * 0.5;
  float n1a = 0.5;
  for (int n1i = 0; n1i < 8; n1i++) {
    if (float(n1i) >= n1Det) break;
    n1 += n1a * ${p}SN(n1uv * pow(2.07, float(n1i+1)));
    n1a *= n1Rough;
  }
  n1 = clamp(n1, 0.0, 1.0);

  vec2 n2uv = vec2(hit.x * nScale + t * rSpd * 0.7 + 3.7, hit.z * nScale + t * rSpd * 0.5 + 1.3);
  float n2 = ${p}SN(n2uv) * 0.5;
  float n2a = 0.5;
  for (int n2i = 0; n2i < 8; n2i++) {
    if (float(n2i) >= nDet) break;
    n2 += n2a * ${p}SN(n2uv * pow(2.07, float(n2i+1)));
    n2a *= nRough;
  }
  n2 = clamp(n2, 0.0, 1.0);

  // Blend: multiply first (dark voids + bright peaks), then fade toward N2 at sBlend
  float surf = mix(clamp(n1 * n2 * 2.0, 0.0, 1.0), n2, sBlend);

  // ── ③ Combine: (rings × surface) × radial mask ───────────────────────────
  float combined = rings * ringStr * surf * surfStr * radialMask;
  combined = clamp(combined, 0.0, 1.0);

  // ── ④ Color mapping — 3-stop gradient (dark → mid → bright) ──────────────
  float s1  = clamp((combined - cLow) / max(cHigh * cMidPt - cLow, 0.001), 0.0, 1.0);
  vec3  col = mix(cDark, cMid, s1);
  float s2  = clamp((combined - cHigh * cMidPt) / max(cHigh * (1.0 - cMidPt), 0.001), 0.0, 1.0);
  col = mix(col, cBright, s2);

  // ── ⑤ Brightness + relativistic Doppler beaming ──────────────────────────
  float bri  = texBri;
  float M    = dInn * 0.15;
  float beta = sqrt(clamp(M / max(r, 0.001), 0.0, 0.9));
  float dop  = (1.0 + dopp * beta * sin(ang)) / sqrt(max(1.0 - beta * beta, 0.001));
  bri *= clamp(dop, 0.1, 5.0);
  bri *= pow(0.35, hitCnt);   // each lensed image dimmer

  return col * bri;
}

// Procedural star field
vec3 ${p}Stars(vec3 dir){
  dir=normalize(dir); vec3 col=vec3(0.0);
  vec3 s1=dir*130.0; float h1=${p}H3(floor(s1));
  if(h1>0.972){float s=pow(max(0.0,1.0-length(fract(s1)-0.5)*9.0),2.0);
    col+=s*0.5*mix(vec3(0.7,0.8,1.0),vec3(1.0,0.9,0.7),h1);}
  vec3 s2=dir*55.0; float h2=${p}H3(floor(s2)+77.7);
  if(h2>0.989){float s=pow(max(0.0,1.0-length(fract(s2)-0.5)*9.0),2.0);
    col+=s*1.4*mix(vec3(1.0,0.95,0.8),vec3(0.7,0.85,1.0),h2);}
  return col;
}

// ACES filmic tonemapping + gamma
vec3 ${p}Aces(vec3 x){
  return pow(clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0),vec3(1.0/2.2));
}`.trim()
  }

  compileCall(ctx: CompileContext): string {
    const p  = `_sm${this.id}`
    const rp = ctx.resolveInput(this._inputs.rayPos)
    const rd = ctx.resolveInput(this._inputs.rayDir)

    const Rs       = ctx.resolveInput(this._inputs.Rs)
    const dInn     = ctx.resolveInput(this._inputs.diskInn)
    const dOut     = ctx.resolveInput(this._inputs.diskOut)
    const dThk     = ctx.resolveInput(this._inputs.diskThk)
    const dopp     = ctx.resolveInput(this._inputs.doppler)
    const rSpd     = ctx.resolveInput(this._inputs.rotSpd)
    const psBri    = ctx.resolveInput(this._inputs.psBright)
    const psW      = ctx.resolveInput(this._inputs.psWidth)
    const psF      = ctx.resolveInput(this._inputs.psFresnel)
    const steps    = ctx.resolveInput(this._inputs.steps)
    const stepSz   = ctx.resolveInput(this._inputs.stepSz)
    const time     = ctx.resolveInput(this._inputs.time)
    const expo     = ctx.resolveInput(this._inputs.exposure)
    // Ring
    const rFreq    = ctx.resolveInput(this._inputs.rFreq)
    const rDist    = ctx.resolveInput(this._inputs.rDist)
    const rDet     = ctx.resolveInput(this._inputs.rDet)
    const rContr   = ctx.resolveInput(this._inputs.rContr)
    // Surface
    const n1Scale  = ctx.resolveInput(this._inputs.n1Scale)
    const n1Det    = ctx.resolveInput(this._inputs.n1Det)
    const n1Rough  = ctx.resolveInput(this._inputs.n1Rough)
    const nScale  = ctx.resolveInput(this._inputs.nScale)
    const nDet    = ctx.resolveInput(this._inputs.nDet)
    const nRough  = ctx.resolveInput(this._inputs.nRough)
    const sBlend   = ctx.resolveInput(this._inputs.sBlend)
    // Combine
    const ringStr  = ctx.resolveInput(this._inputs.ringStr)
    const surfStr  = ctx.resolveInput(this._inputs.surfStr)
    const warpSc   = ctx.resolveInput(this._inputs.warpSc)
    const warpStr  = ctx.resolveInput(this._inputs.warpStr)
    // Color
    const cDark    = ctx.resolveInput(this._inputs.cDark)
    const cMid     = ctx.resolveInput(this._inputs.cMid)
    const cBright  = ctx.resolveInput(this._inputs.cBright)
    const cMidPt   = ctx.resolveInput(this._inputs.cMidPt)
    const cLow     = ctx.resolveInput(this._inputs.cLow)
    const cHigh    = ctx.resolveInput(this._inputs.cHigh)
    const texBri   = ctx.resolveInput(this._inputs.bright)

    const colorOut = ctx.outputVar(this, 'Color')

    return `
vec3  ${p}_pos  = ${rp};
vec3  ${p}_vel  = ${rd};
vec3  ${p}_prev = ${p}_pos;
vec3  ${p}_col  = vec3(0.0);
float ${p}_hits = 0.0;
float ${p}_minR = 1e6;
bool  ${p}_abs  = false;
bool  ${p}_esc  = false;
float ${p}_M    = ${Rs} * 0.5;
int   ${p}_max  = int(clamp(${steps}, 50.0, 500.0));

for (int ${p}_i = 0; ${p}_i < 500; ${p}_i++) {
  if (${p}_i >= ${p}_max) break;
  float ${p}_r  = length(${p}_pos);
  ${p}_minR = min(${p}_minR, ${p}_r);
  float ${p}_rn = ${p}_r / ${Rs};
  float ${p}_dt = ${stepSz} * clamp((${p}_rn - 1.0) * 0.4, 0.015, 1.5);

  if (${p}_r < ${Rs} * 0.55) { ${p}_abs = true; break; }

  if (${p}_prev.y * ${p}_pos.y < 0.0) {
    float ${p}_a   = ${p}_prev.y / (${p}_prev.y - ${p}_pos.y);
    vec3  ${p}_hit = mix(${p}_prev, ${p}_pos, ${p}_a);
    float ${p}_hr  = length(${p}_hit.xz);
    if (${p}_hr > ${dInn} && ${p}_hr < ${dOut} && abs(${p}_hit.y) < ${dThk}) {
      ${p}_col += ${p}DiskCol(${p}_hit, ${p}_hits,
        ${dInn}, ${dOut}, ${dopp}, ${rSpd}, ${time},
        ${rFreq}, ${rDist}, ${rDet}, ${rContr},
        ${n1Scale}, ${n1Det}, ${n1Rough},
        ${nScale}, ${nDet}, ${nRough},
        ${sBlend}, ${ringStr}, ${surfStr},
        ${warpSc}, ${warpStr},
        ${cDark}, ${cMid}, ${cBright},
        ${cMidPt}, ${cLow}, ${cHigh}, ${texBri});
      ${p}_hits += 1.0;
    }
  }

  if (${p}_r > 60.0) { ${p}_col += ${p}Stars(${p}_vel); ${p}_esc = true; break; }

  ${p}_prev = ${p}_pos;
  ${p}RK4(${p}_pos, ${p}_vel, ${p}_dt, ${p}_M);
}

if (!${p}_abs && !${p}_esc) ${p}_col += ${p}Stars(${p}_vel);

if (!${p}_abs) {
  float ${p}_psR  = ${Rs} * 1.5;
  float ${p}_psDt = abs(${p}_minR - ${p}_psR) / (${Rs} * ${psW});
  float ${p}_psMk = exp(-${p}_hits * ${psF});
  ${p}_col += exp(-${p}_psDt * ${p}_psDt) * ${psBri} * ${p}_psMk * vec3(0.88, 0.94, 1.0);
}

if (${p}_abs) ${p}_col = vec3(0.0);

vec3 ${colorOut} = ${p}Aces(${p}_col * ${expo});
`.trim()
  }
}
