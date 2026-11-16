import { BackSide, Matrix3, Vector3 } from 'three'
import type { BufferAttribute, InterleavedBufferAttribute, Mesh, Side } from 'three'

import type { MeshRange, TriangleSoup } from './types.js'

type AnyAttribute = BufferAttribute | InterleavedBufferAttribute

const VERTS_PER_TRI = 3
const POS_FLOATS = 9
const UV_FLOATS = 6
const NORMAL_FLOATS = 3
const MIN_NORMAL_LENGTH = 1e-12
const LIGHTMAP_UV_NAMES = ['uv1', 'uv2'] as const

function lightmapUvs(mesh: Mesh, meshIndex: number): AnyAttribute {
  for (const name of LIGHTMAP_UV_NAMES) {
    const attribute = mesh.geometry.getAttribute(name)
    if (attribute) return attribute
  }
  throw new Error(`LightBaker: mesh #${meshIndex} has no uv1 (lightmap UV) attribute`)
}

function firstMaterialSide(mesh: Mesh): Side | undefined {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material?.side
}

function triangleCount(mesh: Mesh): number {
  const position = mesh.geometry.getAttribute('position')
  const vertices = mesh.geometry.index ? mesh.geometry.index.count : position.count
  return Math.floor(vertices / VERTS_PER_TRI)
}

export function buildSoup(meshes: readonly Mesh[]): TriangleSoup {
  const total = meshes.reduce((sum, mesh) => sum + triangleCount(mesh), 0)
  const positions = new Float32Array(total * POS_FLOATS)
  const uvs = new Float32Array(total * UV_FLOATS)
  const normals = new Float32Array(total * NORMAL_FLOATS)
  const triangleMesh = new Uint32Array(total)
  const meshRanges: MeshRange[] = []

  const corner = [new Vector3(), new Vector3(), new Vector3()]
  const edgeA = new Vector3()
  const edgeB = new Vector3()
  const face = new Vector3()
  const vertexNormal = new Vector3()
  const averaged = new Vector3()
  const normalMatrix = new Matrix3()
  let written = 0

  meshes.forEach((mesh, meshIndex) => {
    mesh.updateWorldMatrix(true, false)
    normalMatrix.getNormalMatrix(mesh.matrixWorld)
    const geometry = mesh.geometry
    const position = geometry.getAttribute('position')
    const uv = lightmapUvs(mesh, meshIndex)
    const normalAttribute = geometry.getAttribute('normal')
    const index = geometry.index
    const first = written
    const flipped = firstMaterialSide(mesh) === BackSide

    for (let t = 0; t < triangleCount(mesh); t++) {
      const ids = [0, 1, 2].map((v) => (index ? index.getX(t * VERTS_PER_TRI + v) : t * VERTS_PER_TRI + v))
      ids.forEach((id, v) => {
        corner[v].fromBufferAttribute(position, id).applyMatrix4(mesh.matrixWorld)
      })
      edgeA.subVectors(corner[1], corner[0])
      edgeB.subVectors(corner[2], corner[0])
      face.crossVectors(edgeA, edgeB)
      if (face.length() < MIN_NORMAL_LENGTH) continue
      face.normalize()

      if (normalAttribute) {
        averaged.set(0, 0, 0)
        ids.forEach((id) => {
          averaged.add(vertexNormal.fromBufferAttribute(normalAttribute, id).applyMatrix3(normalMatrix))
        })
        if (face.dot(averaged) < 0) face.negate()
      }
      if (flipped) face.negate()

      ids.forEach((id, v) => {
        positions[written * POS_FLOATS + v * 3] = corner[v].x
        positions[written * POS_FLOATS + v * 3 + 1] = corner[v].y
        positions[written * POS_FLOATS + v * 3 + 2] = corner[v].z
        uvs[written * UV_FLOATS + v * 2] = uv.getX(id)
        uvs[written * UV_FLOATS + v * 2 + 1] = uv.getY(id)
      })
      normals[written * NORMAL_FLOATS] = face.x
      normals[written * NORMAL_FLOATS + 1] = face.y
      normals[written * NORMAL_FLOATS + 2] = face.z
      triangleMesh[written] = meshIndex
      written++
    }
    meshRanges.push({ start: first, end: written })
  })

  return {
    count: written,
    positions: positions.slice(0, written * POS_FLOATS),
    uvs: uvs.slice(0, written * UV_FLOATS),
    normals: normals.slice(0, written * NORMAL_FLOATS),
    triangleMesh: triangleMesh.slice(0, written),
    meshRanges,
  }
}
