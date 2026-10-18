// Ecosystem-wide ESLint flat config.
// Scope: every package's `src/**/*.ts`. Deliberately excludes `examples/*.html`
// (throwaway demo scaffolding, plain JS — see root CLAUDE.md Active Standards)
// and `test/**/*.js` (plain Node test runners, not TS-strict package source).
//
// Rules below map directly to root CLAUDE.md's "Non-Negotiable Rules" and
// "Security Rules" sections — see the comment above each block. Anything not
// traceable to one of those sections is kept at 'warn', since root CLAUDE.md
// rules take precedence over general style preference.

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

// Every package name under @triforge/*, except core-types — the one package
// the root CLAUDE.md "No Cross-Package Imports" rule exempts.
const RESTRICTED_TRIFORGE_PACKAGES = [
  'context-pool-core',
  'radius-parametric-geometry',
  'render-budget-core',
  'animation-core',
  'compositor-core',
  'curve-core',
  'fluid-core',
  'geometry-nodes',
  'hair-core',
  'keyframe',
  'metaball-core',
  'modifier-core',
  'particle-core',
  'pathtracer-core',
  'physics-core',
  'shader-core',
  'uv-core',
  'volume-core',
]

// Lint scope is deliberately just package source. Root-level one-off scripts
// (e.g. shore-verify.js), examples/, test/, and bench/ are not TS-strict
// package source per the Active Standards table and are excluded rather than
// forced into rules written for it.
const SRC_GLOB = '**/src/**/*.ts'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/examples/**',
      '**/test/**',
      '**/bench/**',
      '**/*.html',
      'handover/**',
      'shore-verify.js',
    ],
  },

  { files: [SRC_GLOB], ...js.configs.recommended },
  ...tseslint.configs.recommended.map((cfg) => ({ ...cfg, files: [SRC_GLOB] })),

  {
    files: [SRC_GLOB],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // ── root CLAUDE.md: "TypeScript Strict Mode — No `any` types. No `@ts-ignore`." ──
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',

      // ── root CLAUDE.md: "Security Rules" ──
      // NEVER use eval() or new Function() anywhere in the ecosystem.
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',

      // ── root CLAUDE.md: "No Cross-Package Imports" ──
      // No package may import from another package in this ecosystem,
      // except st-core-types (@triforge/core-types).
      'no-restricted-imports': ['error', {
        patterns: RESTRICTED_TRIFORGE_PACKAGES.map((pkg) => ({
          group: [`@triforge/${pkg}`, `@triforge/${pkg}/*`],
          message: `Root CLAUDE.md "No Cross-Package Imports": only @triforge/core-types may be imported across packages. Connect through BufferGeometry/Material/Texture at the THREE.Mesh level instead, or accept external data via a callback.`,
        })),
      }],

      // ── supplementary (not a root CLAUDE.md rule — kept at 'warn') ──
      // js.configs.recommended defaults no-useless-assignment to 'error';
      // demoted here since it isn't a root CLAUDE.md rule.
      'no-useless-assignment': 'warn',
      'no-console': 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
)
