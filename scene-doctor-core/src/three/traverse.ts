import type { SceneMaterial, SceneNode } from './types.js'

const PATH_SEPARATOR = '/'
const ANONYMOUS_LABEL = 'unnamed'

export function nodeLabel(node: SceneNode, siblingIndex: number): string {
  const base = node.name || `${ANONYMOUS_LABEL}:${node.type}`
  return node.name ? base : `${base}#${siblingIndex}`
}

export function walkScene(
  root: SceneNode,
  visit: (node: SceneNode, path: string) => void,
): void {
  const stack: Array<{ node: SceneNode; path: string }> = [
    { node: root, path: nodeLabel(root, 0) },
  ]
  while (stack.length > 0) {
    const entry = stack.pop() as { node: SceneNode; path: string } // length checked by loop condition
    visit(entry.node, entry.path)
    entry.node.children.forEach((child, index) => {
      stack.push({ node: child, path: entry.path + PATH_SEPARATOR + nodeLabel(child, index) })
    })
  }
}

export function countNonFinite(values: ArrayLike<number>): number {
  let bad = 0
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) bad++
  }
  return bad
}

export function isFiniteVec(vec: { x: number; y: number; z: number }): boolean {
  return Number.isFinite(vec.x) && Number.isFinite(vec.y) && Number.isFinite(vec.z)
}

export function asMaterialList(material: SceneNode["material"]): SceneMaterial[] {
  if (!material) return []
  return Array.isArray(material) ? material : [material]
}
