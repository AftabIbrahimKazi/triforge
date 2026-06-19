import { OutputNode }    from '../../core/OutputNode.js'
import { CompileContext } from '../../core/CompileContext.js'
import { ShaderMaterial, Mesh, PlaneGeometry, Vector2, Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import type { OutputSocket }      from '../../core/OutputSocket.js'
import type { NodeMetadata }      from '../../core/ShaderNode.js'

/**
 * ScreenOutput — renders a node graph to a fullscreen quad.
 *
 * After compile():
 *   scene.add(out.mesh)                          — add to scene
 *   out.updateCamera(camera, w, h)               — call each frame
 *   renderer.render(scene, camera)               — renders the shader
 *
 * @example
 * const cam   = new ScreenCamera()
 * const march = new SchwarzschildMarch({ rayPos: cam.output('RayPos'), rayDir: cam.output('RayDir') })
 * const out   = new ScreenOutput({ color: march.output('Color') })
 * out.compile()
 * scene.add(out.mesh)
 * // in loop: out.updateCamera(camera, innerWidth, innerHeight)
 */
export class ScreenOutput extends OutputNode {
  get nodeType() { return 'ScreenOutput' }

  get metadata(): NodeMetadata {
    return { label: 'Screen Output', category: 'Output', color: '#a06030', cost: 'low' }
  }

  mesh: Mesh | null = null

  private readonly _inputs: Record<string, import('../../core/InputSocket.js').InputSocket<unknown>>

  constructor(inputs: { color?: OutputSocket } = {}) {
    super('ScreenOutput')
    this._inputs = this.createInputs(inputs as Record<string, unknown>, {
      color: ['color', null, true],
    })
  }

  getInputSockets() { return this._inputs }
  compileDefs():    string { return '' }

  compileCall(ctx: CompileContext): string {
    const cv = this._inputs.color.isConnected()
      ? ctx.outputVar(this._inputs.color.connection!.node, this._inputs.color.connection!.name)
      : 'vec3(0.5)'
    return `gl_FragColor = vec4(${cv}, 1.0);`
  }

  compile(): ShaderMaterial {
    const ctx      = new CompileContext()
    const compiled = ctx.compile(this)

    const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vUv       = uv;
  vNormal   = normal;
  vPosition = position;
  gl_Position = vec4(position, 1.0);
}`.trim()

    const camUniforms: Record<string, { value: unknown }> = {
      uSCResolution: { value: new Vector2(
        typeof innerWidth  !== 'undefined' ? innerWidth  : 800,
        typeof innerHeight !== 'undefined' ? innerHeight : 600,
      )},
      uSCCamPos:   { value: new Vector3() },
      uSCCamRight: { value: new Vector3(1, 0, 0) },
      uSCCamUp:    { value: new Vector3(0, 1, 0) },
      uSCCamFwd:   { value: new Vector3(0, 0, -1) },
      uSCFov:      { value: 1.0 },
    }

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader: compiled.fragmentShader,
      uniforms:       { ...compiled.uniforms, ...camUniforms },
      depthTest:      false,
      depthWrite:     false,
    })

    for (const node of compiled.nodes) node._wireParameters(this.material.uniforms)

    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder   = -1

    return this.material
  }

  /** Sync Three.js camera → shader uniforms. Call once per frame. */
  updateCamera(camera: PerspectiveCamera, width: number, height: number): void {
    if (!this.material) return
    const m = camera.matrixWorld
    const u = this.material.uniforms
    ;(u.uSCResolution.value as Vector2).set(width, height)
    ;(u.uSCCamPos.value    as Vector3).setFromMatrixPosition(m)
    ;(u.uSCCamRight.value  as Vector3).setFromMatrixColumn(m, 0)
    ;(u.uSCCamUp.value     as Vector3).setFromMatrixColumn(m, 1)
    ;(u.uSCCamFwd.value    as Vector3).setFromMatrixColumn(m, 2).negate()
    u.uSCFov.value = Math.tan((camera.fov * Math.PI / 180) / 2)
  }
}
