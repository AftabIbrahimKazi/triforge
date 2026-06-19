import { ProcessNode } from '../../core/ProcessNode.js'
import type { NodeMetadata } from '../../core/ShaderNode.js'
import type { CompileContext } from '../../core/CompileContext.js'
import type { OutputSocket } from '../../core/OutputSocket.js'

export interface BrickTextureInputs {
  vector?:       OutputSocket
  color1?:       OutputSocket | string
  color2?:       OutputSocket | string
  mortar?:       OutputSocket | string
  scale?:        number | OutputSocket
  mortarSize?:   number | OutputSocket
  mortarSmooth?: number | OutputSocket
  bias?:         number | OutputSocket
  brickWidth?:   number | OutputSocket
  rowHeight?:    number | OutputSocket
}

/**
 * Brick Texture — Blender "Brick Texture" node equivalent.
 * Procedural brick/tile pattern with mortar lines.
 *
 * Outputs: Color (color), Fac (float — 1.0 on mortar, 0.0 on brick)
 */
export class BrickTexture extends ProcessNode {
  get nodeType() { return 'BrickTexture' }
  static instanceSpecificDef = false

  get metadata(): NodeMetadata {
    return { label: 'Brick Texture', category: 'Texture', color: '#3a6b3a', cost: 'low' }
  }

  static glslFunction = `
vec4 _st_brickTexture(vec3 p, vec3 c1, vec3 c2, vec3 mortar, float scale,
    float mortarSize, float mortarSmooth, float bias, float brickW, float rowH) {
  p *= scale;
  float rowNum  = floor(p.y / rowH);
  float offset  = mod(rowNum, 2.0) * brickW * 0.5;
  float brickX  = mod(p.x + offset, brickW);
  float brickY  = mod(p.y, rowH);
  float mx      = smoothstep(mortarSize - mortarSmooth, mortarSize + mortarSmooth, brickX);
  float my      = smoothstep(mortarSize - mortarSmooth, mortarSize + mortarSmooth, brickY);
  mx *= smoothstep(mortarSize - mortarSmooth, mortarSize + mortarSmooth, brickW - brickX);
  my *= smoothstep(mortarSize - mortarSmooth, mortarSize + mortarSmooth, rowH - brickY);
  float isMortar = 1.0 - mx * my;
  float b = clamp(bias, -1.0, 1.0);
  vec3  col = mix(mix(c1, c2, step(0.5 + b * 0.5, fract(rowNum * 0.5 + brickX / brickW))), mortar, isMortar);
  return vec4(col, isMortar);
}`

  private readonly _inputs:  Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>
  private readonly _outputs: Record<string, import('../../core/OutputSocket.js').OutputSocket>

  constructor(inputs: BrickTextureInputs = {}) {
    super('BrickTexture')
    this._inputs  = this.createInputs(inputs as Record<string, unknown>, {
      vector:       ['color',  null],
      color1:       ['color',  inputs.color1  ?? '#cc8855'],
      color2:       ['color',  inputs.color2  ?? '#aa6633'],
      mortar:       ['color',  inputs.mortar  ?? '#222222'],
      scale:        ['float',  inputs.scale        ?? 5.0],
      mortarSize:   ['float',  inputs.mortarSize   ?? 0.02],
      mortarSmooth: ['float',  inputs.mortarSmooth ?? 0.1],
      bias:         ['float',  inputs.bias         ?? 0.0],
      brickWidth:   ['float',  inputs.brickWidth   ?? 0.5],
      rowHeight:    ['float',  inputs.rowHeight     ?? 0.25],
    })
    this._outputs = this.createOutputs({ Color: 'color', Fac: 'float' })
  }

  getInputSockets()  { return this._inputs  }
  getOutputSockets() { return this._outputs }
  compileDefs()      { return BrickTexture.glslFunction }

  compileCall(ctx: CompileContext): string {
    const vec = this._inputs.vector.isConnected()
      ? `vec3(${ctx.outputVar(this._inputs.vector.connection!.node, this._inputs.vector.connection!.name)})`
      : 'vec3(vUv, 0.0)'
    const c1 = ctx.resolveInput(this._inputs.color1)
    const c2 = ctx.resolveInput(this._inputs.color2)
    const mo = ctx.resolveInput(this._inputs.mortar)
    const sc = ctx.resolveInput(this._inputs.scale)
    const ms = ctx.resolveInput(this._inputs.mortarSize)
    const mm = ctx.resolveInput(this._inputs.mortarSmooth)
    const bi = ctx.resolveInput(this._inputs.bias)
    const bw = ctx.resolveInput(this._inputs.brickWidth)
    const rh = ctx.resolveInput(this._inputs.rowHeight)
    const cv = ctx.outputVar(this, 'Color')
    const fv = ctx.outputVar(this, 'Fac')
    return [
      `vec4 _br_${this.id} = _st_brickTexture(${vec}, ${c1}, ${c2}, ${mo}, ${sc}, ${ms}, ${mm}, ${bi}, ${bw}, ${rh});`,
      `vec3  ${cv} = _br_${this.id}.rgb;`,
      `float ${fv} = _br_${this.id}.a;`,
    ].join('\n  ')
  }
}
