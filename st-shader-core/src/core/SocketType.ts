/**
 * Socket types mirror Blender's socket colours.
 *
 * shader  — yellow  — BSDF / material output
 * color   — yellow-green — vec3 RGB
 * vector  — purple  — vec2 / vec3 spatial
 * float   — grey    — single scalar
 */
export type SocketType = 'shader' | 'color' | 'vector' | 'float'

/** Maps SocketType to its GLSL primitive. */
export const SOCKET_GLSL_TYPE: Record<SocketType, string> = {
  shader: 'vec3',
  color:  'vec3',
  vector: 'vec2',
  float:  'float',
}
