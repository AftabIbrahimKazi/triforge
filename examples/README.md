# Examples

All example files run in the browser with no build step.
Open any `.html` file directly — Three.js is loaded from CDN.
Package builds must exist before running examples: run `npm run build` inside the relevant package folder.

---

## shader/
Examples for `@st-shader-core` nodes.

| File | Demonstrates |
|---|---|
| example-parameters-refactor.html | Public `parameters` object pattern — GSAP-compatible node inputs |
| example-rgb-curves.html | RGBCurves node — per-channel colour grading |
| example-vector-curves.html | VectorCurves node — per-axis vector remapping |
| example-voronoi-modes.html | VoronoiTexture — F1, F2, Smooth, Distance to Edge modes |
| example-bsdf-shaders.html | All BSDF shaders side-by-side: Diffuse, Glossy, Glass, Sheen, Specular, Translucent, Toon, Refraction, SubsurfaceScattering |
| example-emission-blend.html | Emission, MixShader, AddShader, ShaderToRGB, Fresnel |
| example-texture-nodes.html | MagicTexture, MusgraveTexture, GradientTexture, BrickTexture, CheckerTexture, WaveTexture, WhiteNoise, HashValue |
| example-image-texture.html | ImageTexture node — external texture injection via uniform |
| example-color-nodes.html | MixRGB, HueSaturationValue, InvertColor, BrightContrast, Gamma, RGBtoBW |
| example-converter-nodes.html | MapRange, Clamp, FloatCurve, Blackbody, Wavelength |
| example-vector-nodes.html | Bump, NormalMap, Mapping, VectorRotate, VectorTransform, VectorMath |
| example-input-nodes.html | LayerWeight, CameraData, Wireframe, ObjectInfo, Tangent, ColorAttribute |

---

## modifier/
Examples for `@st-modifier-core` modifiers.

| File | Demonstrates |
|---|---|
| example-mirror-weld.html | MirrorModifier — axis mirroring with weld |
| example-subdivision-loop.html | SubdivisionModifier — Loop subdivision levels |
| example-modifier-deform.html | TwistModifier, BendModifier, WarpModifier — vertex deformation |
| example-modifier-generate.html | ArrayModifier, ExtrudeModifier, SolidifyModifier — geometry generation |
| example-modifier-uv.html | UVProjectionModifier — box, sphere, and triplanar UV generation |

---

## particle/
Examples for `@st-particle-core`.

| File | Demonstrates |
|---|---|
| example-particle-core.html | Core ParticleSystem — basic setup, gravity, drag |
| example-particle-emission.html | Emission controls — rate, burst, lifetime |
| example-particle-renderers.html | BillboardRenderer, InstanceRenderer |
| example-particle-rotation.html | Particle rotation and angular velocity |
| example-particle-colour.html | Colour over lifetime |
| example-particle-boids.html | BoidForce — flocking AI |
| example-boid-obstacles.html | Boid obstacle avoidance |
| example-boid-leader-ground.html | Boid leader following and ground plane |
| example-particle-collisions.html | DeflectorCollider — plane and mesh collision |
| example-particle-children.html | Child particle systems |
| example-particle-bake.html | Particle cache baking and playback |
| example-batch-bake.html | Batch baking multiple systems |
| example-particle-vertex-weight.html | Vertex weight driven emission density |
| example-particle-texture-density.html | Texture-driven emission density |
| example-mesh-emitter-size-attr.html | MeshEmitter with per-face size attributes |
| example-curve-guide-force.html | CurveGuideForce — particles follow a curve |
| example-texture-force.html | TextureForce — texture-driven force field |
| example-force-field.html | Force field concept demo (pure Three.js) |
| example-force-field-range.html | ForceField with range falloff |
| example-trail-renderer.html | TrailRenderer — particle motion trails |
| example-collection-weights.html | CollectionRenderer with weighted mesh selection |
| example-display-amount.html | Display amount — particle count control |
| example-size-deflect.html | Size over lifetime + deflector interaction |
| example-self-effect.html | Self-effect — particles affecting each other |
| example-speed-limit.html | Speed limit force |
| example-particle-forces.html | HarmonicForce, LennardJonesForce, ChargeForce, MagneticForce |
| example-particle-renderers-2.html | TrailRenderer, HaloRenderer, ObjectRenderer, LineRenderer |
| example-particle-emitters.html | PointEmitter, EdgeEmitter, MeshEmitter compared |

---

## geometry/
Examples for `@three-radius-parametric`.

| File | Demonstrates |
|---|---|
| example-parametric-geometry.html | RadiusParametricGeometry — sphere, cylinder, cone, torus, wavy surface |

---

## uv/
Examples for `@st-uv-core` UV unwrapping.

| File | Demonstrates |
|---|---|
| example-uv-core.html | All 6 unwrap methods — Cube, Cylinder, Sphere, Smart UV, LSCM, ABF — with checker texture and live UV preview |

---

## compositor/
Examples for `@st-compositor-core` post-processing nodes.

| File | Demonstrates |
|---|---|
| example-compositor-core.html | All 13 pass nodes — Bloom, Blur, ChromaticAberration, Vignette, FilmGrain, BrightnessContrast, HueSaturation, ColorBalance, Gamma, Exposure, Sharpen, Pixelate, and stacked passes |

---

## animation/
Examples for `@st-animation-core`.

| File | Demonstrates |
|---|---|
| example-animation-core.html | Shape keys (puff/spike/flatten), armature FK walk cycle, NLA strip layering |

---

## geometry-nodes/
Examples for `@st-geometry-nodes`.

| File | Demonstrates |
|---|---|
| example-geometry-nodes.html | 5 scenes: scatter on sphere, subdivision, terrain, join+transform, icosphere — live parameter sliders |

---

## physics/
Examples for `@st-physics-core`.

| File | Demonstrates |
|---|---|
| example-physics-core.html | Cloth simulation — hanging flag, drape over sphere, wind tunnel, floor fall; live parameter controls |

---

## curve/
Examples for `@st-curve-core`.

| File | Demonstrates |
|---|---|
| example-curve-core.html | Catmull-Rom, Bezier, NURBS curves — tube/bevel/star profiles, path-follow cone with RMF |

---

## keyframe/
Examples for `@st-keyframe` animation driver.

| File | Demonstrates |
|---|---|
| example-keyframe-core.html | KeyframeTrack, AnimationClip, AnimationMixer — animating rotation, scale, emissive, bloom with switchable easings |

---

## cross-package/
Examples combining two or more packages.

| File | Demonstrates |
|---|---|
| example-modifier-stack.html | ModifierStack with Subdivision + Displacement + shader material |
| example-ocean.html | OceanModifier + shader node graph — basic ocean surface |
| example-ocean-scene.html | Full ocean scene — OceanModifier + animated shader + lighting |
| example-shoreline-nodes.html | Shoreline material — shader nodes only, no raw GLSL |
