/**
 * Backend selector — controls which post-processing library is used.
 *
 * 'three'  (default) — Three.js built-in EffectComposer from three/addons/.
 *                      No extra install required. One render pass per effect.
 *
 * 'pmndrs'           — pmndrs/postprocessing library.
 *                      Install: npm install postprocessing
 *                      Single-pass architecture, better performance and quality.
 */
export type CompositorBackend = 'three' | 'pmndrs'
