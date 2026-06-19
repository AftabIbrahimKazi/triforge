export type ErrorLevel = 'verbose' | 'standard' | 'off'

/**
 * Global configuration for @st-shader-core.
 *
 * Set errorLevel before building any materials:
 *   ShaderConfig.errorLevel = 'verbose'   // development
 *   ShaderConfig.errorLevel = 'standard'  // production (default)
 *   ShaderConfig.errorLevel = 'off'       // maximum performance
 */
export const ShaderConfig = {
  errorLevel: 'standard' as ErrorLevel,
}
