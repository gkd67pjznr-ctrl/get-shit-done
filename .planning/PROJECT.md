# GSD Enhanced Fork

## What This Is

A forked, upgraded version of the GSD (Get Shit Done) framework for Claude Code that adds quality enforcement layers to eliminate "slop" — duplicate code, shortcuts, placeholder implementations, broken integrations, and hand-rolled logic that should use libraries. The fork maintains all existing GSD fundamentals (context engineering, goal-backward verification, wave-based parallelism, atomic commits) while adding engineer-level rigor at the execution layer.

## Core Value

Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Quality Sentinel system in executor agent (pre-task codebase scan, during-task quality gates, post-task diff review)
- [ ] Context7 integration in executor agent (library lookup before implementation, API verification, no hand-rolling)
- [ ] Mandatory test step in execution flow (write tests for new logic, run existing tests before commit)
- [ ] Pre-implementation codebase scan (find existing patterns, reuse utilities, establish test baseline)
- [ ] Enhanced verifier with code quality checks (duplication detection, dead code, test coverage, pattern consistency)
- [ ] Planner quality directives (task actions include which code to reuse, which docs to consult, what tests to write)
- [ ] Config quality level toggle (strict/standard/fast enforcement levels)
- [ ] Fix `is_last_phase` bug in `cmdPhaseComplete` — reads directories instead of ROADMAP.md for total phase count
- [ ] Fix roadmap-aware phase routing so transition correctly identifies next unplanned phase
- [ ] All changes are additive (extend, don't replace existing GSD behavior)

### Out of Scope

- Rewriting GSD from scratch — this is an upgrade, not a rewrite
- Changing the core workflow lifecycle (project → milestone → phase → plan → execute → verify)
- Changing the agent orchestration pattern (lean orchestrators, fresh subagent contexts)
- Changing the state management system (STATE.md, ROADMAP.md, REQUIREMENTS.md)
- Changing the commit strategy or wave-based parallelism
- Supporting non-Claude Code runtimes (OpenCode, Gemini CLI)
- UI/visual changes to the framework
- Performance optimization of gsd-tools.cjs (beyond bug fixes)

## Context

GSD is the #1 Claude Code framework with 8.5k+ GitHub stars. It fights context rot through structured planning, subagent orchestration, and state management. The framework has excellent architect-level quality control (goal-backward methodology, dependency graphs, must-haves) but weak execution-time quality enforcement.

**The core problem:** Claude's executor agent has no awareness of existing codebase patterns, no library documentation lookup, optional testing, and no real-time quality validation during coding. Quality issues are discovered post-execution by the verifier — after context is already burned.

**The insight:** The gap isn't in planning or verification — it's in the execution layer itself. The executor needs to behave like a senior engineer, not a code generator.

**Known bugs discovered through usage:**
- `cmdPhaseComplete` in `get-shit-done/bin/lib/phase.cjs` (line 786-802): Determines `is_last_phase` by scanning phase directories on disk instead of parsing ROADMAP.md. Since undiscussed/unplanned phases don't have directories, this always returns `true` prematurely, routing users to `/gsd:complete-milestone` instead of the next phase.
- Roadmap analysis correctly shows all phases, but phase routing doesn't use this data.

**Source repo:** https://github.com/gsd-build/get-shit-done (cloned into this project directory)

## Constraints

- **Compatibility**: All changes must be additive — existing GSD behavior preserved, new quality gates layered on top
- **Config-driven**: Quality enforcement level must be configurable (strict/standard/fast) so users can choose their trade-off
- **Context budget**: Quality gates must not consume excessive context — pre-task scans should be targeted, not exhaustive
- **Agent boundaries**: Each agent's responsibilities must remain clear — quality sentinel in executor, quality dimensions in verifier, quality directives in planner

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork the repo (not extension layer) | Need to modify agent files directly; extension would add indirection | — Pending |
| Quality Sentinel in executor (not separate agent) | Keeps quality checks inline with execution; separate agent would burn context on handoff | — Pending |
| Context7 tools added to executor | Executor is where code is written; library awareness needed at coding time | — Pending |
| Configurable quality levels | Not all projects need strict mode; quick experiments need speed | — Pending |
| Fix bugs alongside upgrades | Known bugs affect fork usability; fixing them demonstrates quality-first approach | — Pending |

---
*Last updated: 2026-02-23 after initialization*
