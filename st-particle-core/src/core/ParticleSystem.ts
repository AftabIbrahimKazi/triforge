import { BufferGeometry, Vector3 } from 'three'
import { Particle }          from './Particle.js'
import { SeededRandom }      from './SeededRandom.js'
import { ParticleCache }     from './ParticleCache.js'
import { DeflectorCollider } from './DeflectorCollider.js'
import type { BaseEmitter }  from './BaseEmitter.js'
import type { BaseForce }    from './BaseForce.js'
import type { BaseRenderer } from './BaseRenderer.js'
import type { KeyedPhysics } from '../physics/KeyedPhysics.js'

export interface ParticleSystemOptions {
  /** Total particle count — pool size (Blender: Number) */
  count?:            number
  /** Emission start in seconds (Blender: Frame Start → seconds) */
  start?:            number
  /** Emission end in seconds (Blender: End → seconds) */
  end?:              number
  /** Base lifetime per particle in seconds (Blender: Lifetime) */
  lifetime?:         number
  /** Lifetime variation 0–1 (Blender: Lifetime Randomness) */
  lifetimeRandom?:   number
  /** Base particle size in world units (Blender: Size) */
  size?:             number
  /** Size variation 0–1 (Blender: Size Random) */
  sizeRandom?:       number
  /** Random seed — same seed = same simulation (Blender: Seed) */
  seed?:             number
  /** Randomise emission order (Blender: Random Order) */
  randomOrder?:      boolean
  /** Physics type (Blender: Physics Type) */
  physics?:          'newtonian' | 'none'
  /** Particle mass — affects force response (Blender: Mass) */
  mass?:             number
  /** Air resistance 0–1 (Blender: Drag) */
  drag?:             number
  /** Thermal random motion magnitude (Blender: Brownian) */
  brownian?:         number
  /** Velocity damping per second 0–1 (Blender: Damp) */
  damp?:             number
  /** Gravity multiplier (Blender: Gravity) */
  gravity?:          number
  /** Kill particle on collision (Blender: Die on Hit) */
  dieOnHit?:         boolean
  /** % of particles shown in viewport 0–1 (Blender: Display Amount) */
  displayAmount?:    number
  /** Enable speed clamping (Blender: Physics → Newtonian → Limit Velocity). 0/1 toggle. */
  limitVelocity?:    number
  /** Maximum speed in world units/s when limitVelocity is enabled (Blender: Velocity Limit) */
  velocityLimit?:    number
  /** Source geometry for mesh-based emitters */
  geometry?:         BufferGeometry | null
  /**
   * Live geometry provider callback — called once per update() to obtain
   * the current source geometry. Use this to wire a modifier stack so
   * particles always emit from the post-modifier surface without any
   * cross-package import.
   *
   * @example
   * const stack = new ModifierStack(baseGeo)
   * stack.add(new SubdivisionModifier({ levels: 2 }))
   * system.geometryProvider = () => stack.apply()
   */
  geometryProvider?: () => BufferGeometry

  // ── Rotation panel (Blender: Rotation) ──────────────────────────────────

  /**
   * Initial rotation axis (Blender: Orientation Axis).
   * 0=none · 1=velocity · 2=angular · 3=global · 4=local
   */
  rotationAxis?:        0 | 1 | 2 | 3 | 4
  /** Random initial rotation factor 0–1 (Blender: Random) */
  rotationRandom?:      number
  /** Initial rotation offset in radians (Blender: Phase) */
  rotationPhase?:       number
  /** Per-particle phase scatter 0–1 (Blender: Phase Random) */
  rotationPhaseRandom?: number
  /**
   * Angular velocity axis (Blender: Angular Velocity Axis).
   * 0=none · 1=velocity · 2=horizontal · 3=vertical · 4=global · 5=random
   */
  angularVelocityMode?:   0 | 1 | 2 | 3 | 4 | 5
  /** Spin speed in rad/s (Blender: Angular Velocity Amount) */
  angularVelocityAmount?: number

  // ── Children panel (Blender: Children) ──────────────────────────────────

  /**
   * Number of child particles per parent (Blender: Amount).
   * 0 = disabled. GSAP-animatable integer.
   */
  childCount?: number
  /**
   * Scatter radius around parent for Simple children (Blender: Roughness).
   * 0 = children spawn exactly at the parent position. GSAP-animatable.
   */
  childSpread?: number
  /**
   * Child type — stored as a number for GSAP compatibility.
   * 0 = none (disabled) · 1 = simple (sphere scatter) · 2 = interpolated
   */
  childType?: 0 | 1 | 2
}

/**
 * ParticleSystem — central simulation loop.
 *
 * Owns the particle pool, runs emission scheduling, steps Newtonian physics,
 * applies forces, and calls the renderer each frame.
 *
 * Blender parallel: the Particle System object on a mesh.
 */
export class ParticleSystem {
  /** All public parameters — GSAP / keyframe compatible */
  parameters: Record<string, number>

  private _pool:       Particle[]
  private _emitters:   BaseEmitter[]
  private _forces:     BaseForce[]
  private _deflectors: DeflectorCollider[]
  private _renderer:   BaseRenderer | null
  private _rng:        SeededRandom
  private _childRng:   SeededRandom   // reset from seed each frame — stable child positions
  private _time:       number
  private _emitCursor: number
  private _emitAccum:  number   // fractional particle accumulator
  private _geometry:         BufferGeometry | null
  private _geometryProvider: (() => BufferGeometry) | null
  private readonly _tmpVec:  Vector3 = new Vector3()
  private readonly _prevPos: Vector3 = new Vector3()  // saved before integration for collision
  private readonly _hitNorm: Vector3 = new Vector3()
  private readonly _hitPt:   Vector3 = new Vector3()
  private _cache:         ParticleCache
  private _baked:         boolean
  private _keyedPhysics:  KeyedPhysics | null = null

  constructor(opts: ParticleSystemOptions = {}) {
    this.parameters = {
      count:          opts.count          ?? 1000,
      start:          opts.start          ?? 0,
      end:            opts.end            ?? 10,
      lifetime:       opts.lifetime       ?? 2,
      lifetimeRandom: opts.lifetimeRandom ?? 0,
      size:           opts.size           ?? 0.1,
      sizeRandom:     opts.sizeRandom     ?? 0,
      seed:           opts.seed           ?? 0,
      randomOrder:    opts.randomOrder    ? 1 : 0,
      // physics: 0 = none, 1 = newtonian
      physics:        opts.physics === 'none' ? 0 : 1,
      mass:           opts.mass           ?? 1,
      drag:           opts.drag           ?? 0,
      brownian:       opts.brownian       ?? 0,
      damp:           opts.damp           ?? 0,
      gravity:        opts.gravity        ?? 1,
      dieOnHit:       opts.dieOnHit       ? 1 : 0,
      selfEffect:     0,
      displayAmount:  opts.displayAmount  ?? 1,
      // Rotation panel
      rotationAxis:         opts.rotationAxis         ?? 0,
      rotationRandom:       opts.rotationRandom       ?? 0,
      rotationPhase:        opts.rotationPhase        ?? 0,
      rotationPhaseRandom:  opts.rotationPhaseRandom  ?? 0,
      angularVelocityMode:  opts.angularVelocityMode  ?? 0,
      angularVelocityAmount: opts.angularVelocityAmount ?? 0,
      // Children panel
      childCount:  opts.childCount  ?? 0,
      childSpread: opts.childSpread ?? 0.5,
      childType:   opts.childType   ?? 0,
      // Scale Time (Blender: Physics → Newtonian → Scale Time)
      scaleTime:   1,
      // Speed Limit (Blender: Physics → Newtonian → Limit Velocity)
      limitVelocity: opts.limitVelocity ?? 0,
      velocityLimit: opts.velocityLimit ?? 10,
    }

    this._pool       = Array.from({ length: Math.round(this.parameters.count) }, () => new Particle())
    this._emitters   = []
    this._forces     = []
    this._deflectors = []
    this._renderer   = null
    this._rng        = new SeededRandom(Math.round(this.parameters.seed))
    this._childRng   = new SeededRandom(Math.round(this.parameters.seed))
    this._time       = 0
    this._emitCursor = 0
    this._emitAccum  = 0
    this._geometry         = opts.geometry ?? null
    this._geometryProvider = opts.geometryProvider ?? null
    this._cache      = new ParticleCache()
    this._baked      = false
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Package-internal pool accessor — used by ParticleCache and BoidForce. */
  get pool(): Particle[] { return this._pool }

  /** Current number of alive particles this frame. */
  get liveCount(): number {
    let n = 0
    for (const p of this._pool) if (p.alive) n++
    return n
  }

  /** The bake/cache object for this system. */
  get cache(): ParticleCache { return this._cache }

  /**
   * Bake the simulation to a replayable cache.
   * After this returns update() replays the cache instead of simulating.
   */
  bake(startSec: number, endSec: number, fps: number): void {
    this._cache.bake(this, startSec, endSec, fps)
    this._baked = true
    this._time  = 0
  }

  /**
   * Return to live simulation.  Clears the cache, resets internal time and pool state.
   */
  unbake(): void {
    this._baked = false
    this._cache.clear()
    this.reset()
  }

  addEmitter(emitter: BaseEmitter): this {
    this._emitters.push(emitter)
    return this
  }

  addForce(force: BaseForce): this {
    this._forces.push(force)
    return this
  }

  addDeflector(deflector: DeflectorCollider): this {
    this._deflectors.push(deflector)
    return this
  }

  setRenderer(renderer: BaseRenderer): this {
    this._renderer = renderer
    return this
  }

  setGeometry(geo: BufferGeometry): this {
    this._geometry = geo
    return this
  }

  /**
   * Set a live geometry provider callback.
   * Called once per update() — use to wire a modifier stack without any
   * cross-package import. Overrides any geometry set via setGeometry().
   *
   * @example
   * const stack = new ModifierStack(baseGeo)
   * stack.add(new SubdivisionModifier({ levels: 2 }))
   * system.setGeometryProvider(() => stack.apply())
   */
  setGeometryProvider(fn: (() => BufferGeometry) | null): this {
    this._geometryProvider = fn
    return this
  }

  /**
   * Show or hide the emitter mesh in the viewport.
   * Blender: Render → Show Emitter toggle.
   *
   * Pass the same Object3D you added to the scene.
   *   sys.showEmitter(sphereMesh, false) // hide while particles are visible
   */
  showEmitter(mesh: { visible: boolean }, visible: boolean): this {
    mesh.visible = visible
    return this
  }

  /**
   * Attach a KeyedPhysics blender.
   * When set, keyed blending is applied after each step.
   * Drive `kp.parameters.blend` via GSAP or AnimationMixer from st-keyframe.
   */
  setKeyedPhysics(kp: KeyedPhysics): this {
    this._keyedPhysics = kp
    return this
  }

  /**
   * Advance the simulation by dt seconds.
   * Call this once per frame from your render loop.
   * In baked mode, seeks the cache instead of simulating.
   */
  update(dt: number): void {
    if (this._baked) {
      this._time += dt
      this._cache.seek(this, this._time)
      if (this._renderer) {
        this._childRng.reset(Math.round(this.parameters.seed))
        let alive = 0
        for (const p of this._pool) { if (p.alive) alive++ }
        this._renderer.update(this._pool, alive, this.parameters, this._childRng)
      }
      return
    }

    const effectiveDt = dt * this.parameters.scaleTime
    this._time += effectiveDt

    // Resolve geometry once per frame — provider takes priority over static geo
    if (this._geometryProvider) {
      this._geometry = this._geometryProvider()
    }

    const p = this.parameters
    const inEmissionWindow = this._time >= p.start && this._time <= p.end

    // ── Emit new particles ──────────────────────────────────────────────────
    // Rate = count / lifetime so the pool stays full at steady state.
    if (inEmissionWindow && this._emitters.length > 0 && effectiveDt > 0) {
      const rate = p.count / Math.max(p.lifetime * (1 - p.lifetimeRandom * 0.5), 0.001)
      this._emitAccum = Math.max(0, (this._emitAccum ?? 0) + rate * effectiveDt)
      const toEmit    = Math.floor(this._emitAccum)
      this._emitAccum -= toEmit

      for (let i = 0; i < toEmit; i++) {
        this._emit()
      }
    }

    // ── Step alive particles ────────────────────────────────────────────────
    let alive = 0
    for (const particle of this._pool) {
      if (!particle.alive) continue

      particle.age += effectiveDt
      if (particle.age >= particle.lifetime || particle.age < 0) {
        particle.alive = false
        continue
      }

      particle.normalised = particle.age / particle.lifetime

      if (p.physics === 1) {
        this._stepNewtonian(particle, effectiveDt)
      }

      alive++
    }

    // ── Self-collision pass ──────────────────────────────────────────────────
    if (p.selfEffect >= 0.5 && alive > 1) {
      this._stepSelfCollision()
    }

    // ── Keyed physics blend ──────────────────────────────────────────────────
    if (this._keyedPhysics) {
      this._keyedPhysics.apply(this._pool, effectiveDt)
    }

    // ── Renderer update ─────────────────────────────────────────────────────
    if (this._renderer) {
      // Reset child RNG to the base seed each frame → stable child positions.
      this._childRng.reset(Math.round(this.parameters.seed))
      this._renderer.update(this._pool, alive, this.parameters, this._childRng)
    }
  }

  /** Reset the simulation to t=0 */
  reset(): void {
    this._time       = 0
    this._emitCursor = 0
    this._emitAccum  = 0
    this._rng.reset(Math.round(this.parameters.seed))
    this._childRng.reset(Math.round(this.parameters.seed))
    for (const p of this._pool) p.reset()
  }

  dispose(): void {
    this._renderer?.dispose()
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _emit(): void {
    const count      = this._pool.length
    const useRandom  = this.parameters.randomOrder > 0
    let slot: Particle | null = null

    if (useRandom) {
      // Randomised order: search from a random starting position
      const startIdx = Math.floor(this._rng.next() * count)
      for (let i = 0; i < count; i++) {
        const idx = (startIdx + i) % count
        if (!this._pool[idx].alive) {
          slot = this._pool[idx]
          break
        }
      }
      // All slots alive — overwrite a random slot
      if (!slot) {
        slot = this._pool[Math.floor(this._rng.next() * count)]
      }
    } else {
      // Sequential order — wrap around with cursor
      for (let i = 0; i < count; i++) {
        const idx = (this._emitCursor + i) % count
        if (!this._pool[idx].alive) {
          slot = this._pool[idx]
          this._emitCursor = (idx + 1) % count
          break
        }
      }
      // All slots alive — overwrite the cursor slot (oldest)
      if (!slot) {
        slot = this._pool[this._emitCursor]
        this._emitCursor = (this._emitCursor + 1) % count
      }
    }

    slot.reset()
    slot.alive = true
    slot.age   = 0

    // Lifetime: base ± lifetimeRandom × rand  (Blender: Lifetime Randomness)
    const lr = this.parameters.lifetimeRandom
    slot.lifetime = Math.max(0.001, this.parameters.lifetime * (1 + lr * this._rng.signed()))

    // Size
    const sr = this.parameters.sizeRandom
    slot.size = this.parameters.size * (1 - sr * this._rng.next())

    // Pick emitter uniformly at random
    if (this._emitters.length > 0) {
      const eIdx    = Math.floor(this._rng.next() * this._emitters.length)
      const emitter = this._emitters[Math.min(eIdx, this._emitters.length - 1)]
      emitter.spawn(slot, this._geometry, this._rng)
    }

    this._initRotation(slot)
  }

  private _initRotation(slot: Particle): void {
    const p = this.parameters

    // ── Initial rotation ────────────────────────────────────────────────────
    // phase + per-particle scatter (Blender: Phase + Phase Random)
    const phase   = p.rotationPhase + p.rotationPhaseRandom * Math.PI * this._rng.signed()
    // rotationRandom adds additional scatter (Blender: Random)
    const scatter = p.rotationRandom * Math.PI * this._rng.signed()
    const angle   = phase + scatter

    switch (Math.round(p.rotationAxis)) {
      case 0: // none — leave rotation at zero
        break
      case 1: { // velocity — rotate around velocity direction using that axis as Y
        const len = slot.velocity.length()
        if (len > 1e-6) {
          this._tmpVec.copy(slot.velocity).divideScalar(len)
          slot.rotation.set(
            this._tmpVec.x * angle,
            this._tmpVec.y * angle,
            this._tmpVec.z * angle,
          )
        }
        break
      }
      case 2: // angular — spin around particle local Z
      case 3: // global  — spin around world Z
      case 4: // local   — spin around local Z
        slot.rotation.z = angle
        break
      default:
        break
    }

    // ── Angular velocity ────────────────────────────────────────────────────
    const amount = p.angularVelocityAmount
    if (amount === 0) return

    switch (Math.round(p.angularVelocityMode)) {
      case 0: // none
        break
      case 1: { // velocity — spin axis aligned with velocity direction
        const len = slot.velocity.length()
        if (len > 1e-6) {
          slot.angularVel.copy(slot.velocity).multiplyScalar(amount / len)
        }
        break
      }
      case 2: // horizontal — spin around world Y (up axis)
        slot.angularVel.set(0, amount, 0)
        break
      case 3: // vertical — spin around world X
        slot.angularVel.set(amount, 0, 0)
        break
      case 4: // global — spin around world Z
        slot.angularVel.set(0, 0, amount)
        break
      case 5: { // random — spin around a random unit axis
        const rx = this._rng.signed()
        const ry = this._rng.signed()
        const rz = this._rng.signed()
        const len = Math.sqrt(rx * rx + ry * ry + rz * rz)
        if (len > 1e-6) {
          slot.angularVel.set(rx / len * amount, ry / len * amount, rz / len * amount)
        }
        break
      }
      default:
        break
    }
  }

  private _stepNewtonian(particle: Particle, dt: number): void {
    const p = this.parameters

    // Apply all forces: F = ma → a = F/m → dv = a·dt
    for (const force of this._forces) {
      if (force.enabled) force.apply(particle, dt)
    }

    // Gravity (world -Y)
    particle.velocity.y -= 9.81 * p.gravity * dt / Math.max(p.mass, 0.0001)

    // Air drag: dv = -drag · v · dt
    if (p.drag > 0) {
      particle.velocity.multiplyScalar(1 - Math.min(p.drag * dt, 1))
    }

    // Velocity damping
    if (p.damp > 0) {
      particle.velocity.multiplyScalar(1 - Math.min(p.damp * dt, 1))
    }

    // Brownian motion (thermal noise)
    if (p.brownian > 0) {
      const b = p.brownian * dt
      particle.velocity.x += (Math.random() * 2 - 1) * b
      particle.velocity.y += (Math.random() * 2 - 1) * b
      particle.velocity.z += (Math.random() * 2 - 1) * b
    }

    // Guard against NaN/Infinity in velocity before integration
    if (!isFinite(particle.velocity.x)) particle.velocity.x = 0
    if (!isFinite(particle.velocity.y)) particle.velocity.y = 0
    if (!isFinite(particle.velocity.z)) particle.velocity.z = 0

    // Save position before integration for collision crossing detection
    this._prevPos.copy(particle.position)

    // Integrate position
    particle.position.addScaledVector(particle.velocity, dt)

    // Guard against NaN/Infinity in position after integration
    if (!isFinite(particle.position.x)) particle.position.x = 0
    if (!isFinite(particle.position.y)) particle.position.y = 0
    if (!isFinite(particle.position.z)) particle.position.z = 0

    // ── Deflector collisions ─────────────────────────────────────────────────
    if (this._deflectors.length > 0) {
      for (const deflector of this._deflectors) {
        if (deflector.checkCrossing(
          this._prevPos.x, this._prevPos.y, this._prevPos.z,
          particle.position.x, particle.position.y, particle.position.z,
          this._hitNorm, this._hitPt,
          particle.size * 0.5,
        )) {
          if (p.dieOnHit >= 0.5) {
            particle.alive = false
            break
          }

          const damping  = deflector.parameters.damping
          const friction = deflector.parameters.friction
          const nx = this._hitNorm.x, ny = this._hitNorm.y, nz = this._hitNorm.z

          // Reflect: v_new = v - (2 - damping) * dot(v,n) * n
          // damping=0 → elastic (speed conserved), damping=1 → inelastic (normal=0)
          const vDotN = particle.velocity.x * nx + particle.velocity.y * ny + particle.velocity.z * nz
          const k     = (2 - damping) * vDotN
          particle.velocity.x -= k * nx
          particle.velocity.y -= k * ny
          particle.velocity.z -= k * nz

          // Friction: reduce tangential component
          // v_final = (1-friction)*v_reflected + friction*dot(v_reflected,n)*n
          if (friction > 0) {
            const vNewDotN = particle.velocity.x * nx + particle.velocity.y * ny + particle.velocity.z * nz
            particle.velocity.x = (1 - friction) * particle.velocity.x + friction * vNewDotN * nx
            particle.velocity.y = (1 - friction) * particle.velocity.y + friction * vNewDotN * ny
            particle.velocity.z = (1 - friction) * particle.velocity.z + friction * vNewDotN * nz
          }

          // Reposition to contact plane to prevent clipping
          particle.position.copy(this._hitPt)
          break
        }
      }
    }

    // Speed limit (Blender: Physics → Newtonian → Limit Velocity)
    if (p.limitVelocity >= 0.5) {
      const limit = Math.max(0, p.velocityLimit)
      const speed = particle.velocity.length()
      if (speed > limit) particle.velocity.multiplyScalar(limit / speed)
    }

    // Integrate rotation from angular velocity
    particle.rotation.addScaledVector(particle.angularVel, dt)
  }

  /**
   * O(n²) inter-particle collision — elastic bounce when two particles overlap.
   * Only runs when parameters.selfEffect >= 0.5 (Blender: Physics → Self Effect).
   */
  private _stepSelfCollision(): void {
    const pool = this._pool
    const n    = pool.length
    for (let i = 0; i < n - 1; i++) {
      const a = pool[i]
      if (!a.alive) continue
      for (let j = i + 1; j < n; j++) {
        const b = pool[j]
        if (!b.alive) continue

        const dx = a.position.x - b.position.x
        const dy = a.position.y - b.position.y
        const dz = a.position.z - b.position.z
        const dist2   = dx * dx + dy * dy + dz * dz
        const minDist = (a.size + b.size) * 0.5

        if (dist2 < minDist * minDist && dist2 > 1e-12) {
          const dist = Math.sqrt(dist2)
          const nx = dx / dist
          const ny = dy / dist
          const nz = dz / dist

          // Relative velocity along collision normal
          const dvn = (a.velocity.x - b.velocity.x) * nx
                    + (a.velocity.y - b.velocity.y) * ny
                    + (a.velocity.z - b.velocity.z) * nz

          // Only respond if particles are approaching
          if (dvn < 0) {
            // Equal-mass elastic: exchange normal-component impulse
            a.velocity.x -= dvn * nx
            a.velocity.y -= dvn * ny
            a.velocity.z -= dvn * nz
            b.velocity.x += dvn * nx
            b.velocity.y += dvn * ny
            b.velocity.z += dvn * nz
          }
        }
      }
    }
  }
}
