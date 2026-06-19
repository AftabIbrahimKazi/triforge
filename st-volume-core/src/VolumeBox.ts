import {
  Mesh, BoxGeometry, ShaderMaterial,
  Vector3, Matrix4, Color,
  AdditiveBlending, NormalBlending,
  BackSide,
} from 'three'

export type VolumeType = 'fog' | 'smoke' | 'fire'

export interface VolumeBoxOptions {
  /**
   * Volume preset.
   * 'fog'   — uniform density absorption (Blender: Volume Absorption)
   * 'smoke' — animated noise density scatter (Blender: Volume Scatter + noise)
   * 'fire'  — emission-based fire with density noise (Blender: Principled Volume, fire preset)
   * Default 'fog'.
   */
  type?: VolumeType

  /** World-space box size [x,y,z]. Default [2,2,2]. */
  size?: [number, number, number]

  /** Overall density multiplier. Default 1. */
  density?: number

  /** Primary scatter/absorption colour (hex string). Default '#aaccff' for fog, '#888' for smoke, '#ff6600' for fire. */
  color?: string

  /** Emission colour for fire type (hex string). Default '#ff4400'. */
  emissionColor?: string

  /** Emission strength (fire only). Default 3. */
  emissionStrength?: number

  /** Noise scale — spatial frequency of heterogeneous density. Default 1.5. */
  noiseScale?: number

  /** Noise animation speed. Default 0.3. */
  noiseSpeed?: number

  /** Number of ray-march steps — quality vs performance. Default 48. */
  steps?: number

  /** Henyey-Greenstein anisotropy [-1, 1]. 0=isotropic. Default 0. */
  anisotropy?: number
}

/**
 * VolumeBox — axis-aligned box filled with volumetric media.
 * Blender equivalents: Volume Absorption · Volume Scatter · Principled Volume.
 *
 * Communicates with the scene as a THREE.Mesh — add it to the scene like any mesh.
 * All animation parameters live in `parameters` for GSAP / st-keyframe compatibility.
 *
 * Usage:
 * ```typescript
 * const fog = new VolumeBox({ type: 'fog', density: 0.8, color: '#aaccff' })
 * scene.add(fog.mesh)
 *
 * // Animate density
 * gsap.to(fog.parameters, { density: 0.3, duration: 2 })
 * // Update uniforms each frame:
 * fog.tick(clock.getElapsedTime())
 * ```
 */
export class VolumeBox {
  readonly mesh: Mesh
  readonly material: ShaderMaterial

  /** All scalar parameters — GSAP / st-keyframe compatible. */
  parameters: {
    density:          number
    noiseScale:       number
    noiseSpeed:       number
    steps:            number
    anisotropy:       number
    emissionStrength: number
    colorR: number; colorG: number; colorB: number
    emissionR: number; emissionG: number; emissionB: number
  }

  private readonly _type: VolumeType

  constructor(opts: VolumeBoxOptions = {}) {
    this._type = opts.type ?? 'fog'

    const defaultColor = this._type === 'fire' ? '#ff6600'
                       : this._type === 'smoke' ? '#888888'
                       : '#aaccff'
    const colorHex     = opts.color         ?? defaultColor
    const emitHex      = opts.emissionColor ?? '#ff4400'
    const col          = new Color(colorHex)
    const emit         = new Color(emitHex)

    this.parameters = {
      density:          opts.density          ?? 1,
      noiseScale:       opts.noiseScale        ?? 1.5,
      noiseSpeed:       opts.noiseSpeed        ?? 0.3,
      steps:            opts.steps             ?? 48,
      anisotropy:       opts.anisotropy        ?? 0,
      emissionStrength: opts.emissionStrength  ?? 3,
      colorR: col.r,  colorG: col.g,  colorB: col.b,
      emissionR: emit.r, emissionG: emit.g, emissionB: emit.b,
    }

    const [sx, sy, sz] = opts.size ?? [2, 2, 2]
    const geo = new BoxGeometry(sx, sy, sz)

    this.material = new ShaderMaterial({
      uniforms: {
        uDensity:          { value: this.parameters.density },
        uNoiseScale:       { value: this.parameters.noiseScale },
        uNoiseSpeed:       { value: this.parameters.noiseSpeed },
        uSteps:            { value: this.parameters.steps },
        uAnisotropy:       { value: this.parameters.anisotropy },
        uEmissionStrength: { value: this.parameters.emissionStrength },
        uColor:            { value: new Vector3(col.r, col.g, col.b) },
        uEmission:         { value: new Vector3(emit.r, emit.g, emit.b) },
        uTime:             { value: 0 },
        uBoxSize:          { value: new Vector3(sx, sy, sz) },
        uVolumeType:       { value: this._typeIndex() },
        uCameraLocalPos:   { value: new Vector3() },
      },
      vertexShader:   VolumeBox._vert,
      fragmentShader: VolumeBox._frag,
      side:           BackSide,
      transparent:    true,
      depthWrite:     false,
      blending:       this._type === 'fire' ? AdditiveBlending : NormalBlending,
    })

    this.mesh = new Mesh(geo, this.material)
  }

  /**
   * Call once per frame to sync animated parameters to GPU uniforms.
   * @param time — `clock.getElapsedTime()`
   */
  private _invModel = new Matrix4()
  private _worldCam = new Vector3()

  tick(time: number): void {
    const u = this.material.uniforms
    const p = this.parameters
    u['uTime'].value             = time
    u['uDensity'].value          = p.density
    u['uNoiseScale'].value       = p.noiseScale
    u['uNoiseSpeed'].value       = p.noiseSpeed
    u['uSteps'].value            = Math.max(8, Math.round(p.steps))
    u['uAnisotropy'].value       = p.anisotropy
    u['uEmissionStrength'].value = p.emissionStrength
    u['uColor'].value.set(p.colorR, p.colorG, p.colorB)
    u['uEmission'].value.set(p.emissionR, p.emissionG, p.emissionB)
  }

  /**
   * Set the camera world-space position so the ray-march shader knows the
   * ray origin. Call each frame after the camera has been moved:
   *   vol.setCameraPosition(camera.position.x, camera.position.y, camera.position.z)
   *
   * Converts to object space automatically using the mesh's world matrix.
   */
  setCameraPosition(x: number, y: number, z: number): void {
    this.mesh.updateWorldMatrix(true, false)
    this._invModel.copy(this.mesh.matrixWorld).invert()
    this._worldCam.set(x, y, z)
    ;(this.material.uniforms['uCameraLocalPos'].value as Vector3)
      .copy(this._worldCam)
      .applyMatrix4(this._invModel)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }

  private _typeIndex(): number {
    return this._type === 'fog' ? 0 : this._type === 'smoke' ? 1 : 2
  }

  // ── Vertex shader ─────────────────────────────────────────────────────────

  private static _vert = /* glsl */`
    varying vec3 vWorldPos;
    varying vec3 vLocalPos;

    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorldPos  = world.xyz;
      vLocalPos  = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  // ── Fragment shader ───────────────────────────────────────────────────────

  private static _frag = /* glsl */`
    precision highp float;

    uniform float uDensity;
    uniform float uNoiseScale;
    uniform float uNoiseSpeed;
    uniform float uSteps;
    uniform float uAnisotropy;
    uniform float uEmissionStrength;
    uniform vec3  uColor;
    uniform vec3  uEmission;
    uniform float uTime;
    uniform vec3  uBoxSize;
    uniform int   uVolumeType;
    uniform vec3  uCameraLocalPos;

    varying vec3 vWorldPos;
    varying vec3 vLocalPos;

    // ── Noise ────────────────────────────────────────────────────────────────

    float hash(vec3 p) {
      p = fract(p * vec3(127.1, 311.7, 74.7));
      p += dot(p, p.zyx + 31.32);
      return fract((p.x + p.y) * p.z);
    }

    float noise3(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i),           hash(i + vec3(1,0,0)), u.x),
            mix(hash(i+vec3(0,1,0)),hash(i + vec3(1,1,0)), u.x), u.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),  u.x),
            mix(hash(i+vec3(0,1,1)),hash(i + vec3(1,1,1)), u.x), u.y), u.z);
    }

    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise3(p);
        p  = p * 2.1 + vec3(1.7, 9.2, 3.4);
        a *= 0.5;
      }
      return v;
    }

    // ── Phase function (un-normalized HG — visual range ~0.3..3.0) ──────────
    // Omitting the 1/(4π) denominator keeps scattered values in a visible range.

    float phase(float cosTheta, float g) {
      float g2 = g * g;
      return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
    }

    // ── Ray–AABB intersection ─────────────────────────────────────────────────

    bool intersectBox(vec3 ro, vec3 rd, vec3 halfSize, out float tMin, out float tMax) {
      vec3 inv = 1.0 / rd;
      vec3 tA  = (-halfSize - ro) * inv;
      vec3 tB  = ( halfSize - ro) * inv;
      vec3 t0  = min(tA, tB);
      vec3 t1  = max(tA, tB);
      tMin = max(max(t0.x, t0.y), t0.z);
      tMax = min(min(t1.x, t1.y), t1.z);
      return tMax > max(tMin, 0.0);
    }

    // ── Density sampling ─────────────────────────────────────────────────────

    float sampleDensity(vec3 localPos) {
      if (uVolumeType == 0) {
        // Fog: uniform with soft edge falloff
        vec3 d = abs(localPos) / (uBoxSize * 0.5);
        float edge = 1.0 - smoothstep(0.8, 1.0, max(max(d.x, d.y), d.z));
        return uDensity * edge;
      } else if (uVolumeType == 1) {
        // Smoke: animated noise
        vec3  p   = localPos * uNoiseScale + vec3(0.0, -uTime * uNoiseSpeed, 0.0);
        float n   = fbm(p);
        float rim = 1.0 - smoothstep(0.35, 0.5, length(localPos / (uBoxSize * 0.5)));
        return max(0.0, (n - 0.35) * 2.0) * uDensity * rim;
      } else {
        // Fire: density concentrated at base, thinning toward top
        vec3  hs  = uBoxSize * 0.5;
        float vy  = (localPos.y + hs.y) / (uBoxSize.y);  // 0=bottom, 1=top
        vec3  p   = localPos * uNoiseScale + vec3(0.0, -uTime * uNoiseSpeed * 2.0, 0.0);
        float n   = fbm(p);
        float rim = 1.0 - smoothstep(0.3, 0.5, length(localPos.xz / hs.xz));
        return max(0.0, (n - 0.2) * (1.0 - vy * 0.9)) * uDensity * rim;
      }
    }

    // ── Emission colour at position ───────────────────────────────────────────

    vec3 sampleEmission(vec3 localPos, float density) {
      if (uVolumeType != 2) return vec3(0.0);
      // Fire colour ramp: black → orange → yellow → white
      vec3 hs  = uBoxSize * 0.5;
      float vy = (localPos.y + hs.y) / uBoxSize.y;
      float t  = clamp(density * 1.5, 0.0, 1.0);
      vec3 c0  = vec3(0.0);
      vec3 c1  = uColor;              // base fire colour (orange)
      vec3 c2  = uEmission;           // hot core colour (yellow-white)
      vec3 col = t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
      return col * uEmissionStrength * (1.0 - vy * 0.5);
    }

    void main() {
      // Camera position is already in local (object) space — computed on CPU
      vec3 ro    = uCameraLocalPos;
      vec3 rd    = normalize(vLocalPos - ro);
      vec3 halfS = uBoxSize * 0.5;

      float tMin, tMax;
      if (!intersectBox(ro, rd, halfS, tMin, tMax)) {
        discard;
      }
      tMin = max(tMin, 0.0);

      // Simple sun direction (fixed — enough for visual quality)
      vec3 sunDir   = normalize(vec3(0.5, 1.0, 0.3));
      float cosTheta = dot(rd, sunDir);
      float ph       = phase(cosTheta, uAnisotropy);

      float stepSize  = (tMax - tMin) / uSteps;
      vec3  transmit  = vec3(1.0);
      vec3  scattered = vec3(0.0);
      vec3  emitted   = vec3(0.0);

      for (int i = 0; i < 128; i++) {
        if (float(i) >= uSteps) break;
        float t       = tMin + (float(i) + 0.5) * stepSize;
        vec3  localP  = ro + rd * t;
        float dens    = sampleDensity(localP);
        if (dens < 0.0001) continue;

        // Beer–Lambert extinction
        vec3 sigma_t  = uColor * dens;
        vec3 extinction = exp(-sigma_t * stepSize);
        vec3 weight     = transmit * (vec3(1.0) - extinction);

        // In-scatter: sun (directional) + ambient fill
        float ambient = 0.35;
        scattered  += weight * uColor * (ph * 0.45 + ambient);

        // Emission (fire)
        emitted    += weight * sampleEmission(localP, dens);

        transmit   *= extinction;
        if (max(transmit.r, max(transmit.g, transmit.b)) < 0.01) break;
      }

      float alpha = 1.0 - (transmit.r + transmit.g + transmit.b) / 3.0;
      vec3  color = scattered + emitted;

      if (alpha < 0.001) discard;
      gl_FragColor = vec4(color, alpha);
    }
  `
}
