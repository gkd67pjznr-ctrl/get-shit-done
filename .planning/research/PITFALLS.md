# Pitfalls Research

**Domain:** Tech debt tracking system, project migration tool, and debugger-driven fix workflows — GSD Enhanced Fork (v3.0)
**Researched:** 2026-02-25
**Confidence:** HIGH (first-party codebase analysis; established patterns from v1.0/v2.0 research; risk areas derived from direct code inspection of gsd-tools.cjs, state.cjs, core.cjs, config.cjs, milestone.cjs, and existing workflow .md files)

---

## Part 1: Concurrent Writes to DEBT.md

The single highest-risk area for this milestone. DEBT.md is a shared hub written by multiple agents (executor subagents, verifier subagents, potentially the /gsd:fix-debt skill) within the same project, and may also be written across concurrent milestone sessions.

---

### Pitfall 1: Read-Modify-Write Race Condition on DEBT.md

**What goes wrong:**
Two executor subagents running in the same wave both log debt during their plan execution. Both call `gsd-tools debt log ...`. Both read DEBT.md, append an entry in memory, then write back. The second write silently overwrites the first. One debt entry is lost with no error and no trace.

**Why it happens:**
Every file mutation in this codebase follows a read-modify-write pattern: `fs.readFileSync` → modify string → `fs.writeFileSync`. This is safe when only one writer exists. It is unsafe when two writers run concurrently, which is exactly what happens in wave-based parallel plan execution (execute-phase.md spawns multiple executors per wave, all potentially logging debt simultaneously).

This is not theoretical. From `execute-phase.md`, parallel waves spawn multiple `gsd-executor` subagents concurrently. Each subagent can call gsd-tools commands. If the debt log command uses read-modify-write on DEBT.md, race conditions occur in every wave with 2+ plans.

**How to avoid:**
The `debt log` command must use **append-only writes**, not read-modify-write. Specifically:
- Use `fs.appendFileSync(debtPath, newEntry + '\n', 'utf-8')` for adding new entries. This is atomic at the OS level for small writes on Unix/macOS — the kernel serializes concurrent appends to the same file descriptor.
- Structure DEBT.md so that entries are delimited, self-contained blocks (e.g., `---` separators). Never require reading the existing content to write a new entry.
- Alternatively, write each debt entry as a separate file in a `.planning/debt/` directory (e.g., `debt-{timestamp}-{pid}.md`), and aggregate them into DEBT.md on demand. This is the cleanest concurrent-safe pattern — no two processes ever write the same file.

The existing atomicWrite pattern in STACK.md (write-to-temp then rename) does NOT help here — it only serializes single writers to the same file. For concurrent multi-writer scenarios, append-only is the correct primitive.

**Warning signs:**
- DEBT.md entry count is less than the number of debt log calls observed in agent output.
- Running two simultaneous `gsd-tools debt log` processes and checking that both entries appear — if only one does, the race condition is live.
- DEBT.md corrupted (truncated mid-entry) — indicates byte-level interleave from concurrent writes.

**Phase to address:**
DEBT.md design phase (first deliverable) — the file format and write strategy must be specified before implementing the `debt log` command. "Append-only" vs "separate files + aggregation" must be chosen explicitly.

---

### Pitfall 2: Executor Quality Gate Bypass During Debt Logging

**What goes wrong:**
The executor already has mandatory quality gates (Quality Sentinel, test requirement, Context7 lookup) managed by the existing framework. The debt logging hook is added as an afterthought: a bash command at the end of a task. An agent under context pressure or approaching its output limit skips the debt log call ("I've marked the task complete, continuing..."). Debt that was discovered during execution never reaches DEBT.md. The whole tracking system silently produces incomplete data.

**Why it happens:**
The existing quality gate mechanism (in `execute-plan.md`) is a prose instruction enforced through agent guidelines. The debt log, if implemented as another prose instruction ("after each task, call `gsd-tools debt log`"), has the same enforcement problem. Context-pressured agents deprioritize trailing steps. There is no post-hoc verification that debt logging occurred for a given task.

**How to avoid:**
Treat debt logging as a SUMMARY.md field, not as a separate bash command during execution:
- Add an optional `tech_debt` array to the SUMMARY.md frontmatter schema. The executor populates it inline when writing the SUMMARY — it cannot skip the SUMMARY write (it is verified by the orchestrator's spot-check).
- `gsd-tools debt log` reads SUMMARY.md files and aggregates their `tech_debt` fields into DEBT.md as a post-wave operation, not an in-task operation. This decouples debt capture from agent execution timing.
- This approach also means debt logging failures (DEBT.md write error) never block task completion — they are a post-processing step that can be retried.

**Warning signs:**
- DEBT.md has far fewer entries than there are TODOs or "deferred" comments in committed code.
- Agent summaries reference technical compromises ("used setTimeout instead of proper event", "hardcoded for now") but DEBT.md has no corresponding entries.
- Debt log calls appearing inconsistently — present in some plan summaries, absent in others with no pattern.

**Phase to address:**
Executor wiring phase — the integration point must be decided (SUMMARY.md field vs. inline bash) before writing the executor wiring. Changing the approach after implementation requires updating every executor agent and test that references the debt log step.

---

### Pitfall 3: DEBT.md Not Milestone-Scoped

**What goes wrong:**
The project uses concurrent milestones (v3.0 and future milestones run in parallel). Each milestone's executor and verifier agents log debt to `.planning/DEBT.md`. Two concurrent milestone sessions both append to the same DEBT.md. The file becomes an unattributed mix of debt from both milestones. When `/gsd:fix-debt` runs, it cannot determine which entries belong to the current milestone. The debugger agent reads DEBT.md and gets overwhelmed with entries from unrelated milestones.

**Why it happens:**
DEBT.md is conceived as a central hub. But the existing GSD state architecture distinguishes between global files (config.json, PROJECT.md) and milestone-local files (STATE.md, ROADMAP.md). DEBT.md needs a placement decision: global (all milestones contribute) or milestone-local (each milestone has its own). Without this decision made explicitly, implementations default to global, creating the mixing problem.

**How to avoid:**
Make DEBT.md milestone-local: place it at `planningRoot(cwd, milestoneScope)/DEBT.md`. This is consistent with how STATE.md and ROADMAP.md are placed. The `gsd-tools debt` command must accept the `--milestone` flag, just like all other milestone-aware commands.

For legacy (non-concurrent) projects, DEBT.md lives at `.planning/DEBT.md` — backward-compatible.

For users who want a cross-milestone view, implement `gsd-tools debt aggregate` that reads all milestone DEBT.md files and merges them into a single report. Do not try to maintain a real-time central file.

**Warning signs:**
- DEBT.md entries referencing code files from different milestones with no attribution.
- The `debt log` command not accepting a `--milestone` flag when every other state-writing command does.
- `/gsd:fix-debt` loaded with entries that are already resolved (from a completed milestone's DEBT.md).

**Phase to address:**
DEBT.md design phase — decide placement (global vs. milestone-local) before any code. Adding milestone scoping after the fact requires updating every caller and existing DEBT.md files.

---

## Part 2: Migration Tool Data Safety

The migration tool is the highest-risk feature in this milestone from a data loss perspective. It reorganizes `.planning/` directories that contain the entire project's history and context.

---

### Pitfall 4: Migration Tool Assumes a Specific Existing Layout

**What goes wrong:**
The migration tool is designed against the current canonical `.planning/` structure. Real projects have diverse layouts: phases with unconventional numbering (`2A-refactor/`), extra files in root `.planning/` (`DECISIONS.md`, `TO-DOS.md`), nested phase sub-directories, phases that exist on disk but not in ROADMAP.md, or vice versa. The migration tool moves what it recognizes and silently ignores what it doesn't. A `DECISIONS.md` file that doesn't match any recognized pattern stays in place, but its path reference in STATE.md now points to a moved directory. The project context breaks without any error message.

**Why it happens:**
Migration tools are typically written against the schema the developer knows — the current canonical structure. The diversity of real-world projects is discovered only during testing or, worse, during user reports post-release. The existing GSD codebase does handle legacy variation (`detectLayoutStyle` handles 3 states, `findPhaseInternal` searches both current and archived phases), but a migration tool that moves files has irreversible consequences when it encounters unexpected inputs.

**How to avoid:**
- Migration tool must run in **dry-run mode by default**. `gsd-tools migrate` outputs what it _would_ do without making any changes. `gsd-tools migrate --apply` performs the actual migration. This is a hard requirement — no migration tool should apply changes without an explicit opt-in.
- Before any operation, the tool must inventory everything in `.planning/` and report files it does not recognize. Unrecognized files get a `-- UNRECOGNIZED --` tag in dry-run output. The human decides what to do with them before applying.
- Migration is non-destructive: move files, never delete. If anything goes wrong, the user can reverse by moving files back. The tool should produce an undo manifest: a JSON file listing every move performed (`from → to`) so recovery is mechanical.
- Validate the destination before migrating source. If a target path already exists, abort with a clear error — do not overwrite.

**Warning signs:**
- Migration tool documentation that only shows "happy path" input without discussing what happens with unexpected files.
- No `--dry-run` flag in the implementation.
- Missing inverse operation or undo mechanism.
- Tests that only use `createTempProject()` scaffolds — these are clean-room layouts, not realistic messy projects.

**Phase to address:**
Migration tool implementation phase — dry-run must be implemented before apply. The undo manifest must be part of the same phase, not deferred.

---

### Pitfall 5: Migration Breaks References Held in Markdown Files

**What goes wrong:**
After migration, a phase directory moves from `.planning/phases/01-setup/` to `.planning/milestones/v3.0/phases/01-setup/`. STATE.md references `**Current Phase:** .planning/phases/01-setup`. ROADMAP.md references the old path in its phase status table. Agent history in `.planning/agent-history.json` references old paths. None of these are updated by the migration tool because they are treated as content (not structure). The project appears healthy on disk, but all path-dependent commands (find-phase, verify-phase-completeness) resolve to the wrong locations.

**Why it happens:**
Migration tools in file-based systems have two layers: structural changes (move directories/files) and reference updates (fix all mentions of moved paths). Structural changes are visible and testable. Reference updates require scanning all content for path strings and updating them — this is fragile because paths appear in many formats (absolute, relative, shell variables, markdown prose) and a regex sweep misses some.

**How to avoid:**
- The migration tool must scan all `.md` and `.json` files in `.planning/` for references to moved paths and update them. This scan must be comprehensive — not just STATE.md and ROADMAP.md but also SUMMARY.md files, PLAN.md files, and agent-history.json.
- Produce a reference update report: which files were modified, which references were updated. If any reference could not be automatically updated (e.g., embedded in a JSON string that would require JSON-aware rewriting), report it for manual review.
- After migration, run `gsd-tools validate health` automatically. If health check reports errors related to paths, surface them immediately before the user assumes migration is complete.
- Implement migration in two atomic commits: (1) structural changes, (2) reference updates. If reference updates fail, the structural changes are still valid (they can be undone independently).

**Warning signs:**
- Migration test passes but `gsd-tools find-phase 1` fails after migration.
- `gsd-tools validate health` reports W006 (phase in ROADMAP but no directory) or W007 (directory but not in ROADMAP) after migration.
- STATE.md path fields still pointing to pre-migration locations.

**Phase to address:**
Migration tool implementation phase — reference updating must be included in the same phase as structural migration. Deferred reference updating creates broken intermediate states that users may try to use.

---

### Pitfall 6: Migration Fails Silently on Partial Apply

**What goes wrong:**
The migration tool moves 8 of 12 phase directories successfully. On the 9th, it encounters a permission error or a naming collision. It prints an error and exits. The project is now in a partially-migrated state: some phases in the new location, some in the old. Neither the old nor the new layout is valid. Commands that search the old location find nothing; commands that search the new location find only some phases. The user sees inconsistent results with no clear recovery path.

**Why it happens:**
Node.js `fs.renameSync` is not transactional. There is no rollback mechanism built into the OS for multi-file operations. A migration that applies changes one-by-one has no atomicity guarantee.

**How to avoid:**
- Migration must be all-or-nothing at the application level: validate all preconditions (target paths don't exist, source paths are readable/writable, enough disk space) before moving any files. The validate phase is a separate pass with no side effects.
- Write the undo manifest before performing any moves. If a move fails mid-sequence, the undo manifest allows automated recovery by reversing all completed moves.
- After any error, the tool must print: "Migration failed after N of M operations. Run: `gsd-tools migrate --undo` to restore original layout."
- The `--undo` command reads the undo manifest and reverses all moves in reverse order.

**Warning signs:**
- Migration tool that calls `fs.renameSync` in a loop with no try-catch per operation.
- No undo manifest generated before apply.
- Error message that says "migration failed" without specifying which files were already moved.

**Phase to address:**
Migration tool implementation phase — undo mechanism must be part of the same implementation, not a v3.1 follow-up.

---

## Part 3: Agent Wiring Pitfalls

Adding hooks into existing agents (executor, verifier) without disrupting their established quality gate flow.

---

### Pitfall 7: Wiring Debt Hooks into Executor Changes Existing JSON Output Schema

**What goes wrong:**
The debt logging hook is added to `gsd-tools init execute-phase` output — a new `debt_path` field pointing to DEBT.md. Executor subagents, which receive this init JSON, now need to handle the new field. But the existing `execute-plan.md` workflow parses specific fields from the init JSON and ignores unknown ones. The new field is silently available but never used, because no one updated the agent instruction to actually call `gsd-tools debt log` using it. Alternatively, the new field inadvertently conflicts with an existing field name, and the executor misroutes.

**Why it happens:**
The init command outputs are the API contract between gsd-tools and agent workflows. Adding fields to the API is safe (callers ignore unknown fields). But adding behavior that requires agents to use new fields is a two-part change: update the init output AND update the agent instruction. These two parts frequently get out of sync because they live in different files: `init.cjs` vs. `execute-plan.md`. One part gets reviewed and committed; the other gets missed.

**How to avoid:**
- Treat init output changes and agent instruction changes as an atomic unit. They must be in the same commit or the same plan. Never ship an init field that no agent uses.
- Add a test that verifies the new field appears in init output AND that a reference to it appears in the agent instruction markdown. A grep-based test in the CI suite: `grep -q "debt_path" workflows/execute-plan.md` after adding `debt_path` to init output.
- From PROJECT.md: "All changes must be additive — existing GSD behavior preserved, new quality gates layered on top." New init fields are additive. Agent instructions that replace existing steps are not.

**Warning signs:**
- `gsd-tools init execute-phase` returning a `debt_path` field that is never referenced in `execute-plan.md`.
- A git diff that touches `init.cjs` but not `execute-plan.md` (or vice versa) for a debt-related change.
- Agent test stubs that mock `init execute-phase` output without the new `debt_path` field, causing agent instructions that reference it to fail silently.

**Phase to address:**
Executor wiring phase — init output change and agent instruction change must ship together as one deliverable.

---

### Pitfall 8: Verifier Wiring Adds a New Failure Mode to Phase Completion

**What goes wrong:**
The verifier is wired to call `gsd-tools debt log` for issues it discovers. This adds a file-write step to the verification workflow. If DEBT.md does not exist yet (fresh project, migration not run), the debt log call fails with "DEBT.md not found". The verifier, which previously always produced a VERIFICATION.md, now fails at the debt logging step. Phase verification silently breaks for new projects because DEBT.md hasn't been initialized.

**Why it happens:**
The verifier is a critical path component — a failure in verification blocks the entire phase completion gate. Adding a non-optional side effect (debt file write) to the verifier introduces a new failure mode that didn't exist before. The existing pattern is that the verifier writes only to VERIFICATION.md, which the orchestrator creates as a precondition. DEBT.md is a new precondition that the orchestrator doesn't create.

**How to avoid:**
- The debt log command must be **silent on missing DEBT.md**: if DEBT.md does not exist, create it (or skip gracefully). Never exit with a non-zero code because the debt hub doesn't exist yet.
- DEBT.md initialization must happen at project creation time (in `config-ensure-section` or `new-project` workflow), just as STATE.md and ROADMAP.md are initialized. A project without DEBT.md should never be an error state.
- The verifier's debt logging step must be wrapped: if it fails, log a warning to stderr but exit 0. Debt logging is observability infrastructure — it must never block the primary workflow.
- Test case: run verification on a fresh project with no DEBT.md → verify that VERIFICATION.md is created and the workflow completes successfully.

**Warning signs:**
- Verifier workflow that calls `gsd-tools debt log` without checking whether DEBT.md exists first.
- `gsd-tools debt log` returning non-zero exit code when DEBT.md is missing.
- No test case for "verification on project without DEBT.md".

**Phase to address:**
Verifier wiring phase — the graceful-degradation behavior (create DEBT.md if missing, never fail on debt logging errors) must be verified before wiring goes live.

---

### Pitfall 9: /gsd:fix-debt Skill Bypasses the Debugger Agent's Established Investigation Flow

**What goes wrong:**
The `/gsd:fix-debt` skill is implemented as a new workflow that reads DEBT.md, selects an entry, and directly applies a fix. But the existing debugger agent (`diagnose-issues.md`) has an established investigation flow: parse UAT gaps → spawn debug agents → collect root causes → update UAT → hand off to plan-phase --gaps. The fix-debt skill bypasses this flow and applies fixes without diagnosis. The fix addresses a symptom (the logged debt item), not the root cause. The fix passes tests but the underlying issue recurs in the next milestone.

**Why it happens:**
The debt entry logged by the executor ("used setTimeout workaround — real fix requires refactoring event system") contains the symptom and the surface fix, but not the root cause analysis. The executor was not a debugger — it was executing a plan and noted a compromise. Treating this debt entry as a complete fix specification leads to shallow fixes.

**How to avoid:**
- `/gsd:fix-debt` must invoke the existing `diagnose-issues.md` debugger agent for any debt entry that doesn't already have `root_cause` populated. Wiring the skill to consume the debugger is the stated milestone requirement — "wiring it to consume DEBT.md, not rewriting it."
- The DEBT.md entry schema must include a `status` field: `open` (logged, not yet diagnosed), `diagnosed` (root cause found, awaiting fix), `fixed` (patch applied and verified). The fix-debt skill operates only on `diagnosed` entries.
- The fix-debt skill workflow: read DEBT.md → filter `diagnosed` entries → select entry → pass root_cause to plan-phase --gaps → execute → verify → mark `fixed`. This reuses the existing plan-phase and verification machinery rather than bypassing it.

**Warning signs:**
- `/gsd:fix-debt` skill that applies a fix without first checking `root_cause` in the DEBT.md entry.
- A skill implementation that creates inline fix steps rather than delegating to `plan-phase --gaps`.
- DEBT.md entries marked `fixed` but the same pattern recurring in subsequent phases.

**Phase to address:**
/gsd:fix-debt implementation phase — the skill must explicitly wire to the debugger agent, not implement its own diagnosis logic.

---

### Pitfall 10: Hardcoded DEBT.md Path in New CLI Commands

**What goes wrong:**
The new `gsd-tools debt` command family hardcodes `.planning/DEBT.md` as the debt hub path, using `path.join(cwd, '.planning', 'DEBT.md')`. The INTEGRATION-4 bug (already in TO-DOS.md) demonstrates this exact pattern: both `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` hardcode `.planning/ROADMAP.md`. When the `--milestone` flag is passed, it is silently dropped. The debt commands will ship with the same defect if not explicitly guarded against.

**Why it happens:**
Hardcoding `.planning/...` is the path of least resistance in this codebase. It's the established pattern from before `planningRoot()` existed. New code tends to follow the visible examples in the file, and most existing functions in `state.cjs`, `roadmap.cjs`, and `milestone.cjs` use the hardcoded style. The `planningRoot()` function exists but is not yet universally adopted — new code written without an explicit reminder defaults to the old pattern.

**How to avoid:**
- All new `gsd-tools debt` subcommands must use `planningRoot(cwd, milestoneScope)` for path construction. Zero exceptions.
- Add a linter rule or test that greps `bin/lib/*.cjs` for raw `'.planning/DEBT'` string literals and fails if found outside of tests. This catches accidental hardcodes during review.
- The CLI router must pass `milestoneScope` to all debt commands, just as it passes it to `init` commands and state commands. Review the router implementation for the `debt` case before shipping.
- Fix INTEGRATION-3 and INTEGRATION-4 in the same milestone (already on the TODO list). These known gaps create confusion and set a bad precedent — new `debt` commands will pattern-match against the still-broken roadmap and init-plan-phase commands.

**Warning signs:**
- `gsd-tools debt log --milestone v3.0` writing to `.planning/DEBT.md` instead of `.planning/milestones/v3.0/DEBT.md`.
- Grep of `bin/lib/*.cjs` for `'\.planning\/DEBT'` returning any matches in new code.
- The `debt` CLI router case not extracting `milestoneScope` before calling debt subcommands.

**Phase to address:**
DEBT.md CLI implementation phase — planningRoot() usage must be part of the implementation requirement, not a follow-up fix. Treat it as a code review gate: no `debt` subcommand is accepted without planningRoot() usage.

---

## Part 4: Integration-Specific Pitfalls

Wiring the new features into the existing system without breaking established behavior.

---

### Pitfall 11: INTEGRATION-3 and INTEGRATION-4 Fixes Break Callers

**What goes wrong:**
INTEGRATION-3 and INTEGRATION-4 are known hardcoded path bugs in `init.cjs` and `roadmap.cjs`. Fixing them changes function signatures: `cmdRoadmapGetPhase(cwd, phaseNum, raw)` becomes `cmdRoadmapGetPhase(cwd, phaseNum, raw, milestoneScope)`. Callers in `gsd-tools.cjs` (the CLI router) and any tests that call these functions directly must also be updated. A fix that updates the function signature but not all callers causes runtime errors (the function receives 3 args, assumes 4, reads `undefined` for milestoneScope, silently falls back to global paths — the bug appears "fixed" but actually defaults to old behavior).

**Why it happens:**
JavaScript CJS modules have no compile-time arity checking. Passing fewer arguments than expected is not an error — the missing parameter is `undefined`. Code that falls back on `undefined` (like `planningRoot(cwd, undefined)`, which returns the global `.planning/` path) appears to work but silently loses milestone scope.

**How to avoid:**
- When fixing INTEGRATION-3/4, update callers in the same commit as the function signature change. The change is: function + all callers + tests that call the function directly. Zero orphaned callers.
- Add a test fixture for the INTEGRATION-3 fix: call `cmdInitPlanPhase` with a milestone scope and assert that the returned paths include the milestone directory. Failing this test with the old code proves the bug; passing it with the fix proves the correction.
- Grep for all call sites before changing the signature: `grep -rn "cmdRoadmapGetPhase\|cmdRoadmapAnalyze\|cmdInitPlanPhase" --include="*.cjs"` — every match must be reviewed and updated.

**Warning signs:**
- A fix that only appears in `roadmap.cjs` or `init.cjs` but not in `gsd-tools.cjs` (the CLI router).
- Tests for the fixed function that pass because they do not provide a milestone scope (thus testing the fallback, not the fix).
- `gsd-tools roadmap get-phase 1 --milestone v3.0` still reading `.planning/ROADMAP.md` after the fix.

**Phase to address:**
Integration fix phase (same as INTEGRATION-3/4 resolution) — function + callers + tests as a single atomic delivery.

---

### Pitfall 12: /gsd:fix-debt Skill Conflicts with Existing Plan State

**What goes wrong:**
The `/gsd:fix-debt` skill is invoked while a milestone is in the middle of executing Phase 4. The skill reads DEBT.md, finds an entry from Phase 2, and spawns plan-phase --gaps to fix it. plan-phase --gaps creates a new plan in Phase 4's directory (or a decimal phase like 4.1). This plan appears in the phase index. When the ongoing Phase 4 execution resumes, it discovers unexpected plan files. The wave grouping logic in execute-phase produces an inconsistent plan index. The executor tries to execute the gap-closure plan without proper context.

**Why it happens:**
The `/gsd:fix-debt` skill creates new plans as a side effect. If it runs mid-phase, it mutates the phase plan index while the orchestrator has already computed the plan grouping. The existing `phase-plan-index` command reads all PLAN.md files at call time — if new files appear after the index is computed, they are invisible to the current execution but visible to the next invocation.

**How to avoid:**
- `/gsd:fix-debt` must be a standalone invocation, not safe to run concurrently with an active `execute-phase` workflow. Document this constraint prominently.
- The skill should check whether a phase execution is in-progress by reading STATE.md: if `Status` is "executing" or "Ready to execute", warn the user and ask for confirmation before creating new plans.
- Alternatively, fix-debt always creates plans in a dedicated debt-fix phase (`gsd-tools phase add "debt-fixes"`) rather than injecting into an existing phase. This isolates debt-fix plans from the normal phase execution flow.

**Warning signs:**
- The skill creating PLAN.md files in the currently-active phase directory without checking STATE.md status.
- No check for active execution before spawning plan-phase --gaps.
- Users reporting that "extra plans appeared during phase execution" after using /gsd:fix-debt.

**Phase to address:**
/gsd:fix-debt implementation phase — the isolation strategy (dedicated phase vs. decimal phase injection) must be decided before implementation. Document the decision in PROJECT.md.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `.planning/DEBT.md` in debt commands | Faster initial implementation | Repeats INTEGRATION-3/4 pattern; breaks concurrent milestone users immediately | Never — use planningRoot() from day one |
| Inline debt log as a bash one-liner in executor | No new CLI command needed | Agents skip it under context pressure; no enforcement; no structured schema | Never — structured CLI command with SUMMARY.md integration is the correct pattern |
| Single DEBT.md at global `.planning/` root | Simpler architecture | Mixes debt from all milestones; concurrent milestone users get confused entries | Only if the project explicitly prohibits concurrent milestones (not the case here) |
| Migration tool without dry-run | Faster to implement | First user who runs it on a real project with unexpected layout loses data | Never — dry-run is mandatory for any tool that moves or renames files |
| Migration without undo manifest | Simpler implementation | Partial failures leave projects in broken intermediate state with no recovery | Never — undo manifest costs ~30 lines and prevents catastrophic data loss |
| /gsd:fix-debt applying fixes directly without diagnosis | Faster fix cycle | Treats symptoms not causes; same debt recurs; users lose trust in the system | Never for code debt — always diagnose first. Acceptable only for trivial formatting/comment cleanup |
| Wrapping debt log errors as fatal in verifier | Cleaner error handling | New failure mode in critical path; verification fails for missing DEBT.md | Never — debt logging in verifier must be non-fatal (silent warning, not blocking error) |

---

## Integration Gotchas

Common mistakes when connecting these features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `gsd-tools debt log` | Writing DEBT.md path without `--milestone` flag support | All debt commands must accept `--milestone` and resolve via `planningRoot()` |
| Executor wiring | Adding debt log as a standalone bash step in execute-plan.md | Integrate as a SUMMARY.md `tech_debt` field; aggregate post-wave, not per-task |
| Verifier wiring | Making debt log a required step that exits non-zero on failure | Wrap in try-catch; log warning to stderr; always exit 0 from debt log side effect |
| Migration tool | Running structural moves before validating all preconditions | Full validation pass first (dry-run output), then apply only after user confirmation |
| /gsd:fix-debt | Spawning plan-phase without checking STATE.md for active execution | Read STATE.md status before any plan creation; warn if phase is mid-execution |
| INTEGRATION-3 fix | Updating `cmdInitPlanPhase` signature but not the CLI router call | Fix function + CLI router + tests in one atomic commit |
| INTEGRATION-4 fix | Updating `cmdRoadmapGetPhase` signature but not `cmdRoadmapAnalyze` | Both functions in roadmap.cjs must be fixed together; they share the same hardcode pattern |
| DEBT.md schema | Storing entries as freeform markdown prose | Use structured frontmatter or delimited YAML blocks so CLI tools can parse and filter entries |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Debt log concurrency:** Run two simultaneous `gsd-tools debt log` processes on the same DEBT.md — verify both entries survive and neither is lost or corrupted
- [ ] **Milestone scope on debt commands:** Run `gsd-tools debt log --milestone v3.0 ...` — verify entry appears in `.planning/milestones/v3.0/DEBT.md`, not `.planning/DEBT.md`
- [ ] **Verifier graceful degradation:** Run verify-phase on a project with no DEBT.md — verify VERIFICATION.md is created and workflow completes successfully (no debt-related error)
- [ ] **Migration dry-run:** Run `gsd-tools migrate` (no --apply) on a project with extra files — verify it outputs a plan and flags unrecognized files without making any changes
- [ ] **Migration undo:** Run migration --apply, then `gsd-tools migrate --undo` — verify original layout is fully restored
- [ ] **Migration with references:** After migration, run `gsd-tools find-phase 1` — verify it resolves to the new path, not the old one
- [ ] **INTEGRATION-3 fix verification:** Run `gsd-tools init plan-phase 1 --milestone v3.0` — verify `state_path` and `roadmap_path` in output include the milestone directory
- [ ] **INTEGRATION-4 fix verification:** Run `gsd-tools roadmap get-phase 1 --milestone v3.0` — verify it reads `.planning/milestones/v3.0/ROADMAP.md`, not `.planning/ROADMAP.md`
- [ ] **fix-debt isolation:** Invoke `/gsd:fix-debt` while STATE.md shows Status=executing — verify it warns the user and does not create plans in the active phase
- [ ] **Debugger wiring:** Run `/gsd:fix-debt` on a DEBT.md entry with `status: open` (no root_cause) — verify it routes to the debugger agent rather than attempting a direct fix

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Concurrent DEBT.md writes lost entries | LOW | Re-run the phase or re-examine plan summaries; extract debt items from SUMMARY.md `tech_debt` fields and re-log manually |
| Executor skipped debt log (context pressure) | LOW | Read phase SUMMARY.md files for `tech_debt` fields; run `gsd-tools debt aggregate` to backfill DEBT.md from summaries |
| DEBT.md not milestone-scoped (mixed entries) | MEDIUM | Split DEBT.md by milestone attribution field; move entries to correct milestone locations; update all callers |
| Migration partial failure | MEDIUM | Run `gsd-tools migrate --undo` (if undo manifest exists); if not, restore from git using `git checkout HEAD -- .planning/` |
| Migration breaks path references | MEDIUM | Run `gsd-tools validate health --repair` for auto-fixable issues; manually update remaining references using the reference update report |
| Verifier fails due to missing DEBT.md | LOW | Run `gsd-tools config-ensure-section` to create DEBT.md; or manually create it; then re-run verification |
| /gsd:fix-debt creates plans mid-phase execution | MEDIUM | Remove the spurious PLAN.md files created by fix-debt; re-run `gsd-tools phase-plan-index` to confirm clean state; re-run the phase from the interrupted point |
| INTEGRATION-3/4 fix breaks existing callers | LOW | Grep for affected call sites; update each to pass milestoneScope; run test suite to confirm green |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Concurrent DEBT.md write race | DEBT.md design phase | Concurrent write test: two simultaneous `debt log` processes, both entries survive |
| Executor skipping debt log | Executor wiring phase | SUMMARY.md frontmatter includes `tech_debt` field; verified in plan output spot-check |
| DEBT.md not milestone-scoped | DEBT.md design phase | `debt log --milestone v3.0` writes to milestone-local path |
| Migration layout assumption errors | Migration design phase (dry-run first) | Test with diverse real-world `.planning/` layouts including extra files |
| Migration breaks path references | Migration implementation phase | Post-migration `gsd-tools validate health` returns healthy |
| Migration partial failure | Migration implementation phase | Migration --apply followed by --undo restores exact original state |
| Debt wiring changes init output schema | Executor wiring phase | Init output field + agent instruction change in same commit |
| Verifier new failure mode | Verifier wiring phase | Verification on project without DEBT.md completes without error |
| /gsd:fix-debt bypasses debugger | fix-debt implementation phase | fix-debt on `status: open` entry routes to debugger, not direct fix |
| Hardcoded DEBT.md path | DEBT.md CLI implementation phase | Grep `bin/lib/*.cjs` for raw `.planning/DEBT` — zero matches |
| INTEGRATION-3/4 fix breaks callers | Integration fix phase | All callers updated in same commit; test suite green after fix |
| fix-debt conflicts with active execution | fix-debt implementation phase | Invoke during active phase; user is warned before any plans are created |

---

## Sources

- First-party codebase analysis: `get-shit-done/bin/lib/state.cjs` — read-modify-write pattern used in all 15+ state mutation functions; confirms race condition risk for any shared file written by concurrent agents
- First-party codebase analysis: `get-shit-done/bin/lib/roadmap.cjs` lines 9-10 — hardcoded `.planning/ROADMAP.md` path in `cmdRoadmapGetPhase`; confirms INTEGRATION-4 pattern risk for new `debt` commands
- First-party codebase analysis: `get-shit-done/bin/lib/init.cjs` lines 138-140 — hardcoded paths in `cmdInitPlanPhase`; confirms INTEGRATION-3 pattern
- First-party codebase analysis: `get-shit-done/workflows/execute-phase.md` — parallel wave execution spawns multiple `gsd-executor` agents concurrently within a single wave; confirms multi-writer scenario for debt logging
- First-party codebase analysis: `get-shit-done/workflows/diagnose-issues.md` — existing debugger flow is parse gaps → spawn agents → collect root causes → update UAT → hand off to plan-phase --gaps; wiring fix-debt must follow this flow, not bypass it
- First-party codebase analysis: `get-shit-done/bin/lib/core.cjs` — `planningRoot()` and `detectLayoutStyle()` functions exist and are tested; new debt commands must use these, not invent parallel path logic
- First-party codebase analysis: `get-shit-done/bin/lib/config.cjs` — `cmdConfigEnsureSection` demonstrates the correct pattern for auto-migrating existing configs (read → check fields → add missing → write); migration tool should follow this additive pattern
- Project context: `.planning/PROJECT.md` v3.0 milestone target features — central DEBT.md hub, CLI debt logging command, executor/verifier wiring, /gsd:fix-debt skill, project migration tool, INTEGRATION-3/4 fixes
- Project context: `.planning/TO-DOS.md` — INTEGRATION-3 and INTEGRATION-4 gaps documented with exact file locations and fix approach
- Domain knowledge: Node.js `fs.appendFileSync` atomic behavior for small appends on Unix/macOS (kernel serializes concurrent appends; documented Node.js behavior)
- Domain knowledge: File migration tooling best practices — dry-run mode, undo manifests, precondition validation before apply (established pattern across all serious file-migration tools: rsync --dry-run, git mv, database migration frameworks)
- Prior pitfalls research: `.planning/research/PITFALLS.md` (v2.0 section) — patterns for hardcoded path pitfalls, backward compatibility detection, and concurrent write risks; v3.0 pitfalls extend these established patterns

---
*Pitfalls research for: GSD v3.0 — Tech debt tracking, project migration, and fix-debt skill*
*Researched: 2026-02-25*
