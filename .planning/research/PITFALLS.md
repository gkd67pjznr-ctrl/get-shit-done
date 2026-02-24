# Pitfalls Research

**Domain:** Concurrent milestone execution and workspace isolation — GSD Enhanced Fork (v2.0)
**Researched:** 2026-02-24
**Confidence:** HIGH (first-party codebase analysis: 94 hardcoded `.planning/` refs in workflows, 83 in agents, 67 in lib/*.cjs, 30 in tests; 102+ tests exercising current structure)

---

## Part 1: V2.0 Concurrent Milestone Pitfalls

These pitfalls are specific to adding concurrent milestone execution on top of the existing serial-only framework.

---

### Pitfall 1: Git Merge Conflicts from Concurrent Session Commits

**What goes wrong:**
Two Claude Code sessions working on separate milestones both commit to the same branch of the same git repository. Session A commits `.planning/STATE.md`. Session B, which hasn't pulled, also commits `.planning/STATE.md` with different content. One session's `git commit` succeeds; the other gets a non-fast-forward push rejection. The session that fails has no recovery path built in — its commit tools assume success. The session either stalls or overwrites the other session's changes.

**Why it happens:**
The existing `cmdCommit` in `core.cjs` calls `git add` and `git commit` with no pre-commit pull, no merge strategy, and no conflict detection. It was designed for single-session serial execution where only one session is ever writing at a time. GSD's `commit_docs` config enables or disables commit entirely but has no concept of concurrent writers to the same files.

Shared files that are natural conflict zones:
- `.planning/STATE.md` — both milestones update "last activity" and progress fields
- `.planning/ROADMAP.md` — milestone-complete workflow rewrites sections
- `.planning/MILESTONES.md` — milestone complete appends to this file
- `.planning/PROJECT.md` — new-milestone workflow updates "Current Milestone" section
- `.planning/dashboard.json` — if a central lock-free dashboard is introduced

**How to avoid:**
- Shared files must be owned exclusively by one party. Each milestone gets its own subdirectory (`.planning/milestones/v2.0-workspace/`) for all milestone-local state. Cross-milestone shared files (`STATE.md`, `ROADMAP.md`) must be treated as read-only by concurrent sessions, or migrated to per-milestone equivalents.
- If shared files must be written concurrently, introduce a file-locking protocol: write to a temp file with a session-unique name, then atomic rename only on success.
- The dashboard (if central) must be append-only with a fixed per-milestone section. No session rewrites another session's section.
- Validate before the concurrent milestone feature ships: two actual simultaneous `git commit` runs from different temp directories targeting the same branch, confirming the conflict detection and recovery path works.

**Warning signs:**
- `git commit` output containing `rejected` or `non-fast-forward` anywhere in gsd-tools commit logs.
- `.planning/STATE.md` showing alternating "last activity" timestamps from two sessions within the same minute.
- MILESTONES.md entries out of chronological order (indicates concurrent appends that interleaved).

**Phase to address:**
Workspace isolation design phase — the ownership model for every shared file must be decided before any code is written. "Which files does each session own exclusively?" is the first deliverable.

---

### Pitfall 2: Dashboard File Corruption from Concurrent Writes

**What goes wrong:**
A central dashboard file (e.g., `.planning/dashboard.json`) tracks the status of all concurrent milestones. Two sessions both read the file, both compute an updated version in memory, both write back. The second write silently overwrites the first. The result is a dashboard that reflects Session B's milestone as "in progress" but has lost Session A's status update entirely — no error, no conflict, no trace.

**Why it happens:**
Node.js `fs.writeFileSync` is not atomic at the OS level on macOS. The standard read-modify-write pattern used throughout GSD (`fs.readFileSync` → mutate → `fs.writeFileSync`) has a race window between read and write. With two processes hitting the same file within milliseconds (possible if both sessions commit triggers simultaneously), one write will silently overwrite the other.

**How to avoid:**
- Design the dashboard as append-only with per-milestone fixed-offset sections, not a shared mutable JSON blob. Each session only writes to its own section; no session reads-then-rewrites the whole file.
- Alternatively, make each milestone its own file (`.planning/milestones/v2.0/STATUS.md`, `.planning/milestones/v2.1/STATUS.md`) and build a viewer that aggregates them at read time. No shared write target.
- If a single dashboard JSON is required, use a file-locking library (`proper-lockfile` or `lockfile`) around every write. GSD already uses CJS — `require('proper-lockfile')` is straightforward. Never write the dashboard without acquiring the lock first.
- Write a test that spawns two processes simultaneously updating the dashboard and verifies both updates survive. This test must pass before the dashboard is considered complete.

**Warning signs:**
- Dashboard showing a milestone as "not started" when it is clearly running.
- Status updates from one session disappearing after another session commits.
- Dashboard JSON failing `JSON.parse()` due to interleaved partial writes (indicates concurrent byte-level corruption, the worst case).

**Phase to address:**
Dashboard implementation phase — the write strategy (append-only vs. locked JSON vs. per-milestone files) must be selected before implementing the dashboard. Retrofitting a write-safety mechanism after the fact is significantly harder.

---

### Pitfall 3: Incomplete Path Migration — Some Files Updated, Some Not

**What goes wrong:**
The refactor changes `.planning/phases/01-foundation/` to `.planning/milestones/v2.0/phases/01-foundation/` (milestone-scoped). Phase paths are updated in `phase.cjs`, `core.cjs`, and `roadmap.cjs`. But 94 occurrences in workflow `.md` files and 83 occurrences in agent `.md` files are not updated because grep searches only covered `*.cjs`. Workflows still hardcode `.planning/phases/`, agents still read from `.planning/STATE.md`, and the verify step still resolves to the global path. The system appears to work during unit tests (which use the new path) but fails silently during live execution because workflows use the old paths.

**Why it happens:**
This is a ~270-occurrence distributed path change across 4 file types (`.cjs`, `.md` agents, `.md` workflows, `.cjs` tests). A partial grep or a change strategy that only covers one file type leaves the rest behind. The system has no path constant — `.planning/phases` is a string literal scattered across dozens of files. There is no compile-time error when a workflow references a non-existent path; it just fails at runtime.

From direct analysis:
- `get-shit-done/workflows/*.md`: 94 occurrences of `.planning/phases`
- `agents/*.md`: 83 occurrences of `.planning/`
- `get-shit-done/bin/lib/*.cjs`: 67 occurrences of `.planning/`
- `tests/*.cjs`: 30 occurrences of `.planning/`

**How to avoid:**
- Before writing any new code, create a full inventory: `grep -rn "\.planning/phases\|\.planning/STATE\|\.planning/ROADMAP" --include="*.md" --include="*.cjs"`. Count every occurrence. This is your migration checklist.
- Do not use raw string replacement. Instead, introduce a path resolver function (`resolvePlanningPath(cwd, type, milestone)`) in `core.cjs` that centralizes path construction. Then replace string literals with resolver calls. The resolver is the single source of truth.
- Use the backward-compatibility layer: the resolver returns `.planning/phases/` for projects without milestone workspaces, and `.planning/milestones/v2.0/phases/` for projects with workspaces. Old projects transparently use the old paths.
- Run the full test suite after every batch of path updates, not just at the end. Incremental verification catches regressions before they compound.
- Agent and workflow `.md` files use bash commands with hardcoded paths. These cannot be unit-tested via the CJS test suite — write end-to-end integration tests that actually execute workflow bash commands in a controlled temp project.

**Warning signs:**
- Unit tests passing but live `/gsd:execute-phase` workflow failing to find PLAN.md files.
- `find-phase` tool returning `found: true` but the workflow's own `ls .planning/phases/...` returning nothing.
- Agent prompts referencing `.planning/phases/` paths that resolve to empty directories in new-style projects.

**Phase to address:**
Path architecture phase (first deliverable) — build the resolver and backward-compat detection before touching any other file. Every subsequent phase uses the resolver. Do not start path migration until the resolver exists and is tested.

---

### Pitfall 4: Backward Compatibility Layer Breaking Existing Projects

**What goes wrong:**
The compatibility layer detects "old-style" projects (`.planning/` root layout) and routes them through the old path logic. But the detection logic is wrong — it checks for the existence of `.planning/milestones/` and concludes "new-style if present, old-style if absent." Existing projects that have completed milestones already have a `.planning/milestones/` directory (it's where archived ROADMAPs live). Those projects get misidentified as "new-style" and all their paths break.

**Why it happens:**
The `.planning/milestones/` directory already exists in old-style projects that have run `milestone complete`. Looking at `cmdMilestoneComplete` in `milestone.cjs` (line 86): it creates `.planning/milestones/` as the archive directory for old-style milestone archival. The "new-style" marker cannot be the mere presence of this directory.

**How to avoid:**
- Use an explicit sentinel file for new-style detection: `.planning/CONCURRENT.md` or a `"concurrent": true` key in `config.json`. The sentinel is only created when a project is explicitly upgraded. Its absence means old-style, regardless of what other directories exist.
- Write the detection logic as a single function in `core.cjs` (`isConcurrentProject(cwd)`). Every path-branching decision calls this function. No other code re-implements the detection logic.
- Test the compatibility layer with the three cases: (1) brand new project with no milestones, (2) old-style project with one completed milestone and a `.planning/milestones/` archive, (3) new-style concurrent project. All three must route to the correct path logic.

**Warning signs:**
- Old-style projects that have completed milestones suddenly failing with "phase not found" errors after the upgrade.
- `cmdMilestoneComplete` paths resolving to `.planning/milestones/v1.1/phases/01-foundation/` (new-style path) when the project is actually old-style.
- Compatibility tests passing because they only test the no-milestones case, not the already-completed-milestone case.

**Phase to address:**
Compatibility layer phase — the detection sentinel must be designed before implementing the compatibility router. Document the exact sentinel chosen (config key recommended) as a framework decision in PROJECT.md before writing code.

---

### Pitfall 5: Test Suite Breakage During Structural Changes

**What goes wrong:**
The 102+ test suite creates temp directories via `createTempProject()` in `helpers.cjs`, which hardcodes `.planning/phases/` in the setup. When path structure changes, `createTempProject()` creates the old layout, and tests that exercise new-style paths fail because the test scaffold doesn't match the new structure. Tests appear "broken" but the underlying code is correct — the test scaffold is stale.

Worse: tests modified to use new-style paths no longer test old-style behavior. The backward-compat layer loses test coverage silently.

**Why it happens:**
The `createTempProject()` helper is shared by all 102+ tests. A single-point-of-truth for test scaffold is a virtue for serial-only code, but becomes a liability when the system needs to support two different project layouts. There is no mechanism to create a "concurrent-style temp project" vs. an "old-style temp project" — one helper serves all.

**How to avoid:**
- Extend `helpers.cjs` with `createConcurrentProject()` alongside the existing `createTempProject()`. The old helper remains unchanged and continues to scaffold old-style layout. New tests for concurrent features use the new helper.
- Never modify `createTempProject()` itself. Changing the shared helper breaks all 102+ existing tests simultaneously.
- Run the existing test suite after every structural change to confirm zero regressions before adding new tests. The sequence is: green → change → green again → add new tests.
- For the backward-compat layer, write explicit tests that call `createTempProject()` (old-style) through the new code paths and verify they still pass. These are the regression tests for the compat layer.

**Warning signs:**
- More than 5 existing tests failing after a structural change (indicates `createTempProject()` was modified or a shared assumption was broken).
- New tests only using `createConcurrentProject()` with no tests using `createTempProject()` — the compat layer has no test coverage.
- Test failures referencing `.planning/phases/` path as "not found" in a test that previously created it.

**Phase to address:**
Test architecture phase — extend helpers before modifying any code that tests exercise. The helper extension must be the first commit in any phase that restructures paths.

---

### Pitfall 6: Agent Prompt Drift When Parameterizing File Paths

**What goes wrong:**
Agent `.md` files currently contain hardcoded bash commands like `ls .planning/phases/XX-name/*.md`. To support milestone-scoped paths, these are parameterized: `ls ${MILESTONE_WORKSPACE}/phases/XX-name/*.md`. But the parameterization is inconsistent — some agents use `${MILESTONE_WORKSPACE}`, others use `${PHASE_DIR}`, others still use the hardcoded path. The gsd-executor gets the right path, but the gsd-verifier reads from the wrong location. The verification passes (no files found) but the agent interprets "no files found" as "nothing to verify" rather than as a path error.

**Why it happens:**
Agent `.md` files are prose, not compiled code. There is no type system, no linter, no test that runs the bash commands inside agent prompts. Parameter names are invented on the fly during editing. Without a canonical list of variable names defined in a reference file, each agent author uses whichever name feels right. The variable name used in the `init execute-phase` output JSON must exactly match the variable name referenced in the agent's bash commands — and there is no enforcement that they match.

**How to avoid:**
- Define a canonical variable glossary in a reference file (e.g., `get-shit-done/references/path-variables.md`) before editing any agent. The glossary lists: `MILESTONE_WORKSPACE`, `PHASE_DIR`, `PLANNING_ROOT` — exactly what each resolves to, in both old-style and new-style projects, and which gsd-tools init command outputs them.
- Use `init execute-phase` (and other `init *` commands) as the authoritative source of variables. Add new path variables to the init command outputs first; then update agent bash commands to use those output names.
- After editing each agent, run a diff against the variable glossary to verify no invented names were introduced.
- Test at least one full workflow execution (plan → execute → verify → transition) in both old-style and new-style project modes before declaring the agent migration complete.

**Warning signs:**
- Bash commands in agents failing with "No such file or directory" in new-style projects even though the file exists at the correct milestone-scoped path.
- Multiple variable names for the same concept appearing in different agent files (e.g., `$PHASE_PATH`, `$PHASE_DIR`, `$PHASE_DIRECTORY` all used in different agents for the same path).
- Agent failing silently (interpreting missing files as "nothing to do") rather than hard erroring on path resolution failure.

**Phase to address:**
Agent migration phase — the variable glossary must be finalized and committed before any agent file is modified. Treat the glossary as a schema that agents must conform to.

---

### Pitfall 7: State Desynchronization Between Milestone-Local and Global State

**What goes wrong:**
In concurrent execution, each milestone has its own local `STATE.md` in `.planning/milestones/v2.0/STATE.md`. The global `STATE.md` in `.planning/STATE.md` still exists and is consulted by commands that load project state (via `cmdStateLoad` in `state.cjs`, which hardcodes `path.join(cwd, '.planning', 'STATE.md')`). A user running `/gsd:progress` sees global state. A milestone session updates its local state. The two diverge. The global state says "Phase 1 in progress" while milestone v2.0 is actually on Phase 3 and milestone v2.1 hasn't started yet.

**Why it happens:**
`cmdStateLoad` has a single hardcoded path: `path.join(cwd, '.planning', 'STATE.md')`. All state-writing commands use the same path. There is no concept of "which milestone's state am I loading?" The state system assumes a single active state file. With two concurrent milestones, each needs its own state file, but `cmdStateGet`, `cmdStatePatch`, `cmdStateAdvancePlan`, and all other state commands resolve to the single global path.

From `state.cjs` (lines 11-16): every state command begins with `path.join(cwd, '.planning', 'STATE.md')`. That is approximately 15 functions that all need milestone awareness.

**How to avoid:**
- Pass `milestone` context into state commands via a `--milestone <version>` flag, similar to how `--cwd` is already supported. The state resolver then builds `path.join(cwd, '.planning', 'milestones', milestone, 'STATE.md')` for milestone-scoped state.
- The global `STATE.md` becomes a read-only aggregate view computed from all milestone state files. It is never written by concurrent milestone sessions.
- The `init execute-phase` command resolves the correct state path based on whether the project is concurrent-mode and which milestone is active. Agent bash commands use this resolved path — never construct the state path inline.
- For old-style projects, `--milestone` is absent and the global path is used (backward-compat preserved).

**Warning signs:**
- `/gsd:progress` showing a plan number that is behind where the active milestone actually is.
- Two milestone sessions both writing to the same `STATE.md` and one overwriting the other's "current plan" counter.
- `state advance-plan` incrementing a counter that no agent actually reads, because agents resolved the milestone-local state path differently.

**Phase to address:**
State architecture phase (same phase as path architecture) — state file routing must be designed alongside path routing. Both are aspects of the same "which workspace am I in?" question.

---

### Pitfall 8: Conflict Manifest Not Enforced at Execution Time

**What goes wrong:**
Milestones declare which source files they intend to modify in a conflict manifest (`CONFLICT-MANIFEST.md`). Two milestones both declare they'll modify `get-shit-done/bin/lib/phase.cjs`. The framework records this as a conflict. But nothing actually stops either session from proceeding. The conflict manifest is advisory documentation — there is no runtime enforcement that blocks a session from writing to a file that another session has declared ownership of. Both sessions modify `phase.cjs`. The second commit wins. Changes from the first session are gone.

**Why it happens:**
Conflict manifests require an enforcement mechanism to have value. A markdown file declaring intent has no runtime effect. Without a locking system, a pre-commit hook that checks for declared conflicts, or some serialization protocol, the manifest is documentation that nobody enforces. Claude Code hooks could enforce this (PreToolUse hook on Write/Edit tool), but this requires hooks to read the manifest and cross-reference active milestone owners — significant infrastructure.

**How to avoid:**
- Enforce the conflict manifest via a Claude Code PreToolUse hook on file-write operations. The hook reads `.planning/CONFLICT-MANIFEST.md`, checks if the file being written is claimed by another active milestone, and exits with code 2 (block) if so.
- The manifest format must be machine-readable (JSON or frontmatter, not prose) so the hook can parse it reliably.
- Define an ownership protocol: milestone that starts a feature owns the files it declares until that milestone is complete. No other session can write to claimed files without a handoff process.
- If the enforcement mechanism is too complex for v2.0, explicitly scope concurrent milestones to non-overlapping files. Document this as a required constraint: "concurrent milestones must not touch the same source files." The conflict manifest then serves as a pre-flight check, not runtime enforcement.

**Warning signs:**
- Two milestones both listing the same file in their CONFLICT-MANIFEST.md without a conflict being flagged.
- git log showing the same file modified by two different milestone branches/sessions within the same day.
- Conflict manifest referenced in documentation but not in any code path that executes during plan execution.

**Phase to address:**
Conflict manifest design phase — decide whether enforcement is runtime (hooks) or pre-flight (planning check only) before designing the manifest format. Pre-flight only is simpler; runtime enforcement is safer. Choose one explicitly.

---

### Pitfall 9: Milestone-Local Phase Numbering Collisions

**What goes wrong:**
Milestone v2.0 has phases 01–05. Milestone v2.1, running concurrently, also starts from phase 01. Both sessions write `SUMMARY.md` files as `01-01-SUMMARY.md`. If phase artifacts ever end up in a shared location (e.g., during dashboard aggregation or milestone completion), the phase-01 files collide. The dashboard shows "5 plans complete for phase 1" combining counts from both milestones. `history-digest` aggregates all `SUMMARY.md` files and double-counts phase-01 artifacts.

**Why it happens:**
Phase numbering is global in the current system — there is exactly one sequence of phase directories. With milestone-scoped workspaces, phase numbering resets per milestone. Any code that aggregates phase data (history-digest, progress, roadmap-analyze) was written assuming globally unique phase numbers. It has no awareness that phase "01" in milestone v2.0 and phase "01" in milestone v2.1 are different phases.

**How to avoid:**
- All aggregation queries must be milestone-scoped. `history-digest` must accept a `--milestone` flag and only aggregate files from that milestone's workspace. Global aggregation requires explicit opt-in.
- Phase IDs in cross-milestone contexts must be fully qualified: `v2.0/phase-01` not just `phase-01`. The dashboard displays `v2.0/phase-01` and `v2.1/phase-01` as separate entries.
- SUMMARY.md frontmatter must include a `milestone` field (e.g., `milestone: v2.0`) so that aggregation tools can filter correctly.

**Warning signs:**
- `history-digest` reporting double the number of plans completed for phase-01 phases.
- Progress percentage exceeding 100% (caused by double-counting phase completions).
- MILESTONES.md entry for v2.0 listing accomplishments from v2.1 phases (frontmatter milestone field missing or ignored).

**Phase to address:**
Phase numbering and aggregation phase — update all aggregation tools to be milestone-aware before implementing concurrent milestone creation. Test with two concurrent milestones sharing the same phase numbers.

---

## Part 2: V1.0/V1.1 Pitfalls (Preserved)

These pitfalls from the quality enforcement milestone remain relevant during v2.0 execution because the refactor touches the same code paths.

---

### Pitfall 10: is_last_phase Bug Causes Premature Milestone Completion

**What goes wrong:**
`cmdPhaseComplete` determines `is_last_phase` by scanning the `.planning/phases/` filesystem directory. Unplanned future phases don't have directories, so the scan reports "no phases after current" and sets `is_last_phase = true`. Users get routed to "milestone complete" after the first phase.

**Why it happens:**
The filesystem scan is the correct query against the wrong data source. ROADMAP.md is the authoritative source of all phases (planned or not).

**How to avoid:**
Fix `cmdPhaseComplete` to parse phase numbers from ROADMAP.md. Also update `execute-plan.md`'s `offer_next` step — both locations must be fixed atomically.

**Warning signs:**
- STATE.md showing "Milestone complete" when ROADMAP.md still has unchecked phases.
- Users completing Phase 1 of a 5-phase project and seeing "milestone complete."

**Phase to address:**
Bug fix phase (earliest in roadmap) — this must be fixed before any concurrent milestone work begins.

---

### Pitfall 11: Additive Changes Breaking Existing CLI Command Output Schema

**What goes wrong:**
Modifications to `cmdPhaseComplete` or other `output()` calls change the JSON result shape. Callers in `execute-plan.md` and `transition.md` rely on fields like `is_last_phase`, `next_phase`, `next_phase_name` by convention. New fields are safe; renamed or removed fields break callers silently.

**How to avoid:**
Never rename an existing output field. Add fields freely. Capture exact JSON output in a before/after test fixture before touching any command.

**Phase to address:**
Any phase that modifies CJS lib functions. Write the before fixture first.

---

### Pitfall 12: Quality Enforcement Levels Not Wired to Config

**What goes wrong:**
Quality gate code is written with hardcoded "always check" logic. `quality_level: fast` in config has no behavioral effect.

**How to avoid:**
Every quality gate reads `quality_level` from config at its entry point. Wire config on first implementation, not as a follow-up.

**Phase to address:**
Configurable enforcement phase — behavior matrix is the first deliverable.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `.planning/phases` in new concurrent code | Faster initial implementation | Path migration debt doubles with every new file | Never — use resolver function from day one |
| Detect "concurrent project" by presence of `.planning/milestones/` directory | No new sentinel file needed | Breaks all old-style projects that have completed milestones | Never — use explicit config key sentinel |
| Shared mutable dashboard JSON without locking | Simple implementation | Silent data loss under concurrent writes | Never — choose append-only or locked writes |
| Copy-paste path construction across agent files | Fast agent editing | Parameter drift; inconsistent variable names; path bugs only caught in live execution | Never — define variable glossary first |
| Global STATE.md for all concurrent milestones | No state architecture change | State desync between global view and milestone-local reality | Never for concurrent projects — milestone state must be local |
| Advisory conflict manifest with no runtime enforcement | Simpler v1 | Concurrent sessions still corrupt shared files | Acceptable only if concurrent milestones are architecturally constrained to non-overlapping files |
| Skip config wiring in quality gates | Faster initial implementation | Gates have no enforcement levels; `fast` mode does nothing | Never — wire config at implementation time |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `gsd-tools.cjs` state commands | Calling without `--milestone` flag in concurrent projects | All state commands must receive milestone context; gsd-tools router must validate milestone flag presence for concurrent projects |
| `git commit` in concurrent sessions | Committing to same branch without pre-pull | Each milestone session must operate on a milestone-specific branch, OR shared files must be removed from concurrent writes entirely |
| `history-digest` command | Aggregating all SUMMARY.md files across all milestones | Add `--milestone` filter; global aggregation must be explicit opt-in |
| `validate health` command | Health check scanning `.planning/phases/` only | Health check must be milestone-aware and scan `.planning/milestones/*/phases/` in concurrent projects |
| `roadmap analyze` command | Reading single `ROADMAP.md` | Concurrent projects need per-milestone ROADMAP.md in each workspace; global roadmap becomes index only |
| Conflict manifest format | Human-readable prose that hooks cannot parse | Machine-readable JSON or YAML frontmatter required for any runtime enforcement |

---

## "Looks Done But Isn't" Checklist

- [ ] **Concurrent path isolation:** Create a new-style project, run two phases in two separate terminal sessions simultaneously — verify no cross-session file reads or writes occur
- [ ] **Backward compatibility:** Open an existing project that has run `milestone complete` (has `.planning/milestones/` with archived ROADMAP), run any gsd command — verify it uses old-style paths, not new-style
- [ ] **Dashboard write safety:** Trigger two simultaneous milestone status updates — verify both updates survive in the dashboard without one overwriting the other
- [ ] **Conflict manifest enforcement:** Create two milestones claiming the same source file — verify the system flags or blocks the conflict before execution begins
- [ ] **State path routing:** In a concurrent project, run `gsd-tools state get Phase` — verify it reads the milestone-local STATE.md, not the global one
- [ ] **Phase numbering in aggregation:** Create two concurrent milestones each with a phase-01 — run `history-digest` and verify it does not double-count phase-01 completions
- [ ] **Test suite integrity:** Run all 102+ existing tests after path refactor — verify zero regressions (not just the new concurrent tests)
- [ ] **Variable name consistency:** Grep all agent `.md` files for path variable names — verify all agents use the canonical names from the glossary, not invented variants
- [ ] **is_last_phase fix:** Run `gsd-tools phase complete 1` on a project with 5 phases in ROADMAP.md but only phase-01 directory on disk — verify `is_last_phase: false` and `next_phase: 2`

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Git merge conflict from concurrent commits | MEDIUM | Identify conflicting sessions; serialize them manually (one at a time); establish branch-per-milestone going forward |
| Dashboard corruption from concurrent writes | MEDIUM | Restore dashboard from last clean git commit; fix write strategy before re-enabling concurrent sessions |
| Incomplete path migration (some files still old-style) | HIGH | Run comprehensive grep inventory of all path references; create tracking issue per file; migrate remaining files systematically |
| Old-style project broken by faulty compat detection | LOW | Add explicit sentinel key to project's `config.json`; verify detection function routes correctly |
| Test scaffold out of sync with new project layout | LOW | Update `createConcurrentProject()` helper; do not touch `createTempProject()` |
| State desynchronization between global and local | MEDIUM | Manually reconcile milestone-local STATE.md from git history; fix state routing before restarting sessions |
| Phase numbering collision in aggregation | LOW | Add `milestone` frontmatter field to affected SUMMARY.md files; fix aggregation filter |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Git merge conflicts | Workspace isolation design | Two simultaneous `git commit` runs confirm conflict detection works |
| Dashboard write corruption | Dashboard implementation | Concurrent write test — both updates survive |
| Incomplete path migration | Path architecture phase (resolver function first) | All 102+ tests pass; `grep -rn "\.planning/phases"` in workflows returns 0 after migration |
| Backward compat layer false detection | Compatibility layer phase | Test with old-style project that has completed milestones |
| Test suite breakage | Test architecture phase (extend helpers first) | Full test suite green after each batch of changes |
| Agent prompt drift | Agent migration phase | Variable glossary compliance check; at least one full workflow execution in both modes |
| State desynchronization | State architecture phase | `/gsd:progress` in concurrent project shows correct milestone-local state |
| Unenforced conflict manifest | Conflict manifest design phase | Two milestones claiming same file triggers a flag or block |
| Phase numbering collisions | Aggregation tools phase | `history-digest` with two concurrent milestones sharing phase numbers shows correct per-milestone counts |
| is_last_phase bug | Bug fix phase (first in roadmap) | `phase complete 1` on 5-phase project returns `is_last_phase: false` |

---

## Sources

- First-party codebase analysis: `get-shit-done/bin/lib/state.cjs` — 15+ state functions all hardcode `.planning/STATE.md` path, zero milestone awareness
- First-party codebase analysis: `get-shit-done/bin/lib/core.cjs` — `findPhaseInternal` hardcodes `.planning/phases` and `.planning/milestones` (archive only) patterns
- First-party codebase analysis: `get-shit-done/bin/lib/milestone.cjs` — `cmdMilestoneComplete` creates `.planning/milestones/` directory, confirming old-style projects already have this directory
- First-party codebase analysis: path reference counts — 94 in workflow `.md` files, 83 in agent `.md` files, 67 in `lib/*.cjs`, 30 in `tests/*.cjs`
- First-party codebase analysis: `tests/helpers.cjs` — single `createTempProject()` helper shared by all 102+ tests, hardcodes `.planning/phases/` scaffold
- Domain knowledge: Node.js `fs.writeFileSync` non-atomicity under concurrent writes on macOS (documented behavior, no file lock = race window)
- Project context: `.planning/PROJECT.md` v2.0 milestone target features — milestone-scoped workspace isolation, central lock-free dashboard, conflict manifest

---
*Pitfalls research for: Concurrent milestone execution and workspace isolation (GSD Enhanced Fork v2.0)*
*Researched: 2026-02-24*
