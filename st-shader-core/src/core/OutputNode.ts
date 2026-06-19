import { ShaderNode } from './ShaderNode.js'
import { CompileContext } from './CompileContext.js'
import { ShaderMaterial, Vector3 } from 'three'
import type { OutputSocket } from './OutputSocket.js'

/**
 * Terminal node — inputs only, no outputs.
 * Owns compile() — the entry point for the entire graph.
 * Example: MaterialOutput.
 */
export abstract class OutputNode extends ShaderNode {
  /** The compiled THREE.ShaderMaterial — available after compile() is called. */
  material: ShaderMaterial | null = null

  getOutputSockets(): Record<string, OutputSocket> {
    return {}
  }

  compileDefs(): string {
    return ''
  }

  /**
   * Walks the full node graph, validates all connections,
   * compiles to GLSL, and returns a ready-to-use THREE.ShaderMaterial.
   *
   * The result is also stored on .material so it can be reused
   * across any number of meshes without recompiling.
   *
   * @example
   * const blueMetal = new MaterialOutput({ surface: bsdf.output('BSDF') })
   * blueMetal.compile()
   *
   * const torus  = new THREE.Mesh(torusGeo,  blueMetal.material)
   * const sphere = new THREE.Mesh(sphereGeo, blueMetal.material)
   */
  compile(): ShaderMaterial {
    const ctx      = new CompileContext()
    const compiled = ctx.compile(this)
    this.material  = new ShaderMaterial({
      vertexShader:   compiled.vertexShader,
      fragmentShader: compiled.fragmentShader,
      uniforms:       compiled.uniforms,
    })
    // Inject default scene-lighting uniforms used by PrincipledBSDF.
    // Users can override these after compile() to match their scene lights.
    if (!this.material.uniforms.uSunDirection) {
      this.material.uniforms.uSunDirection = { value: new Vector3(1, 2, 1).normalize() }
    }
    if (!this.material.uniforms.uSunColor) {
      this.material.uniforms.uSunColor = { value: new Vector3(1.0, 0.97, 0.9) }
    }
    if (!this.material.uniforms.uAmbientColor) {
      this.material.uniforms.uAmbientColor = { value: new Vector3(0.05, 0.08, 0.18) }
    }
    // Wire each node's parameters object to the live GPU uniforms
    for (const node of compiled.nodes) {
      node._wireParameters(this.material.uniforms)
    }
    return this.material
  }
}
