# Handover — general role
Updated: 2026-10-12 · Branch: dev

## Current state
All 19 published packages are on three.js 0.186.1, tested, and live on npm (0.1.x/0.4.x
patch bumps). `main` has everything through PR #63 — the three.js pass, the version
bumps, and an expanded SEO-driven README + community health files (CONTRIBUTING,
CODE_OF_CONDUCT, SECURITY, issue/PR templates). GitHub repo metadata (description,
homepage, topics) and a tagged release (`2026.10.12`) are live. No open PRs, no
uncommitted changes, `dev`/`test`/`beta`/`main` are all in sync at the same commit.

## Last session
Bumped three.js to 0.186.1 across the whole ecosystem, found and fixed one real
regression (compositor-core's `luminance()` GLSL collision) and one real pre-existing bug
(modifier-core's `SubdivisionModifier` NaN on sphere-pole orphan vertices, now with a
regression test). Updated and bug-swept all 111 examples. Pushed the full
dev→test→beta→main chain twice (code, then the required version bump) and published to
npm. Cleaned up 3 stale merged branches. Did an SEO pass: expanded README substantially,
added community health files, set GitHub repo description/topics/homepage, created the
first GitHub Release. Separately, reconciled this project's `.claude/skills/` from an
unfiltered "Everything"-mode install (54 skills) down to an Auto-detect-scoped set (28) —
see `.claude/skills/install-kit/learnings.md` for what was wrong and why.

## Decisions & why
- Addon packages (`addons/st-addon-*`) stay out of this repo's npm scope and git history —
  they live in separate private repos (pre-existing decision, re-confirmed this session).
- Model-lineup skills pinned to current-gen only (sonnet-5-5, haiku-5-5, opus-5-5,
  claude-all-models) — user confirmed usage is "mostly sonnet latest, but also haiku/opus".
- `.env` holds `NPM_TOKEN` for publishing; gitignored, never echoed to chat or logs.

## Known issues
- `st-pathtracer-core` and `st-metaball-core` have no real test file behind their `npm
  test` script (pre-existing gap, not something this session introduced or fixed).
- None outstanding. (The `example-modifier-stack.html` NaN warning noted in earlier
  sessions was a real `SubdivisionModifier` bug, fixed at the package level this session
  with a regression test — see `st-modifier-core/src/modifiers/generate/SubdivisionModifier.ts`.)

## Next steps
Next session is expected to be mostly feature discussion, not bugfixing or an audit pass.
No specific in-flight task to resume — start from whatever the user brings up. If it turns
into real package work, check `BACKLOG.md` (gitignored, local-only) for prior context
before assuming something is new.

## Don't touch / gotchas
- `main` is protected — PRs only, from `beta`, with owner approval. Never push directly.
- Version bumps happen at push time only (`coding-standards/versioning-standards.md`
  V-04) — don't bump `package.json` versions speculatively mid-session.
- `handover/` (this folder) is the real coordination mechanism here, not a single
  `handover.md` — `.gitignore` deliberately does NOT exclude it.

## Archived skills (this session)
Archived to `.claude/skills-archive/` — restore if scope shifts to that kind of task:
- `perf-audit` — not touching performance this session
- `code-audit` — not doing a standards sweep
- `role-session` — not running parallel lanes
- `e2e-scaffold` — not setting up Playwright fixtures
- `memory-gardener` — no memory-bank/handover pruning due yet
- `skill-ablation` — not re-testing the skill set
- `skill-writer` — not authoring a new skill
- `mod-writer` — not writing a Claude Code mod

Kept pinned: `install-kit` (still mid-use context from this session's reconciliation —
natural to keep one more session in case follow-up install/removal comes up).
