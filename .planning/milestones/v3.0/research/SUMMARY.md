# Project Research Summary

**Project:** GSD Enhanced Fork — v3.0 Tech Debt System
**Domain:** Tech debt tracking hub, CLI debt logging, agent wiring, debugger-driven debt resolution, project migration tool
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

GSD v3.0 closes a critical gap in the existing quality enforcement system: detection without persistence. The Quality Sentinel (v1.x) and concurrent milestone workspace isolation (v2.0) can detect problems and maintain parallel execution — but when an executor takes a shortcut or finds an issue it cannot fix within a plan's scope, that knowledge evaporates. v3.0 adds the tracking and resolution side: a structured DEBT.md hub, CLI commands agents can call to log entries atomically, wiring into existing executor/verifier/debugger agents, an on-demand `/gsd:fix-debt` skill that closes the detect-log-fix loop, and a project migration tool that brings legacy `.planning/` layouts to current spec.

The recommended approach requires no new npm dependencies and no architectural disruption. All additions fit cleanly into GSD's existing five-layer structure: new `debt.cjs` and `migrate.cjs` modules in `bin/lib/`, two new `case` blocks in the `gsd-tools.cjs` router, additive sections in three existing agent markdown files, and a new command file at `commands/gsd/fix-debt.md`. Two known integration bugs (INTEGRATION-3 in `init.cjs`, INTEGRATION-4 in `roadmap.cjs`) must be fixed first — they hardcode `.planning/` paths that ignore `--milestone` scope, which would silently route debt entries to the wrong location. The entire feature set is zero-dependency: built on Node.js built-ins (`fs.appendFileSync`, `fs.renameSync`) and Claude Code's existing `commands/` skill system.

The primary risk is concurrent write safety on DEBT.md. Parallel plan waves spawn multiple executor subagents simultaneously — both can call `debt log`, and naive read-modify-write causes silent entry loss. The correct solution is append-only writes for new entries (`fs.appendFileSync`), which the OS kernel serializes for concurrent appenders without application-level locking. A second risk pathway is the SUMMARY.md integration pattern: executors should populate a `tech_debt` array in their plan SUMMARY.md rather than making trailing bash calls that context-pressured agents skip. A third major risk is migration tool data loss from partial failures or unexpected project layouts — addressed by mandatory dry-run-first behavior, an undo manifest written before any moves, and precondition validation before any file is touched.

---

## Key Findings

### Recommended Stack

GSD v3.0 adds zero npm dependencies. All new capability is implemented using Node.js built-ins already available in the existing `>=16.7.0` engine baseline. The `commands/gsd/fix-debt.md` skill file uses Claude Code's existing `commands/` mechanism (functionally identical to the newer `skills/` format per official docs verified 2026-02-25). The `debt.cjs` module uses `fs.appendFileSync` for append-only writes and `fs.renameSync` (temp-file-then-rename) for any read-modify-write operations like `debt resolve`. The migration tool uses `fs.renameSync` for same-filesystem moves with a `fs.copyFileSync` + `fs.unlinkSync` fallback for cross-partition cases.

**Core technologies:**
- `Node.js fs.appendFileSync` (built-in): Concurrent-safe append for `debt log` command — OS kernel serializes concurrent writes; no application locks needed
- `Node.js fs.renameSync` (built-in): Atomic move for `debt resolve` and migration tool — temp-file-then-rename pattern established in v2.0
- `planningRoot(cwd, milestoneScope)` (existing in `core.cjs`): Required path resolver for all `.planning/` access — INTEGRATION-3/4 bugs exist because this was not used; non-negotiable for all new code
- `Claude Code commands/ skill system`: `/gsd:fix-debt` on-demand debt resolution — no install, no new mechanism; identical to 30+ existing GSD commands
- `Regex-on-Markdown` parsing: `debt.cjs` reads/writes DEBT.md via regex on `### DEBT-NNN` headers and `- **Key:** value` lines — consistent with how `roadmap.cjs`, `state.cjs`, and `milestone.cjs` operate

**Critical version note:** `write-file-atomic` npm package 7.0.0 requires Node `>=20.17.0`, exceeding GSD's `>=16.7.0` floor. Do not add it. The inline `atomicWrite()` implementation (15 lines, already documented in v2.0 STACK.md) is the correct approach for any read-modify-write operations.

### Expected Features

Research confirms a ten-field structured entry format is industry consensus (otherCode.io, Scrum.org, CMU SEI all converge on the same schema). The four-status lifecycle (`open` / `in-progress` / `resolved` / `deferred`) is universally adopted — "deferred" is essential to distinguish deliberate postponement from unattended open items. The Debug2Fix pattern (arxiv 2602.18571) establishes that a diagnostic-first approach before fixing improves outcomes by >20%, which directly informs the `/gsd:fix-debt` skill design.

**Must have (table stakes — v3.0 launch):**
- INTEGRATION-3 + INTEGRATION-4 bug fixes — correctness prerequisite; milestone-scoped paths are silently wrong without these; debt logging from milestone-scoped executors would write to the wrong location
- DEBT.md hub with structured entry format — foundation for all debt features; fields: `id`, `description`, `severity`, `category`, `component`, `source`, `logged` date, `status`, `source_phase`, `source_plan`
- `gsd-tools debt log` — write API; append-only, concurrent-safe via `fs.appendFileSync`; returns new entry ID
- `gsd-tools debt list` — read API; filter by status/severity/category; JSON output for agent consumption
- `gsd-tools debt resolve` — lifecycle management; moves entries from `## Open` to `## Resolved`; uses atomic write
- Executor/verifier/debugger auto-log wiring — makes tracking automatic; gated on quality level (`fast` skips, `standard` logs critical/high, `strict` logs all)
- `/gsd:fix-debt` skill — closes detect-log-fix loop; routes `status: open` entries through debugger first; applies fix via plan-phase --gaps; marks resolved
- Project migration tool — `gsd-tools migrate [--dry-run] [--apply]`; dry-run default, undo manifest, additive only; never destructive

**Should have (v3.x after validation):**
- Debt metrics in `/gsd:progress` — surface open/resolved counts alongside phase progress; trigger: DEBT.md has meaningful entry volume
- `debt-archive` command — prune resolved entries to `DEBT-ARCHIVE.md`; trigger: DEBT.md exceeds ~20 entries
- Planner integration — planner reads DEBT.md before writing tasks to avoid re-introducing known debt

**Defer (v3.x+):**
- Debt-to-PLAN.md conversion — requires PLAN.md template system integration
- Debt age / SLA warnings — requires tracking pipeline maturity
- Auto-prioritization scoring — deliberately an anti-feature; auto-scores create false confidence; filter by severity/category instead

### Architecture Approach

The v3.0 feature set slots into GSD's existing five-layer architecture without structural displacement. The command layer gains `commands/gsd/fix-debt.md`. The CLI layer gains two new `case` blocks in `gsd-tools.cjs`. The module layer gains `debt.cjs` and `migrate.cjs` and receives targeted fixes to `roadmap.cjs` (INTEGRATION-4) and `init.cjs` (INTEGRATION-3). The agent layer gains additive `<debt_logging>` sections in `gsd-executor.md`, `gsd-verifier.md`, and `gsd-debugger.md`. The file-state layer gains `DEBT.md` at `planningRoot(cwd, milestoneScope)/DEBT.md`. DEBT.md is milestone-local (not global) — consistent with STATE.md and ROADMAP.md placement, and essential for concurrent milestone correctness.

**Major components:**
1. `debt.cjs` — DEBT.md CRUD: `cmdDebtLog` (append-only), `cmdDebtList` (filter+format), `cmdDebtResolve` (move between sections); regex-on-Markdown pattern throughout
2. `migrate.cjs` — `.planning/` layout inspection and additive migration: `detectLayoutStyle()` for current state, validation pass before any moves, undo manifest before first move, reference update scan after structural moves
3. `commands/gsd/fix-debt.md` — lean orchestrator skill; selects debt entry via `debt list`, spawns `gsd-debugger` for `status: open` entries, applies fix via `plan-phase --gaps` for `status: diagnosed` entries, marks resolved via `debt resolve`
4. Agent wiring additions — conditional `<debt_logging>` sections in executor (post-task, inside `<quality_sentinel>`), verifier (after gap discovery), debugger (before `archive_session`); under 25 lines each; all wrapped in try-catch to prevent critical-path failures
5. DEBT.md schema — `### DEBT-NNN` sequential headers, `- **Key:** value` fields, `## Open` and `## Resolved` anchor sections; machine-parseable via regex consistent with all other lib modules

**Build order (architecture-mandated dependency graph):**
Phase 1 (Integration Fixes) → Phase 2 (Core Debt Module) → Phase 3 (Migration Tool) → Phase 4 (Agent Wiring) → Phase 5 (/gsd:fix-debt Skill)

### Critical Pitfalls

1. **Concurrent DEBT.md write race (CRITICAL)** — Parallel plan waves spawn multiple executors simultaneously; naive read-modify-write silently loses entries with no error. Prevention: `debt log` uses `fs.appendFileSync` (OS-atomic for concurrent appends on Unix/macOS). Additionally, integrate debt capture into SUMMARY.md `tech_debt` array field rather than trailing bash calls — this makes debt capture verifiable through the existing plan summary spot-check and decouples it from agent execution timing.

2. **Hardcoded `.planning/DEBT.md` path in new code (CRITICAL)** — INTEGRATION-3 and INTEGRATION-4 exist because this shortcut was taken in `init.cjs` and `roadmap.cjs`. All `debt.cjs` functions must use `planningRoot(cwd, milestoneScope)` without exception. Enforce with a grep-based CI test that fails if raw `'.planning/DEBT'` strings appear in new module code.

3. **Migration tool partial failure leaves broken intermediate state (HIGH)** — `fs.renameSync` is not transactional; multi-file operations have no built-in rollback. Prevention: (1) validate all preconditions before touching any files, (2) write an undo manifest before the first move, (3) expose `migrate --undo` that reverses all moves in reverse order using the manifest. Dry-run is the default invocation mode — `--apply` is the opt-in.

4. **Verifier debt logging creates a new critical-path failure mode (HIGH)** — If `debt log` fails (DEBT.md missing, permission error), verification must not fail. Prevention: wrap all debt logging calls in agents with try-catch, emit stderr warning, always exit 0. DEBT.md must also auto-create on first `debt log` call rather than requiring prior initialization.

5. **`/gsd:fix-debt` bypasses the debugger agent's investigation flow (HIGH)** — Debt entries contain the symptom logged by an executor, not the root cause. Applying a fix from the debt entry description alone treats symptoms and the same debt recurs. Prevention: fix-debt routes `status: open` entries through `gsd-debugger` first; only operates on `status: diagnosed` entries when applying fixes; delegates all code changes to spawned subagents, never implements them in the orchestrator.

---

## Implications for Roadmap

Based on the dependency graph confirmed in both FEATURES.md and ARCHITECTURE.md, a five-phase structure is the correct build order. No phase can begin before its predecessor is tested — the dependency relationships are strict, not advisory.

### Phase 1: Integration Fixes
**Rationale:** INTEGRATION-3 and INTEGRATION-4 are correctness bugs that cause milestone-scoped path resolution to silently fail. Any debt command built before these are fixed will either write to the wrong location or appear to work in legacy mode and break silently in milestone-scoped mode. They must be fixed before any v3.0 feature is testable end-to-end. They also set the correct example of `planningRoot()` usage for all subsequent v3.0 code.
**Delivers:** `cmdInitPlanPhase` returns milestone-aware paths; `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` respect `--milestone` flag; all callers in `gsd-tools.cjs` updated in the same commit as the function signature changes; test suite green
**Addresses:** INTEGRATION-3 (`init.cjs` lines ~138-140), INTEGRATION-4 (`roadmap.cjs` + `gsd-tools.cjs` lines ~436-438)
**Avoids:** Pitfall 11 — fix function + all callers + tests in single atomic delivery; grep all call sites before changing signatures
**Research flag:** Standard patterns — exact fix locations documented in TO-DOS.md; no research needed

### Phase 2: Core Debt Module
**Rationale:** DEBT.md schema and CLI commands are the write and read APIs on which all subsequent features depend. Agent wiring (Phase 4) calls `debt log`; `/gsd:fix-debt` (Phase 5) calls `debt list` and `debt resolve`. These must exist and be tested before any caller is built. The schema decision (append-only format, regex-parseable structure) must be locked before coding because changing it after CLI is built requires a schema migration.
**Delivers:** DEBT.md schema definition + template file, `debt.cjs` module (`cmdDebtLog`, `cmdDebtList`, `cmdDebtResolve`), `gsd-tools.cjs` `debt` case with `milestoneScope` threading, `tests/debt.test.cjs` (~20-30 new tests)
**Uses:** `planningRoot()` from `core.cjs`, `fs.appendFileSync` for concurrent-safe log appends, regex-on-Markdown pattern from `roadmap.cjs`/`state.cjs`
**Implements:** File-state layer (DEBT.md) + module layer (debt.cjs)
**Avoids:** Pitfall 1 (concurrent write race — design append-only before coding), Pitfall 3 (DEBT.md not milestone-scoped — use `planningRoot()` from day one), Pitfall 10 (hardcoded paths — grep-based CI test)
**Research flag:** Standard patterns — directly modeled on `state.cjs` and `roadmap.cjs`; no research needed

### Phase 3: Migration Tool
**Rationale:** Migration tool is independent of debt tracking features — it addresses structural concerns (`.planning/` folder layout, config.json completeness). Placing it before agent wiring means migration can also create DEBT.md for legacy projects, ensuring the verifier wiring never encounters a missing DEBT.md on migrated projects (mitigating Pitfall 8 before it can occur).
**Delivers:** `migrate.cjs` (`cmdMigrate` with `--dry-run` default, `--apply` flag, undo manifest, unrecognized file inventory), `gsd-tools.cjs` `migrate` case, migration tests including diverse real-world layout scenarios
**Uses:** `fs.renameSync` for atomic same-filesystem moves, `fs.copyFileSync` + `fs.unlinkSync` for cross-partition fallback, `detectLayoutStyle()` from `core.cjs`, `cmdConfigEnsureSection` pattern from `config.cjs` for additive config updates
**Implements:** Module layer (migrate.cjs)
**Avoids:** Pitfall 4 (layout assumption errors — dry-run default, unrecognized file inventory), Pitfall 5 (path reference breakage — scan + update all `.md`/`.json` references after structural moves, run `validate health` post-migration), Pitfall 6 (partial failure — precondition validation pass before first move, undo manifest)
**Research flag:** Standard patterns — modeled on Flyway dry-run + forward-fix approach; well-documented; no research needed

### Phase 4: Agent Wiring
**Rationale:** Executor, verifier, and debugger wiring depends on the `debt log` CLI command (Phase 2) being tested. The SUMMARY.md `tech_debt` field design must be finalized in this phase — it affects both the executor wiring implementation and any future `debt aggregate` command. This is where debt tracking becomes automatic rather than manual.
**Delivers:** `<debt_logging>` section in `gsd-executor.md` (inside existing `<quality_sentinel>`, conditional), debt-log instruction in `gsd-verifier.md` (wrapped in try-catch, non-fatal), debt-log instruction in `gsd-debugger.md` (before `archive_session`); SUMMARY.md `tech_debt` field integration; quality-level gating
**Addresses:** Executor/verifier/debugger auto-log wiring, quality-level-gated logging (`fast`=off, `standard`=critical/high, `strict`=all), debt linked to phase/plan provenance (`source_phase`, `source_plan` fields)
**Avoids:** Pitfall 2 (executor skipping debt log — SUMMARY.md integration makes capture verifiable), Pitfall 7 (init output schema drift — agent instruction change in same commit as any init output field change), Pitfall 8 (verifier new failure mode — try-catch wrapper, always exit 0)
**Research flag:** Standard patterns — modeled on existing `<quality_sentinel>` section structure; no research needed

### Phase 5: /gsd:fix-debt Skill
**Rationale:** The `/gsd:fix-debt` skill is the highest-complexity deliverable — it orchestrates multiple sub-systems (debt list, gsd-debugger, plan-phase --gaps, debt resolve). All its dependencies must be stable before this is built. Building it last also ensures a meaningful backlog of real DEBT.md entries from auto-logging to test with rather than synthetic test data.
**Delivers:** `commands/gsd/fix-debt.md` orchestrator skill; routes `status: open` entries to `gsd-debugger` for diagnosis; routes `status: diagnosed` entries to `plan-phase --gaps` for fix execution; reads STATE.md before plan creation and warns user if phase is mid-execution; marks resolved via `debt resolve` on completion
**Implements:** Command layer (fix-debt.md)
**Avoids:** Pitfall 9 (bypassing debugger flow — explicitly routes to `gsd-debugger` for undiagnosed entries; does not implement diagnosis logic in the orchestrator), Pitfall 12 (conflicts with active execution — STATE.md status check before any plan creation)
**Research flag:** Consider `/gsd:research-phase` — the routing logic between `status: open` (needs debugger) and `status: diagnosed` (ready for plan-phase --gaps), and the interaction with `plan-phase --gaps` for creating fix plans in a dedicated debt-fix phase vs. the currently-active phase, is novel GSD workflow design territory. The Debug2Fix paper provides the pattern concept but not the GSD-specific orchestration design.

### Phase Ordering Rationale

- Integration fixes come first because they are correctness prerequisites — any milestone-scoped path in any v3.0 feature will silently fail without them. They also demonstrate the `planningRoot()` pattern for all developers working on subsequent phases.
- Core debt module before agent wiring because agents are callers of the debt CLI; the CLI must exist and be tested before its callers are written.
- Migration tool before agent wiring (not strictly required, but preferred) so migrated legacy projects have DEBT.md present, eliminating the graceful-degradation case from verifier wiring before that wiring goes live.
- Agent wiring before fix-debt because fix-debt's value is highest when DEBT.md has real entries from auto-logging. Building fix-debt without wiring would require synthetic test data and leave the system's most valuable loop (auto-detect → auto-log → fix) untested.
- Fix-debt last because it has the broadest dependency surface and the highest design complexity. All its dependencies must be stable.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (/gsd:fix-debt):** The routing logic between `status: open` and `status: diagnosed`, the interaction with `plan-phase --gaps`, and the concurrent-execution guard (STATE.md status check before plan creation) are novel GSD workflow design questions. The decision to create fix plans in a dedicated "debt-fixes" phase vs. injecting as decimal plans into the active phase needs to be made before coding and documented in PROJECT.md.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Integration Fixes):** Exact fix locations documented in TO-DOS.md; mechanical implementation
- **Phase 2 (Core Debt Module):** Directly modeled on `state.cjs` / `roadmap.cjs`; regex-on-Markdown is established codebase convention
- **Phase 3 (Migration Tool):** Dry-run + undo manifest + precondition validation is well-established migration tooling pattern (Flyway, rsync --dry-run)
- **Phase 4 (Agent Wiring):** Additive markdown sections; modeled on existing `<quality_sentinel>` structure

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technology choices are Node.js built-ins or Claude Code platform features verified from official docs (2026-02-25). No new npm dependencies. The `write-file-atomic` Node constraint (Node 20+ required) is confirmed from official GitHub — correctly avoided. |
| Features | HIGH | Entry schema derived from three independent authoritative sources (otherCode.io, Scrum.org, CMU SEI) that all converge on the same ~10 fields. Internal codebase analysis (direct code inspection) confirms all feature gaps and dependency order. |
| Architecture | HIGH | Based on direct codebase inspection of all affected modules — zero training-data inference. All build order dependencies confirmed from live code. The five-layer architecture layering is explicit and well-understood from the existing system. |
| Pitfalls | HIGH | 12 specific pitfalls identified, each with exact file/line attribution from first-party codebase analysis. Concurrent write risk confirmed by direct inspection of `execute-phase.md` parallel wave logic. Migration failure modes derived from established migration tooling literature (Flyway, Node.js fs atomicity docs). |

**Overall confidence: HIGH**

### Gaps to Address

- **DEBT.md schema finalization before Phase 2 coding:** The 10-field schema is settled, but the exact regex parsing strategy for `debt resolve` (moving entries between `## Open` and `## Resolved` sections) needs a design decision before implementation. Validate the chosen Markdown structure produces clean regex-parseable output with a quick prototype before committing.

- **SUMMARY.md `tech_debt` field format:** The PITFALLS.md recommendation to integrate debt capture into plan SUMMARY.md (as an array field) rather than trailing bash calls requires a field format decision during Phase 4. The field must be parseable by any future `debt aggregate` command. Decide format during Phase 4 design to avoid a schema migration later.

- **`/gsd:fix-debt` concurrent-execution guard strategy:** The decision to create fix plans in a dedicated "debt-fixes" phase vs. injecting as decimal plans (e.g., 4.1) into the active phase is not fully resolved. This must be made before Phase 5 implementation begins and documented in PROJECT.md.

---

## Sources

### Primary (HIGH confidence)
- [Claude Code Skills Official Docs](https://code.claude.com/docs/en/skills) — SKILL.md format, `commands/` vs `skills/` equivalence, `$ARGUMENTS` substitution, `disable-model-invocation` field (verified 2026-02-25)
- [Claude Code Subagents Official Docs](https://code.claude.com/docs/en/sub-agents) — Subagent vs skill distinction, spawn pattern, `context: fork` field
- [Claude Code Agent Teams Official Docs](https://code.claude.com/docs/en/agent-teams) — Experimental status, known limitations (no session resumption, task lag)
- [Claude Code Common Workflows — Worktrees](https://code.claude.com/docs/en/common-workflows) — `--worktree` flag, `isolation: worktree` frontmatter
- [Node.js fs documentation](https://nodejs.org/api/fs.html) — `appendFileSync`, `renameSync`, `copyFileSync`, EXDEV cross-partition behavior
- [otherCode.io — Technical Debt Records](https://othercode.io/blog/technical-debt-records) — 10-field entry schema, status lifecycle (direct fetch, primary source)
- [Scrum.org — Technical Debt Register in Scrum](https://www.scrum.org/resources/blog/using-technical-debt-register-scrum) — Status field values (`open/in-progress/resolved/deferred`), register structure
- Internal: `.planning/PROJECT.md` v3.0 target features — canonical requirements (direct read 2026-02-25)
- Internal: `.planning/TO-DOS.md` — INTEGRATION-3/INTEGRATION-4 exact file/line locations (direct read)
- Internal codebase inspection: `get-shit-done/bin/gsd-tools.cjs`, `lib/core.cjs`, `lib/roadmap.cjs`, `lib/init.cjs`, `lib/state.cjs`, `lib/config.cjs`, `agents/gsd-executor.md`, `agents/gsd-verifier.md`, `agents/gsd-debugger.md`, `commands/gsd/debug.md`, `tests/helpers.cjs` — all patterns confirmed via direct code inspection

### Secondary (MEDIUM confidence)
- [Debug2Fix: Supercharging Coding Agents with Interactive Debugging Capabilities](https://arxiv.org/html/2602.18571) — Debugger-first subagent pattern; >20% fix quality improvement on Java benchmarks (arxiv Feb 2025)
- [write-file-atomic GitHub (npm/write-file-atomic)](https://github.com/npm/write-file-atomic) — Node `^20.17.0 || >=22.9.0` engine constraint — reason to implement inline instead
- [Flyway Migration Dry Runs](https://documentation.red-gate.com/fd/migration-command-dry-runs-275218517.html) — Dry-run default, forward-fix pattern for migration tools
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) — PreToolUse/PostToolUse/Stop events, exit code 2 blocking behavior
- [agentlint GitHub](https://github.com/mauhpr/agentlint) — Pre-built quality rules; Quality Pack as starting point for hooks
- [CMU SEI — Documenting Technical Debt](https://www.sei.cmu.edu/blog/experiences-documenting-and-remediating-enterprise-technical-debt/) — Enterprise debt documentation field consensus
- [markheath.net — How Should You Track Technical Debt?](https://markheath.net/post/technical-debt-register) — Practitioner field set corroborating otherCode.io schema

### Tertiary (LOW confidence)
- Context7 MCP API quota exceeded during research — runtime doc query behavior not verified; pattern knowledge from training data corroborated by multiple secondary sources

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
