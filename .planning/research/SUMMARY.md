# Project Research Summary

**Project:** GSD Enhanced Fork — v2.0 Concurrent Milestones
**Domain:** AI coding agent framework extension — concurrent milestone execution and workspace isolation
**Researched:** 2026-02-24
**Confidence:** HIGH (official Claude Code docs verified directly; first-party codebase analysis with empirical path counts)

## Executive Summary

GSD v2.0 adds concurrent milestone execution to a framework that was designed from the ground up for single-session sequential operation. The core challenge is not feature invention — it is safe structural migration. The existing system has 270+ hardcoded path references across four file types (`.cjs` libs, agent `.md` specs, workflow `.md` files, test helpers), all of which assume exactly one active `.planning/` root. The recommended approach is to introduce a `planningRoot()` path resolver in `core.cjs` as the first and foundational deliverable, implement milestone-scoped workspaces at `.planning/milestones/<version>/`, and add a compatibility layer that detects old-style vs. new-style projects via an explicit config sentinel — not by directory presence, which would break old-style projects that already have a `.planning/milestones/` archive directory from prior milestone completions.

The recommended stack for v2.0 adds zero new runtime dependencies. Workspace isolation uses directory scoping (milestone-scoped folders) rather than file locks, which would create stale-lock failure modes when Claude sessions are killed. The lock-free dashboard uses per-milestone `STATUS.md` files aggregated at read time, eliminating concurrent write races entirely. Conflict detection is advisory and declarative: each milestone declares its intended file ownership in `conflict.json` at creation time, and the system warns on overlap — but does not block, since human coordination is better than automated gating for milestone-length workstreams. The quality enforcement system from v1.0/v1.1 carries forward unchanged and is orthogonal to the concurrency changes.

The primary risk is incomplete path migration. Research identified exactly 94 path references in workflow files, 83 in agent specs, 67 in lib modules, and 30 in test files — all string literals with no compile-time safety. Any partial migration leaves the system in a state where unit tests pass (new code paths) but live workflow execution silently reads from wrong locations. The mitigation is clear: build the resolver function first, refactor path construction to use it universally, and run the 102+ existing tests after every batch of changes as a regression gate before adding new concurrent tests.

## Key Findings

### Recommended Stack

The v2.0 stack adds no new runtime dependencies to GSD's zero-dependency baseline. The core isolation mechanism is directory-based scoping at `.planning/milestones/<version>/` — a filesystem primitive, not a locking protocol. Atomic dashboard writes use an inline `atomicWrite()` implementation (temp file + `fs.renameSync` within same filesystem) in `gsd-tools.cjs`, which is 15 lines and avoids the Node 20+ requirement that `write-file-atomic` 7.0.0 would impose on GSD's current `>=16.7.0` engine floor. Claude Code worktrees (`--worktree` flag) provide OS-level file isolation for concurrent source code edits, and are stable (not experimental). Claude Code Agent Teams are explicitly NOT recommended as the coordination mechanism for concurrent milestones — they are experimental, require simultaneous active sessions, and lack session resumption, making them inappropriate for milestone-length workstreams that may span days.

**Core technologies:**
- **`planningRoot(cwd, milestoneScope)` helper** (new, zero-dependency): Central path resolver — returns `.planning/` for old-style or `.planning/milestones/<v>/` for new-style; eliminates 270+ string literals; the single most important architectural addition
- **`detectLayoutStyle(cwd)` helper** (new, zero-dependency): Detects `legacy`, `milestone-scoped`, or `uninitialized` using an explicit `concurrent: true` sentinel in `config.json`, not directory presence (which would false-positive on existing milestone archives)
- **`fs.renameSync()` atomic write** (Node built-in, zero dependency): Safe dashboard writes via temp-file-rename pattern; same-filesystem atomicity on macOS/Linux without raising Node.js floor
- **Claude Code Hooks** (`settings.json` PreToolUse/PostToolUse/Stop): Deterministic quality gate enforcement from v1.1; unchanged and orthogonal to v2.0 concurrency work
- **Context7 MCP** (`@upstash/context7-mcp`): Version-accurate library docs injected into executor agent context at code generation time; unchanged from v1.1
- **Claude Code `--worktree` flag**: Stable (not experimental) OS-level source file isolation for concurrent sessions; each milestone gets its own worktree branch

**Critical version note:** `write-file-atomic` 7.0.0 requires `Node.js ^20.17.0 || >=22.9.0` — more restrictive than GSD's `>=16.7.0`. Implementing `atomicWrite()` inline in `gsd-tools.cjs` (15 lines) avoids this constraint entirely.

### Expected Features

The feature landscape divides cleanly into structural foundation (P1 — must-have for v2.0 to be a valid concurrent execution system) and safety enhancements (P2 — meaningfully improve UX without being correctness requirements).

**Must have (table stakes — P1):**
- **Milestone-scoped workspace isolation** — root dependency for everything else; without isolated workspace directories, two Claude sessions editing `STATE.md` simultaneously corrupt each other's state
- **Compatibility layer (old-style auto-detection)** — zero-breakage upgrade is table stakes; existing v1.x projects must work unchanged; uses explicit sentinel, not directory presence
- **Updated GSD routing** — all workflows, commands, and agents must resolve milestone-scoped paths; most load-bearing change in the codebase; 270+ occurrences
- **Milestone-scoped phase numbering** — phases reset to `01` per milestone; referenced as `v2.0/phase-01` in cross-milestone contexts; old global sequential scheme cannot work for concurrent milestones
- **Test coverage for new routing and isolation logic** — 102+ existing tests must remain green throughout; new tests cover both old-style and new-style paths in both layout modes

**Should have (competitive — P2):**
- **Lock-free dashboard** (per-milestone `STATUS.md` aggregated by `/gsd:progress`) — status visibility across concurrent milestones; each milestone owns its own file, eliminating write races
- **Conflict manifest** (`conflict.json` per milestone with overlap detection at init time) — surfaces file ownership conflicts before any code is written; advisory only, not blocking

**Defer (v2.x+):**
- Agent Teams integration for parallel phases (intra-milestone parallelism) — research verdict: correct use case for Agent Teams, wrong timing; design for asynchronous multi-session work first
- Conflict manifest enforcement (runtime blocking via PreToolUse hooks) — pre-flight check is right for v2.0; blocking enforcement can be opt-in post-validation
- Dashboard live refresh (`/gsd:progress --watch`) — polling STATUS.md; nice to have, not essential
- Cross-milestone dependency tracking — requires dependency graph data structure; build on user demand

**Anti-features (explicitly out of scope):**
- File locking for concurrent writes — stale locks from killed sessions are worse than no locks; workspace isolation eliminates the need
- Automatic conflict resolution — semantic correctness of concurrent code changes cannot be automated; surface conflicts clearly, leave resolution to humans
- Centralized "active milestone" state — creates split-brain when sessions are interrupted; lock-free model with explicit `--milestone` flag is correct
- Nested concurrent milestones — Agent Teams docs confirm "no nested teams"; same constraint applies; exponential coordination complexity
- Rewriting the milestone/phase lifecycle — concurrency is a property of execution context, not lifecycle; PROJECT.md explicitly excludes lifecycle changes

### Architecture Approach

The architecture inserts a milestone-scoped layer between the project root and the existing phase/state structure without changing the phase/plan/execute lifecycle itself. `MILESTONES.md` is repurposed from an append-only log to a live dashboard with structured per-milestone sections that concurrent sessions update independently. Each milestone workspace (`.planning/milestones/<version>/`) contains its own `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `conflict.json`, `research/`, and `phases/`. Global `.planning/` retains only truly project-wide files: `PROJECT.md`, `config.json`, `MILESTONES.md`. The compatibility bridge preserves old-style projects (root-level `STATE.md`, `ROADMAP.md`, `phases/`) as a permanent valid mode, not a transitional state that eventually goes away.

**Major components:**
1. **`core.cjs: planningRoot()`** — central path resolver; all other modules call this; accepts optional `milestoneScope` parameter; returns `.planning/` or `.planning/milestones/<v>/` accordingly
2. **`core.cjs: detectLayoutStyle()`** — checks `config.json` for `concurrent: true` sentinel; returns `legacy`, `milestone-scoped`, or `uninitialized`; single source of truth, called only from `cmdInitNewMilestone` and `cmdInitPlanPhase`
3. **`gsd-tools.cjs` CLI router** — parses `--milestone <version>` global flag; threads scope into all phase/state/roadmap commands; project-wide commands (`config-set`, `commit`, `resolve-model`) do not require the flag
4. **`commands.cjs: cmdConflictCheck()`** — new command; reads two `conflict.json` files, returns overlapping file paths; called automatically during `new-milestone` workflow
5. **`commands.cjs: cmdMilestoneDashboard()`** — new command; pattern-replaces the `**Status:**` line for a specific milestone section in `MILESTONES.md`; uses atomic write
6. **Workflow files** (`new-milestone.md`, `plan-phase.md`, `execute-phase.md`) — modified to pass `--milestone` to all tool calls; receive milestone-scoped paths from init commands; no hardcoded `.planning/` path strings in workflow bodies
7. **Agent specs** (`gsd-executor.md`, etc.) — unchanged; agents receive paths through `<files_to_read>` from orchestrators; no `.planning/` references in agent bodies

**Build dependency order (architecture-mandated):**
Phase 1 (path resolver) → Phase 2 (workspace initialization) → Phase 3 (compatibility layer) → Phase 4 (dashboard + conflict detection) → Phase 5 (full routing update) → Phase 6 (test coverage)

### Critical Pitfalls

1. **Incomplete path migration (270+ occurrences)** — 94 path references in workflow files, 83 in agent specs, 67 in lib modules, 30 in tests — all string literals. Build `planningRoot()` resolver first; all path construction calls it; never do text replacement. Run 102+ existing tests after every batch of changes.

2. **Backward compatibility false detection** — old-style projects that have completed milestones already have `.planning/milestones/` (archive directory from `cmdMilestoneComplete`). Detecting "new-style" by directory presence breaks these projects. Use explicit `concurrent: true` sentinel in `config.json`, created only when a project is explicitly upgraded.

3. **Git merge conflicts from concurrent session commits** — two sessions committing to the same branch without pre-pull will conflict on shared files. Primary mitigation: workspace isolation (each session writes only its milestone subdirectory). Dashboard writes: atomic replace on per-milestone sections; git conflicts are trivially resolvable by accepting both changes.

4. **State desynchronization between milestone-local and global state** — `state.cjs` has 15+ functions all hardcoded to `.planning/STATE.md`. In concurrent execution, global and milestone-local state diverge unless all state commands receive `--milestone` context and route to the correct scoped file.

5. **Test suite breakage during structural changes** — `helpers.cjs` has a single `createTempProject()` shared by all 102+ tests; hardcodes old-style layout. Create a parallel `createConcurrentProject()` helper. Never modify `createTempProject()` itself.

6. **Agent prompt variable drift** — agent `.md` files use path variables in bash commands. Without a canonical variable glossary committed before editing begins, different agents invent different names for the same path, causing silent failures in live execution. Define the glossary first.

7. **`is_last_phase` bug (carried from v1.x)** — `cmdPhaseComplete` scans the filesystem for phase directories; finds none for unplanned future phases; sets `is_last_phase = true` prematurely. Fix before concurrent milestone work begins — it affects the same code paths being refactored.

## Implications for Roadmap

Based on research, suggested phase structure (6 phases):

### Phase 1: Path Architecture Foundation
**Rationale:** All other phases depend on the path resolver. The 270+ hardcoded path strings cannot be safely refactored without a central resolver. Also fix the `is_last_phase` bug here — it affects the same code paths being changed and must be corrected before concurrent execution is layered on top.
**Delivers:** `planningRoot()` helper, `detectLayoutStyle()` with sentinel-based detection, `--milestone` flag parsing in CLI router, `is_last_phase` bug fix, path refactor in `core.cjs`, `phase.cjs`, `state.cjs`, `roadmap.cjs`
**Addresses:** Milestone-scoped phase numbering (structural), milestone-scoped state routing
**Avoids:** Incomplete path migration pitfall, state desynchronization pitfall, is_last_phase premature routing
**Research flag:** Standard patterns — internal codebase analysis is complete and path counts are verified; no external research needed

### Phase 2: Milestone Workspace Initialization
**Rationale:** Workspace isolation is the root dependency for dashboard, conflict manifest, and routing. Must exist before any feature that reads from milestone workspaces can be built. `new-milestone` workflow creates the physical workspace structure.
**Delivers:** `new-milestone` workflow creates `.planning/milestones/<version>/` with `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `conflict.json`; `cmdConflictCheck` command; MILESTONES.md repurposed as structured live dashboard
**Addresses:** Milestone-scoped workspace isolation, conflict manifest (format and creation), MILESTONES.md dashboard structure
**Avoids:** Dashboard write corruption pitfall (per-milestone files eliminate shared write targets)
**Research flag:** Standard patterns — directory structure design is fully specified in ARCHITECTURE.md; no external research needed

### Phase 3: Compatibility Layer
**Rationale:** Cannot ship to existing users without zero-breakage compatibility. Detection sentinel design must be locked in before any command branches on it. Old-style projects must work unchanged indefinitely — not as a transitional state.
**Delivers:** `isConcurrentProject()` detection with `concurrent: true` sentinel in `config.json`, routing fork in init commands, test cases for all three project states (new project, old-style with archived milestones, new-style concurrent)
**Addresses:** Compatibility layer for existing projects
**Avoids:** Backward compatibility false detection pitfall (sentinel vs. directory presence), test suite breakage pitfall (extend helpers before changing code)
**Research flag:** Standard patterns — detection logic and sentinel design are fully specified in ARCHITECTURE.md and PITFALLS.md

### Phase 4: Dashboard and Conflict Detection
**Rationale:** Depends on workspace isolation (Phase 2) and compatibility layer (Phase 3). Dashboard reads per-milestone STATUS.md files — those files need to exist. Conflict detection reads conflict.json files — those need to exist. Routing must know layout style before dashboard can aggregate correctly.
**Delivers:** `cmdMilestoneDashboard()` command with atomic write; STATUS.md written at milestone checkpoints; `/gsd:progress` aggregates all active milestone STATUS.md files; conflict warning fires at `execute-phase` start when manifests overlap; phase IDs fully qualified as `v2.0/phase-01` in dashboard
**Addresses:** Lock-free dashboard, conflict manifest overlap detection
**Avoids:** Dashboard file corruption pitfall (lock-free design with per-milestone write ownership), phase numbering collision pitfall (milestones aggregated separately with qualified IDs)
**Research flag:** Standard patterns — lock-free design is fully specified; atomic write pattern is 15 lines of Node.js built-ins

### Phase 5: Full Routing Update
**Rationale:** Depends on Phases 1-4. All workflows and agent specs need updating to use milestone-scoped paths from init commands. Cannot be done correctly until init commands return the right paths (Phase 1) and layout detection is stable (Phase 3). Run comprehensive `grep` inventory before this phase begins.
**Delivers:** All `/gsd:*` commands work with `--milestone` flag; agent variable glossary committed; all 270+ path string literals replaced or routed through resolver; `progress.md`, `complete-milestone.md`, `health.md`, `resume-project.md`, `history-digest` updated to be milestone-aware
**Addresses:** Updated GSD routing, agent prompt variable drift prevention
**Avoids:** Agent prompt drift pitfall (glossary-first discipline), incomplete path migration pitfall (final audit pass)
**Research flag:** Needs pre-planning audit pass — run `grep -rn "\.planning/phases\|\.planning/STATE\|\.planning/ROADMAP"` across all file types and document the full count. No external research; it is a mechanical migration guided by the resolver.

### Phase 6: Test Coverage
**Rationale:** Last phase because all features must exist before end-to-end tests can exercise the integrated system. Existing 102+ tests must have been kept green throughout all prior phases.
**Delivers:** `createConcurrentProject()` test helper alongside (not replacing) `createTempProject()`; test cases for milestone-scoped path resolution, compatibility detection, conflict check, phase numbering, MILESTONES.md dashboard update; 90%+ branch coverage on new functions in `core.cjs` and `commands.cjs`; at least one end-to-end test executing plan→execute→verify in both old-style and new-style modes
**Addresses:** Test coverage for new routing and isolation logic
**Avoids:** Test suite breakage pitfall (new helper alongside old, not replacing it)
**Research flag:** Standard patterns — test infrastructure (`node --test`, `helpers.cjs`) already exists; extend, don't replace

### Phase Ordering Rationale

- **Path resolver first (Phase 1)** because 270+ string literals cannot be safely refactored without a central function to replace them. Any other phase executed first creates migration debt that compounds.
- **`is_last_phase` bug fix in Phase 1** because it affects `phase.cjs` which is being refactored anyway; fixing it atomically with the path refactor avoids a double-touch.
- **Workspace initialization before compatibility (Phase 2 before Phase 3)** because the compatibility layer needs the workspace structure to exist to test against the new-style code path. These phases could run concurrently if bandwidth allows — they have no strict blocking dependency.
- **Dashboard after workspace (Phase 4 after Phase 2)** because the dashboard aggregates per-milestone STATUS.md files that must physically exist first.
- **Full routing update late (Phase 5 after Phases 1-4)** because workflows and agents can only be correctly updated once init commands return the right paths with canonical variable names.
- **Tests always last (Phase 6)** because end-to-end tests verify the integrated system; component-level tests accompany each phase, but integration coverage requires the full system to exist.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Full Routing Update):** Run a comprehensive grep inventory before planning begins — count every occurrence of `.planning/phases`, `.planning/STATE.md`, `.planning/ROADMAP.md` across all four file types. The count is the migration checklist. This is mechanical, not exploratory research, but must be done before estimation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Path Architecture):** All implementation details are specified in ARCHITECTURE.md and PITFALLS.md. The fix strategy for `is_last_phase` is confirmed from direct source analysis of `phase.cjs`.
- **Phase 2 (Workspace Initialization):** Directory structure and `conflict.json` format are fully specified in ARCHITECTURE.md. Straight implementation.
- **Phase 3 (Compatibility Layer):** Detection logic and sentinel design are fully specified. The three test cases (new project, old-style with archives, new-style) are defined.
- **Phase 4 (Dashboard):** Lock-free pattern and atomic write are fully specified. `cmdMilestoneDashboard` format is defined.
- **Phase 6 (Tests):** Test infrastructure already exists. Extend `helpers.cjs` with `createConcurrentProject()` alongside existing helper.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Claude Code docs verified directly for hooks, subagents, Agent Teams, and worktrees. `write-file-atomic` Node.js engine constraint confirmed from official GitHub. Agent Teams experimental limitations confirmed from official docs. |
| Features | HIGH | Official Agent Teams and worktrees docs read directly. Internal PROJECT.md, STATE.md, and MILESTONES.md read directly for v1.x baseline. Feature dependency graph independently verified from architecture analysis. Anti-features validated against Claude Code Agent Teams limitations. |
| Architecture | HIGH | Based on direct source analysis of all `lib/*.cjs` modules. All hardcoded path counts are empirically measured (94/83/67/30 by file type). Compatibility detection flaw (directory vs. sentinel) identified from direct `milestone.cjs` code analysis. |
| Pitfalls | HIGH | First-party codebase analysis: exact counts of path references per file type measured via grep. `createTempProject()` single-helper limitation confirmed from `tests/helpers.cjs` direct read. `state.cjs` 15-function hardcoded path confirmed from direct read. `is_last_phase` bug location confirmed at `phase.cjs` lines 786–802. |

**Overall confidence:** HIGH

### Gaps to Address

- **Node.js engine floor:** Implementing `atomicWrite()` inline (15 lines) keeps the `>=16.7.0` floor. If `write-file-atomic` is ever added as a dependency, `engines.node` must be updated to `^20.17.0 || >=22.9.0`. Document as a framework-level constraint in PROJECT.md.
- **Windows cross-drive atomicity:** `fs.renameSync()` is atomic on macOS/Linux within the same filesystem but not guaranteed on Windows cross-drive. GSD's current user base (macOS/Linux Claude Code users) makes this acceptable for v2.0; document as a known limitation.
- **Agent Teams for parallel phases (deferred):** Research confirms Agent Teams are the right tool for intra-milestone phase parallelism. This is correctly deferred to v2.x. When addressed, it will require a separate research pass — Agent Teams docs are experimental and may have evolved.
- **MILESTONES.md concurrent write strategy:** The architecture recommends git rebase (not merge) for the planning branch to make concurrent MILESTONES.md section updates trivially resolvable. This is a process recommendation that should be documented in CLAUDE.md or a workflow file but is not enforced by code.
- **`is_last_phase` ROADMAP.md format:** Verify whether existing ROADMAP.md files use padded phase numbers (`Phase 01:`) or unpadded (`Phase 1:`) before writing the parser in Phase 1 to ensure format consistency.

## Sources

### Primary (HIGH confidence)
- [Claude Code MCP Official Docs](https://code.claude.com/docs/en/mcp) — MCP scopes, installation syntax, `.mcp.json` format
- [Claude Code Subagents Official Docs](https://code.claude.com/docs/en/sub-agents) — Subagent frontmatter, tools field, `isolation: worktree`
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) — Hook events, exit codes, `settings.json` format
- [Claude Code Agent Teams Official Docs](https://code.claude.com/docs/en/agent-teams) — Architecture, task list, mailbox system, limitations, no-nested-teams constraint, experimental status
- [Claude Code Common Workflows — Worktrees](https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) — `--worktree` flag, worktree location, cleanup behavior, `isolation: worktree` frontmatter
- [Context7 GitHub (upstash/context7)](https://github.com/upstash/context7) — Tool interface, resolve+query pattern, connection types
- [write-file-atomic GitHub (npm/write-file-atomic)](https://github.com/npm/write-file-atomic) — Node.js engine constraint `^20.17.0 || >=22.9.0`, CJS API, atomic temp+rename mechanism
- [jscpd npm](https://www.npmjs.com/package/jscpd) — Language support, configuration, threshold behavior
- [Node.js fs documentation](https://nodejs.org/api/fs.html) — `fs.rename()` atomicity notes
- First-party: `bin/lib/core.cjs`, `bin/lib/phase.cjs`, `bin/lib/state.cjs`, `bin/lib/init.cjs`, `bin/lib/milestone.cjs` — direct source analysis
- First-party: `tests/helpers.cjs`, `workflows/new-milestone.md`, `workflows/plan-phase.md` — direct source analysis
- First-party: `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/MILESTONES.md` — direct source analysis

### Secondary (MEDIUM confidence)
- [agentlint GitHub (mauhpr/agentlint)](https://github.com/mauhpr/agentlint) — Quality Pack rules, hook integration (active project, not official Anthropic docs)
- [CodeScene: Agentic AI Coding Best Practices](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality) — Multi-level safeguard patterns, AGENTS.md executable guidance pattern
- [Claude Code Hooks Production Patterns (pixelmojo.io)](https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns) — Hook types, 12 lifecycle events (corroborated by official docs)
- [Verdent 1.5.0 Blog](https://www.verdent.ai/blog/introducing-verdent-1-5-0) — Workspace isolation as table-stakes user expectation in comparable AI coding tools
- [Turborepo Guide (Strapi)](https://strapi.io/blog/turborepo-guide) — Parallel task execution, `--affected` file detection as reference patterns for conflict manifest design
- [Claude Code Threads (Boris Cherny / Anthropic)](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj/) — Built-in worktree support confirmed by Anthropic engineer

### Tertiary (LOW confidence)
- Context7 MCP API quota exceeded during research — docs query behavior corroborated by multiple secondary sources but not verified at runtime; carries forward from v1.1 research
- [Claude Code Swarm Orchestration gist (kieranklaassen)](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea) — Community pattern corroborating agent teams task claiming; single GitHub gist
- [Superpowers Issue #469](https://github.com/obra/superpowers/issues/469) — Evidence of community interest in Agent Teams for milestone coordination; single GitHub issue, not authoritative

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
