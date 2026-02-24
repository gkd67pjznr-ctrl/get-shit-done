# GSD Enhanced Fork

## What This Is

A forked, upgraded version of the GSD (Get Shit Done) framework for Claude Code that adds quality enforcement layers to eliminate "slop" — duplicate code, shortcuts, placeholder implementations, broken integrations, and hand-rolled logic that should use libraries. The fork adds a Quality Sentinel to the executor, Context7 library lookup, mandatory testing, quality directives in the planner, and quality dimensions in the verifier — completing a full Plan→Execute→Verify quality enforcement loop gated by `quality.level` config.

## Core Value

Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## Requirements

### Validated

- ✓ Quality Sentinel system in executor agent (pre-task codebase scan, during-task quality gates, post-task diff review) — v1.0
- ✓ Context7 integration in executor agent (library lookup before implementation, API verification, no hand-rolling) — v1.0
- ✓ Mandatory test step in execution flow (write tests for new logic, run existing tests before commit) — v1.0
- ✓ Pre-implementation codebase scan (find existing patterns, reuse utilities, establish test baseline) — v1.0
- ✓ Enhanced verifier with code quality checks (duplication detection, dead code, test coverage, pattern consistency) — v1.0
- ✓ Planner quality directives (task actions include which code to reuse, which docs to consult, what tests to write) — v1.0
- ✓ Config quality level toggle (strict/standard/fast enforcement levels) — v1.0
- ✓ Fix `is_last_phase` bug in `cmdPhaseComplete` — v1.0
- ✓ Fix roadmap-aware phase routing so transition correctly identifies next unplanned phase — v1.0
- ✓ All changes are additive (extend, don't replace existing GSD behavior) — v1.0

### Active

- [ ] `/gsd:set-quality` command for per-project quality level switching (fast/standard/strict)
- [ ] Config migration to auto-add `quality` block to existing projects missing it
- [ ] Quality observability — surface quality gate activity in summaries and output
- [ ] Global defaults via `~/.gsd/defaults.json` for new project inheritance
- [ ] `/gsd:help` shows `/gsd:reapply-patches` reminder after updates
- [ ] Quality level displayed in `/gsd:progress` output
- [ ] Config validation — warn on missing sections instead of silent fallback
- [ ] Context7 token cap configuration and verification

## Current Milestone: v1.1 Quality UX

**Goal:** Make quality enforcement discoverable, configurable, and observable — so users know what mode they're in, can switch easily, and can see what the quality gates are doing.

**Target features:**
- `/gsd:set-quality` command (per-project toggle)
- Config migration (auto-add quality block to existing projects)
- Quality observability (show gate activity in summaries)
- Global defaults (`~/.gsd/defaults.json`)
- Help/progress UX improvements
- Config validation (warn on missing sections)
- Context7 token cap

### Out of Scope

- Rewriting GSD from scratch — this is an upgrade, not a rewrite
- Changing the core workflow lifecycle (project → milestone → phase → plan → execute → verify)
- Changing the agent orchestration pattern (lean orchestrators, fresh subagent contexts)
- Changing the state management system (STATE.md, ROADMAP.md, REQUIREMENTS.md)
- Changing the commit strategy or wave-based parallelism
- Supporting non-Claude Code runtimes (OpenCode, Gemini CLI)
- UI/visual changes to the framework
- Performance optimization of gsd-tools.cjs (beyond bug fixes)
- Separate quality agent — inline sentinel burns 6-16K vs 50-100K for separate agent context handoff
- Exhaustive pre-scan (whole codebase) — violates 50% context budget before first line of code
- Blocking quality gates in fast mode — fast mode exists for quick experiments and prototypes
- Silent quality improvements — all quality-driven changes tracked as deviations in SUMMARY

## Context

Shipped v1.0 with ~18,284 LOC across CJS/JS/agent MD files.
Tech stack: Node.js, CJS modules, Markdown agent specifications, Context7 MCP.
102 tests passing (phase.test.cjs: 51, init.test.cjs: 9, full suite: 102).

The GSD framework now enforces quality through the complete Plan→Execute→Verify loop:
- **Planner** generates `<quality_scan>` directives (code_to_reuse, docs_to_consult, tests_to_write)
- **Plan-checker** validates directives via Dimension 9 (warning in standard, blocker in strict)
- **Executor** consumes directives in Quality Sentinel Steps 1, 2, 4 (pre-task scan, library lookup, mandatory tests, diff review)
- **Verifier** backstops with Step 7b (duplication, orphaned exports, missing tests)
- **Config** gates everything — fast skips all, standard warns, strict blocks

Known bugs fixed: `is_last_phase` filesystem routing, `offer_next` ROADMAP-vs-filesystem mismatch.

**Source repo:** https://github.com/gsd-build/get-shit-done (cloned into this project directory)

## Constraints

- **Compatibility**: All changes must be additive — existing GSD behavior preserved, new quality gates layered on top
- **Config-driven**: Quality enforcement level must be configurable (strict/standard/fast) so users can choose their trade-off
- **Context budget**: Quality gates must not consume excessive context — pre-task scans should be targeted, not exhaustive
- **Agent boundaries**: Each agent's responsibilities must remain clear — quality sentinel in executor, quality dimensions in verifier, quality directives in planner

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork the repo (not extension layer) | Need to modify agent files directly; extension would add indirection | ✓ Good — direct modification enabled clean quality gate integration |
| Quality Sentinel in executor (not separate agent) | Keeps quality checks inline with execution; separate agent would burn context on handoff | ✓ Good — 6-16K overhead vs estimated 50-100K for separate agent |
| Context7 tools added to executor | Executor is where code is written; library awareness needed at coding time | ✓ Good — library docs consulted at coding time, not planning time |
| Configurable quality levels (fast/standard/strict) | Not all projects need strict mode; quick experiments need speed | ✓ Good — fast preserves vanilla GSD exactly (zero behavioral change) |
| Fix bugs alongside upgrades | Known bugs affect fork usability; fixing them demonstrates quality-first approach | ✓ Good — bug fixes in Phase 1 unblocked multi-phase execution for Phases 2-4 |
| quality.level defaults to 'fast' | Ensures zero behavioral change from vanilla GSD when quality gates introduced | ✓ Good — CFG-02 satisfied, no surprise behavior for existing users |
| Duplication scope same-phase only | Full codebase scan too expensive; same-phase catches most real issues | ✓ Good — keeps verifier fast while catching relevant duplications |
| N/A override guard for tests_to_write | Planner may mark N/A but if task produced exports, tests still required | ✓ Good — prevents planner error from bypassing mandatory test requirement |
| One Context7 query per plan maximum | Prevents context budget blowout; if multiple lookups needed, plan is too broad | — Pending (unverified in production) |

---
*Last updated: 2026-02-23 after v1.1 milestone started*
