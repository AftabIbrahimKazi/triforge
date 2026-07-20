# AGENTS.md — triforge

Instructions for AI coding agents (OpenCode, Codex, and any other tool) working in this repo. This repo is shared by multiple AI tools running sequentially or in parallel.

## Parallel-Session Coordination (mandatory)

Before claiming or resuming **any** task in the parallel-session system (`handover/` — board, locks, per-role handover notes), read `handover/PROTOCOL.md` and follow it. It defines session-start modes (new claim vs. resume), incremental handover writing, stale-lock recovery, and graceful handoff. Do not edit any file that is part of shared or locked work without going through that protocol first.

## Project standards

Project context, active coding standards, and the behavioural contract live in `CLAUDE.md` at the project root and `coding-standards/` — read them at session start.
