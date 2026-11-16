export interface SceneVec3 {
  x: number
  y: number
  z: number
}

export interface SceneAttribute {
  array: ArrayLike<number>
}

export interface SceneGeometry {
  attributes: Record<string, SceneAttribute | undefined>
}

export interface SceneTexture {
  image?: unknown
  isTexture?: boolean
}

export interface SceneMaterial {
  name?: string
  [key: string]: unknown
}

export interface SceneNode {
  name: string
  type: string
  children: SceneNode[]
  position: SceneVec3
  scale: SceneVec3
  visible: boolean
  geometry?: SceneGeometry
  material?: SceneMaterial | SceneMaterial[]
  shadow?: { mapSize: { x: number; y: number } }
}

export interface SceneGl {
  getShaderInfoLog(shader: unknown): string | null
}

export interface SceneRendererInfo {
  memory: { geometries: number; textures: number }
  render: { calls: number; triangles: number }
}

export interface SceneRenderer {
  info: SceneRendererInfo
  debug?: {
    onShaderError?: ((gl: SceneGl, program: unknown, vertex: unknown, fragment: unknown) => void) | null
  }
}

export interface RenderBudgets {
  maxDrawCalls: number
  maxTriangles: number
}

export interface LeakSource {
  leaking(): string[]
}

export interface ThreeSceneContext {
  scene: SceneNode
  renderer?: SceneRenderer
  shaderErrors?: readonly string[]
  leaks?: LeakSource
  frameSample?: ArrayLike<number>
  budgets?: Partial<RenderBudgets>
}
