# Contributing to Triforge

Thanks for your interest in contributing. Triforge is a modular ecosystem of independent
npm packages (`@triforge/*`) that bring Blender-style node workflows to Three.js — please
read the root [CLAUDE.md](CLAUDE.md) and [THREE_JS_ECOSYSTEM.md](THREE_JS_ECOSYSTEM.md)
first to understand how the packages relate to each other before opening a PR.

## Before you start

- **One job per package.** If your change needs to import from another package in this
  repo, stop — that's a design smell here (the only shared code path is
  `@triforge/core-types`, which is types-only). Open an issue to discuss instead.
- **No breaking changes to a published package's public API** without a clear reason and
  a major version bump — other projects depend on these packages via npm.
- **TypeScript strict mode, no `any`, no `@ts-ignore`.** All packages are TS-strict.
- **Every node/modifier must expose a public `parameters` object** (for GSAP / keyframe
  integration) — see any existing node for the pattern.
- **Blender naming.** Node names, parameter names, and socket names should match Blender's
  own terminology where a Blender equivalent exists.

## Branch flow

This repo promotes changes through a fixed sequence — see [README.md](README.md#branch-flow):

```
dev → test → beta → main
```

Fork and branch off `dev`, not `main`. Pull requests should target `dev`. `main` is
protected and only receives merges from `beta` after review.

## Making a change

1. Fork the repo and branch off `dev`.
2. Pick the smallest package your change actually belongs in — see the table in
   [README.md](README.md#packages) and the "What Belongs Where" table in
   [CLAUDE.md](CLAUDE.md) if you're unsure.
3. Run that package's own test suite before and after your change:
   ```bash
   cd st-<package-name>
   npm install
   npm test
   ```
4. If you changed a node/modifier's public behavior or signature, update that package's
   `TUTORIAL.md` with a short example.
5. Open a pull request against `dev` describing what changed and why.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
fix: correct NaN in SubdivisionModifier on orphan vertices
feat: add BevelModifier to st-modifier-core
docs: update TUTORIAL.md for CurveTube bevelFactor
```

## Reporting bugs / requesting features

Use the issue templates — they ask for exactly what's needed to reproduce or evaluate a
request without back-and-forth.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating,
you're expected to uphold it.
