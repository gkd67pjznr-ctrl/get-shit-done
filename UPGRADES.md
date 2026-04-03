# GSD Enhanced Fork — Upgrades

## Overview

This is a forked, upgraded version of the [GSD (Get Shit Done)](https://github.com/anthropics/gsd) framework for Claude Code. It adds quality enforcement, concurrent milestone execution, structured tech debt management, an adaptive learning layer with skill refinement, a device-wide dashboard, and deterministic quality gate enforcement.

**Core value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

### Fork Stats

| Dimension | Value |
|-----------|-------|
| Fork started | 2026-02-23 |
| Milestones shipped | 10 (v1.0 through v8.0) |
| Total duration | ~6 weeks |
| Phases | 52 |
| Plans | 108 |
| Validated requirements | 180+ |
| Commits | 1,600+ |
| Tests passing | 979/982 across 200 suites (36 test files) |
| Source modules | 15 lib modules (~9K LOC) |
| Skills | 17 auto-loading SKILL.md files |
| Hooks | 12 deterministic hook files |
| Workflows | 35 orchestrator definitions |

---

## Why This Fork Exists

Vanilla GSD gives Claude structure: phases, plans, wave-based execution, verification. It doesn't enforce quality at the code level.

The gap: Claude can skip writing tests, ignore existing patterns in the codebase, hand-roll utilities that already exist, and produce "slop" — code that passes verification because verification only checks requirements, not code quality.

This fork closes that gap with eight milestone iterations:

1. **Quality enforcement** (v1.0–v1.1): Quality Sentinel in executor, Context7 library lookup, mandatory tests, quality dimensions in verifier. Config-gated.

2. **Concurrent milestones** (v2.0): Isolated workspaces per milestone, lock-free dashboard, advisory conflict detection, `--milestone` flag throughout.

3. **Tech debt system** (v3.0): DEBT.md with TD-NNN entries, `debt log/list/resolve` CLI, auto-logging gated by quality level, `/gsd:fix-debt` skill.

4. **Legacy strip** (v3.1): Milestone-scoped is the only layout. All legacy branching removed. Net -14K lines.

5. **Adaptive learning** (v4.0): gsd-skill-creator merged into core. 17 skills, 12 hooks, native observation in all 7 workflow commands.

6. **Device-wide dashboard** (v5.0): Multi-project command center with live terminals, session monitoring, cross-project metrics.

7. **Adaptive observation** (v6.0): Correction capture with 14-category taxonomy, preference learning, recall injection, observer agent, bounded learning guardrails.

8. **Quality observability** (v7.0): Gate execution persistence to JSONL, dashboard Gate Health page, gate-to-correction attribution analytics.

9. **Close the loop** (v8.0): Skill feedback loop wired end-to-end (corrections → analysis → suggestions → skill refinement). Quality gates moved from agent instructions to deterministic PostToolUse hooks.

All changes are additive. Existing GSD behavior is preserved. The default quality level (`fast`) produces zero behavioral change from vanilla GSD.

---

## Milestone v1.0 — Quality Enforcement (Shipped 2026-02-24)

**Delivered:** A quality enforcement framework that makes Claude's executor behave like a senior engineer.

| Stat | Value |
|------|-------|
| Phases | 4 |
| Plans | 8 |
| Files modified | 31 (+4,423 / -77) |
| Requirements satisfied | 23/23 |

### The Quality Sentinel

The Quality Sentinel is a 3-stage gate embedded in the executor agent. It runs before, during, and after each task.

**Stage 1 — Pre-task codebase scan:** Before writing any code, the executor reads `<code_to_reuse>` from the plan's task action, runs targeted grep patterns against the codebase, and evaluates existing functions as reuse candidates. If a similar function exists, the executor reuses it and documents the decision in the commit message. Maximum 10 lines of grep output — targeted, not exhaustive.

**Stage 2 — Context7 library lookup:** Before implementing any external library usage, the executor calls Context7 to get current API documentation. This eliminates hand-rolled utilities that duplicate library functionality, and prevents API-level errors from stale knowledge. One query per plan maximum to keep context budget under control.

**Stage 3 — Post-task diff review:** After writing code but before committing, the executor runs `git diff --staged` and self-reports: naming conflicts with existing code, duplicated logic found in the pre-task scan, TODO/FIXME comments left in changed lines, and error paths with no handling.

**Gate behavior by quality level:**

| Gate | fast | standard | strict |
|------|------|----------|--------|
| Pre-task codebase scan | Skip | Run | Run |
| Context7 lookup | Skip | New deps only | Always |
| Test baseline record | Skip | Run | Run |
| Test gate (new logic) | Skip | New `.cjs/.js/.ts` with exports | Always |
| Post-task diff review | Skip | Run | Run |

### Mandatory Test Step

For any task that produces a new `.cjs/.js/.ts` file with exports, the executor writes a test file before committing. The test file path comes from `<tests_to_write>` in the plan action. If the planner marks `N/A` but the task produced exported logic, tests are still required and the deviation is logged.

### Quality Dimensions in Verifier

The verifier gains a Step 7b that checks code quality independently of requirements. It detects: duplication within the same phase, orphaned exports (exported but never imported), and missing test files for new modules. Findings are reported in the verification output.

### Planner Quality Directives

Plan task actions now include three structured fields that the executor reads:

```xml
<quality_scan>
  <code_to_reuse>Known: path/to/existing/utility.cjs — evalulate for reuse</code_to_reuse>
  <docs_to_consult>Context7: /library-id — query "specific method"</docs_to_consult>
  <tests_to_write>File: tests/feature.test.cjs — success path and edge cases</tests_to_write>
</quality_scan>
```

This encodes the planner's domain analysis into each task, so the executor has specific search targets rather than scanning blindly.

### Bug Fixes

- **`is_last_phase` routing bug:** `cmdPhaseComplete` previously miscalculated the last phase, causing multi-phase milestones to exit early. Fixed via filesystem scan.
- **Roadmap-aware phase routing:** Phase transition now correctly identifies the next unplanned phase from ROADMAP.md.

### How to Use

Quality levels are controlled per-project in `.planning/config.json`:

```json
{
  "quality": {
    "level": "standard"
  }
}
```

Valid values: `fast` (default — zero behavioral change from vanilla GSD), `standard` (recommended for most projects), `strict` (maximum enforcement).

---

## Milestone v1.1 — Quality UX (Shipped 2026-02-24)

**Delivered:** Quality enforcement made discoverable, configurable, and observable.

| Stat | Value |
|------|-------|
| Phases | 3 |
| Plans | 5 |
| Tasks | 10 |
| Files modified | 34 (+3,781 / -34) |
| Requirements satisfied | 9/9 |

### `/gsd:set-quality` Command

Switch quality levels without editing config.json directly:

```
/gsd:set-quality standard          # per-project
/gsd:set-quality strict --global   # all new projects
```

The `--global` flag writes to `~/.gsd/defaults.json`. New projects initialized after setting a global default inherit that level.

### Config Auto-Migration

When an existing project is opened, the config migration checks for a missing `quality` block and adds it automatically. No manual editing required.

### Quality Observability

After each plan execution in `standard` or `strict` mode, the SUMMARY.md includes a Quality Gates section:

```markdown
## Quality Gates

| Gate | Task | Outcome | Notes |
|------|------|---------|-------|
| Pre-task scan | Task 1 | passed | Reused parsePhase() from phase.cjs |
| Context7 lookup | Task 2 | skipped | Node.js built-in, no docs needed |
| Test gate | Task 3 | passed | 5 new tests written |
| Diff review | Task 3 | warned | 1 TODO comment found and removed |
```

In `fast` mode, no Quality Gates section appears — nothing ran, nothing to report.

### Context7 Token Cap

Configure the maximum tokens returned by a Context7 query:

```json
{
  "quality": {
    "context7_token_cap": 2000
  }
}
```

### Quality Level in Progress Output

`/gsd:progress` now shows the active quality level alongside phase/plan status, so the current enforcement posture is always visible.

---

## Milestone v2.0 — Concurrent Milestones (Shipped 2026-02-25)

**Delivered:** Multiple milestones running in parallel with isolated workspaces, no file locking, and zero impact on existing single-milestone projects.

| Stat | Value |
|------|-------|
| Phases | 7 |
| Plans | 13 |
| Files changed | 108 (+26,299 / -5,442) |
| Requirements satisfied | 34/34 |
| New tests | 87 |

### Core Architecture: `planningRoot()` and `detectLayoutStyle()`

All path resolution routes through a single function:

```javascript
const root = planningRoot(cwd, milestoneScope);
// Returns: .planning/           (legacy mode)
// Returns: .planning/milestones/v2.0/  (milestone-scoped mode)
```

`detectLayoutStyle(cwd)` reads `config.json` and returns one of three states:
- `'legacy'` — standard single `.planning/` directory
- `'milestone-scoped'` — `concurrent: true` in config.json, isolated workspaces
- `'uninitialized'` — no config found

The sentinel value is `concurrent: true` in `config.json` — not directory presence, which would produce false positives from archive directories.

### Workspace Isolation

Each milestone gets a complete isolated workspace:

```
.planning/milestones/v2.0/
  STATE.md
  ROADMAP.md
  REQUIREMENTS.md
  conflict.json
  phases/
  research/
```

No shared mutable state between concurrent milestones. No locks needed — each milestone session reads and writes only its own workspace.

### `--milestone` Flag

All 7 workflow files and all 7 init commands accept `--milestone <version>`. The flag is parsed by the CLI router and passed as `milestoneScope` to all downstream functions:

```bash
# Start a plan within a specific milestone workspace
/gsd:execute-phase --milestone v2.0
```

### Lock-Free Dashboard

Each active milestone writes a `STATUS.md` at natural checkpoints (plan complete, phase complete, checkpoint reached). The `cmdProgressRenderMulti` command reads all STATUS.md files at display time and aggregates them — no write coordination, no lock contention.

### Advisory Conflict Detection

`milestone manifest-check` reads all active `conflict.json` files and reports overlapping file paths across concurrent milestones. It always exits 0 — it warns but never blocks. Semantic correctness of concurrent code changes cannot be automated; this surfaces the overlap so a human can decide.

### Legacy Compatibility

Old-style projects (single `.planning/` directory without `concurrent: true`) are auto-detected via `detectLayoutStyle()`. They continue to work exactly as before — no migration required, no deprecation warnings, permanent support.

### How to Use

```bash
# Enable concurrent milestones
# Set concurrent: true in .planning/config.json

# Create a new milestone workspace
/gsd:new-milestone v3.0

# Work within a milestone
/gsd:execute-phase --milestone v3.0

# Check for conflicts across active milestones
gsd-tools milestone manifest-check

# View multi-milestone dashboard
/gsd:progress
```

---

## Milestone v3.0 — Tech Debt System (Shipped 2026-02-26)

**Delivered:** Structured tech debt tracking from discovery through resolution.

| Stat | Value |
|------|-------|
| Phases | 6 |
| Plans | 8 |
| Tasks | 14 |
| Files changed | 118 (+13,227 / -1,211) |
| Requirements satisfied | 19/19 |
| New tests | 34 |

### DEBT.md Schema

Tech debt is tracked in `.planning/DEBT.md` with structured entries using 10 fields:

| Field | Description |
|-------|-------------|
| `id` | TD-NNN (sequential, auto-assigned) |
| `type` | `bug`, `missing-feature`, `design`, `test-gap`, `doc-gap` |
| `severity` | `critical`, `high`, `medium`, `low`, `info` |
| `component` | Module or file path |
| `description` | What the debt is |
| `date_logged` | ISO date |
| `logged_by` | `executor`, `verifier`, `human`, or agent name |
| `status` | `open`, `in-progress`, `resolved`, `deferred` |
| `source_phase` | Phase that generated the debt |
| `source_plan` | Plan that generated the debt |

### CLI Commands

```bash
# Log a new debt entry
gsd-tools debt log \
  --type bug \
  --severity high \
  --component get-shit-done/bin/lib/milestone.cjs \
  --description "cmdMilestoneComplete phasesDir hardcoded to .planning/phases/"

# List debt entries (filterable)
gsd-tools debt list
gsd-tools debt list --status open
gsd-tools debt list --severity critical
gsd-tools debt list --type bug

# Resolve a debt entry
gsd-tools debt resolve --id TD-001 --status resolved
```

### Executor Auto-Logging

The Quality Sentinel hooks auto-create debt entries when gates produce noteworthy findings. Gated by quality level:

| Quality Level | Auto-logs |
|---------------|-----------|
| `fast` | Nothing |
| `standard` | Critical and high severity only |
| `strict` | All severities |

Entries are additive-only — the sentinel/verifier gate logic is unchanged. Zero regression risk.

### Verifier Auto-Logging

When the verifier's Step 7b quality dimension checks find issues (duplication, orphaned exports, missing test files), those findings are auto-logged to DEBT.md with provenance: which phase, which plan, which file.

### `migrate.cjs` — Planning Layout Migration

Upgrade existing `.planning/` directories to include new schema fields and directory structures:

```bash
# Preview what migration would do (no changes made)
gsd-tools migrate --dry-run

# Apply migration (additive only — never removes existing content)
gsd-tools migrate --apply

# Clean up migration artifacts
gsd-tools migrate --cleanup --dry-run
gsd-tools migrate --cleanup
```

Migration is project-scoped, not milestone-scoped. It operates on `.planning/` directly.

### `/gsd:fix-debt` Skill

An 8-step orchestrator for resolving debt entries on demand:

1. Read the debt entry from DEBT.md by ID
2. Check if description is already actionable (rich-description skip path for auto-logged entries)
3. If not, spawn the GSD debugger agent to diagnose the issue
4. Generate an inline mini-plan (bypasses ROADMAP lookup for fast path)
5. Spawn the GSD executor agent to fix the issue
6. Run tests to verify the fix
7. Mark the debt entry resolved in DEBT.md
8. Report outcome

```bash
/gsd:fix-debt TD-042
```

### v2.0 Integration Gaps Resolved

Two integration gaps accepted as debt in v2.0 were fixed in v3.0:

- **INTEGRATION-3:** `cmdInitPlanPhase` now uses `planningRoot()` for milestone-aware path resolution instead of hardcoded `.planning/` paths.
- **INTEGRATION-4:** `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` now respect the `--milestone` flag.

---

## CLI Tool Reference

`gsd-tools.cjs` is the CJS CLI backing all GSD framework operations. Run it directly or via the workflow slash commands.

### Quality Commands

```bash
# Set quality level for current project
gsd-tools set-quality fast
gsd-tools set-quality standard
gsd-tools set-quality strict

# Set global default for new projects
gsd-tools set-quality standard --global
```

### Debt Commands

```bash
gsd-tools debt log --type <type> --severity <sev> --component <path> --description <text>
gsd-tools debt list [--status open|in-progress|resolved|deferred] [--severity critical|high|medium|low|info] [--type bug|...]
gsd-tools debt resolve --id TD-NNN --status resolved
```

### Migration Commands

```bash
gsd-tools migrate --dry-run [--version <v>]
gsd-tools migrate --apply [--version <v>]
gsd-tools migrate --cleanup [--dry-run]
```

### Milestone Commands

```bash
gsd-tools milestone complete <version> [--name <name>] [--archive-phases]
gsd-tools milestone new-workspace <version>
gsd-tools milestone write-status <version> --phase <p> --plan <n> --checkpoint <c> --progress <pct> --status <s>
gsd-tools milestone manifest-check
```

### Validation Commands

```bash
gsd-tools validate health [--repair]
gsd-tools config-get quality.level
```

---

## Architecture and Design Decisions

Key decisions made during this fork, grouped by theme.

### Quality Enforcement

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork the repo (not extension layer) | Need to modify agent files directly; extension would add indirection | Direct modification enabled clean quality gate integration |
| Quality Sentinel inline in executor (not separate agent) | Separate agent burns 50-100K context on handoff; inline burns 6-16K | Keeps context budget manageable |
| Context7 called in executor | Library awareness needed at coding time, not planning time | Docs consulted when code is being written, not hours earlier |
| quality.level defaults to `fast` | Zero behavioral change from vanilla GSD when quality gates are introduced | No surprise behavior for existing users |
| One Context7 query per plan maximum | Multiple queries signal the plan is too broad | Context budget stays predictable |
| N/A override guard for `tests_to_write` | Planner may mark N/A but if task produced exports, tests still required | Prevents planner error from bypassing mandatory test requirement |
| Quality Gates section absent in fast mode | Nothing ran; empty section would be misleading | Clean SUMMARY.md in fast mode |

### Concurrency

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `planningRoot()` as single path resolver | All modules call one function; no string literals for `.planning/` paths | Clean dependency chain, easy to test |
| `detectLayoutStyle()` uses config.json sentinel | Directory presence detection is fragile; explicit `concurrent: true` is unambiguous | Archive directories don't trigger false positives |
| Workspace isolation (not file locking) | Stale locks from killed sessions worse than no locks | No lock cleanup needed; each session works in its own directory |
| Lock-free dashboard via STATUS.md | Per-milestone STATUS.md files aggregated at read time; no write coordination | No split-brain, no lock contention |
| Advisory-only conflict detection | Semantic correctness of concurrent changes can't be automated | Warnings visible without blocking execution |
| Permanent legacy compatibility | Old-style projects never forced to migrate; detection is additive | Zero migration burden, existing projects unaffected |

### Tech Debt

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Debt logging additive-only in agents | Don't modify existing sentinel/verifier gate logic | Zero regression risk in quality gate behavior |
| Trigger B (blocked gate) strict-mode only | Standard mode warned outcomes are informational, not debt | Prevents noise in standard mode |
| Inline mini-plan for fix-debt | Executor spawned directly, bypasses ROADMAP lookup | Fast path for debt fixes without full phase overhead |
| Rich-description skip path in fix-debt | Auto-logged debt entries already actionable; skip diagnosis | Reduces friction for well-described debt |
| No `--milestone` flag on migrate | Operates on project-level `.planning/`, not milestone workspaces | Migration is project-scoped, not milestone-scoped |

---

## Test Coverage

| Suite | LOC | Description |
|-------|-----|-------------|
| `phase.test.cjs` | 1,511 | Phase lifecycle, routing, normalization |
| `commands.test.cjs` | 857 | CLI command dispatch and argument parsing |
| `init.test.cjs` | 596 | Project initialization, config migration |
| `milestone.test.cjs` | 510 | Milestone workspace creation, manifest-check |
| `roadmap.test.cjs` | 503 | ROADMAP.md parsing, progress tracking |
| `debt.test.cjs` | ~350 | Debt log/list/resolve commands (19 tests) |
| Other suites | — | routing, migrate, state, core, etc. |
| **Total** | **6,305** | **298 tests across 14 suites** |

Run the full test suite:

```bash
node --test tests/*.test.cjs
```

Tests use Node.js built-in test runner (`node:test`, `node:assert`). No test framework dependencies.

---

## Known Limitations

Tracked in `.planning/DEBT.md` and `.planning/MILESTONES.md`.

| Area | Issue | Impact |
|------|-------|--------|
| State | `cmdStateUpdateProgress` uses flat `.planning/phases/` path (MISS-01) | Medium — broken for milestone-scoped layouts |
| Gates | `/FAIL\b/` regex doesn't match "FAILED" | Low — Vitest uses "FAIL" not "FAILED" |
| Gates | `test_baseline` gate not implemented | Deferred — documented in GATE-ENFORCEMENT-DECISION.md |
| Documentation | SUMMARY.md frontmatter and REQUIREMENTS.md checkboxes drift | Systemic — cosmetic, all requirements verified PASS |
| Tests | 3 pre-existing failures in config, foundation, tmux-server tests | Pre-existing — unrelated to fork changes |

---

## Links and References

- `.planning/MILESTONES.md` — detailed per-milestone accomplishments, stats, and accepted gaps
- `.planning/PROJECT.md` — project context, requirements list, all key decisions with rationale
- `.planning/RETROSPECTIVE.md` — per-milestone retrospective with cross-milestone trends
- `.planning/DEBT.md` — current open tech debt entries with TD-NNN IDs
- `.planning/STATE.md` — milestone completion dates and quick task history
- `get-shit-done/bin/gsd-tools.cjs` — CLI entry point
- `tests/*.test.cjs` — 36 test files covering all modules
