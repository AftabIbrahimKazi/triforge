import type { ShaderOutput } from '../types/shader.js'

function hexToVec3(hex: string): string {
  const h = hex.replace('#', '')
  const r = (parseInt(h.substring(0, 2), 16) / 255).toFixed(4)
  const g = (parseInt(h.substring(2, 4), 16) / 255).toFixed(4)
  const b = (parseInt(h.substring(4, 6), 16) / 255).toFixed(4)
  return `vec3(${r}, ${g}, ${b})`
}

/**
 * Color Ramp — Blender ColorRamp node equivalent.
 * Output variable: rampColor (vec3)
 */
export function colorRamp(value: string, colors: string[] = ['#000000', '#ffffff']): ShaderOutput {
  const count        = colors.length
  const colorLiterals = colors.map(hexToVec3).join(', ')

  const defs = `
vec3 colorRamp(float t) {
  vec3 _cr[${count}] = vec3[${count}](${colorLiterals});
  float scaled = clamp(t, 0.0, 1.0) * float(${count - 1});
  int   idx    = int(floor(scaled));
  int   next   = min(idx + 1, ${count - 1});
  return mix(_cr[idx], _cr[next], fract(scaled));
}
`

  const call = `vec3 rampColor = colorRamp(${value});`

  return { defs, call, varName: 'rampColor', type: 'vec3', uniforms: {} }
}

/**
 * Principled BSDF — simplified PBR, Blender Principled BSDF node equivalent.
 * Output variable: bsdf (vec3)
 */
export function principalBSDF(
  baseColor: string,
  roughness: string = '0.5',
  metallic:  string = '0.0'
): ShaderOutput {
  const defs = `
vec3 principledBSDF(vec3 baseColor, float roughness, float metallic) {
  vec3  diffuse  = baseColor * (1.0 - metallic);
  vec3  specular = mix(vec3(0.04), baseColor, metallic);
  float gloss    = 1.0 - roughness;
  return diffuse * (0.5 + 0.5 * gloss) + specular * gloss * gloss;
}
`

  const call = `vec3 bsdf = principledBSDF(${baseColor}, ${roughness}, ${metallic});`

  return { defs, call, varName: 'bsdf', type: 'vec3', uniforms: {} }
}
