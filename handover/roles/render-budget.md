# Role — Render Budget Feature

## Mission
Build the generalized, engine-agnostic render-budget system (DeviceProfiler, RenderBudget, ContextPool) as new triforge package(s), per the design discussion captured 2026-07-20 (mobile rendering bug on aftabibrahimkazi.github.io).

## Owned paths
- render-budget-core/
- context-pool-core/
- CLAUDE.md (ecosystem diagram / package table additions only)
- TUTORIAL.md (additions only)
- BACKLOG.md (additions only)

## Forbidden paths
- Any existing st-*/addons/* package internals — this is a new, independent package; no existing package should need edits for it to exist.

## Definition of done
Per stage (see board.md): package scaffolded, feature built, security-checked, example file working in a browser, tests passing (happy path + edge cases + integration), benchmark recorded, TUTORIAL.md + BACKLOG.md updated — the full 7-step process CLAUDE.md mandates for any new feature.
