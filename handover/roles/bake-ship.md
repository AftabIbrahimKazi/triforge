# Role — st-bake-core build, audit and release

## Mission
Build `st-bake-core` (baked lightmaps), a side-by-side example, audit every package, then release (GitHub, then npm). Evidence: `tools/ab-test/results/results-2026-11-16.md`.

## Owned paths
- st-bake-core/ (new), examples/bake/ (new), TUTORIAL.md, THREE_JS_ECOSYSTEM.md, CLAUDE.md ecosystem list (additions only), root README package list
- Version bumps and changelogs of packages touched by the audit

## Forbidden paths
- No cross-package imports (only `st-core-types`). Other packages are changed only to fix audit findings, one finding per commit.
- Never publish or push without the dev confirming in that session.

## Definition of done
st-bake-core built with every mandatory step (security check, example, tests, benchmark, tutorial, backlog); side-by-side example reviewed by the dev; every package builds, tests pass and `npm audit` is clean or each finding is recorded; promoted dev -> test -> beta -> main; pushed; npm published after the dev's explicit go.
