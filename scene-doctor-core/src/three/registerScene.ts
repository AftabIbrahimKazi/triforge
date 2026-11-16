import { walkScene } from './traverse.js'
import type { EditSession } from '../core/EditSession.js'
import type { SceneNode } from './types.js'

const TRANSFORM_KEYS = ['x', 'y', 'z']
const LIGHT_KEYS = ['intensity', 'distance', 'angle', 'penumbra', 'decay']
const MATERIAL_KEYS = [
  'roughness', 'metalness', 'opacity', 'emissiveIntensity', 'envMapIntensity',
  'transmission', 'thickness', 'ior', 'clearcoat', 'clearcoatRoughness', 'wireframe', 'transparent',
]

interface EditableNode extends SceneNode {
  rotation?: object
  intensity?: number
  [key: string]: unknown
}

export function registerSceneObjects(session: EditSession, scene: SceneNode): void {
  walkScene(scene, (node, path) => {
    const editable = node as EditableNode // optional light and rotation fields are probed structurally
    session.register(`${path}.position`, node.position, { keys: TRANSFORM_KEYS })
    session.register(`${path}.scale`, node.scale, { keys: TRANSFORM_KEYS })
    if (editable.rotation) session.register(`${path}.rotation`, editable.rotation, { keys: TRANSFORM_KEYS })
    if (typeof editable.intensity === 'number') session.register(path, editable, { keys: LIGHT_KEYS })
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
    materials.forEach((material, index) => {
      session.register(`${path}.material${materials.length > 1 ? index : ''}`, material, { keys: MATERIAL_KEYS })
    })
  })
}
