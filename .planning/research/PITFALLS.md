# Pitfalls Research

**Domain:** AI coding agent framework quality enforcement layer
**Researched:** 2026-02-23
**Confidence:** HIGH (first-party codebase analysis + known bug confirmation)

---

## Critical Pitfalls

### Pitfall 1: Quality Gates Exhausting Context Budget Before Execution

**What goes wrong:**
Pre-task codebase scanning, Context7 library lookups, and quality sentinel prompting consume 40–60% of available context before the executor agent writes a single line of code. The executor then runs out of context mid-task, produces truncated or placeholder implementations, and the quality gates that were meant to prevent slop actually cause it.

**Why it happens:**
Quality enforcement is added as a prefix to existing executor prompts. Each addition seems small — a codebase scan here, a Context7 lookup there — but they compound. A full codebase scan can return hundreds of file listings, dependency trees, and pattern examples. Context7 docs can return thousands of tokens per query. By the time the executor reaches the actual task instructions, its effective context window is already crowded.

**How to avoid:**
- Cap pre-task scans to targeted lookups only: specific file types, specific directories relevant to the task's `files-modified` frontmatter, not the full codebase.
- Context7 queries must be scoped to the exact API surface being used — not the full library overview. One focused query ("how to use X method") not "tell me about this library."
- Quality sentinel output must be structured JSON summaries consumed by the executor, not raw prose dumped into context. A 5-field JSON object is vastly cheaper than a 200-line scan narrative.
- Set a context budget cap: quality gates combined must not exceed 15% of the executor's context window. If a scan would exceed this, skip it and log a warning rather than silently burning budget.

**Warning signs:**
- Executor agents timing out or stopping mid-task on plans that previously completed fine.
- SUMMARY.md files containing "ran out of context" or "deferred to next task" language.
- Plans with many `files-modified` entries triggering proportionally large scans.
- Execution time increasing significantly after quality sentinel is added.

**Phase to address:**
Phase implementing Quality Sentinel in executor — budget cap logic must be part of the initial implementation, not a follow-up optimization.

---

### Pitfall 2: is_last_phase Bug Causes Premature Milestone Completion

**What goes wrong:**
The existing `cmdPhaseComplete` function in `phase.cjs` (lines 786–802) determines `is_last_phase` by scanning the `.planning/phases/` filesystem directory for phase directories higher-numbered than the current phase. Because unplanned future phases don't have directories yet (only ROADMAP.md entries), the scan finds nothing after the current phase and sets `is_last_phase = true`. This routes users to `/gsd:complete-milestone` when they should be routed to `/gsd:plan-phase` for the next unplanned phase.

**Why it happens:**
The GSD lifecycle is: plan phases lazily (directories created only when planning begins). At the time phase N completes, phases N+1 through end only exist in ROADMAP.md — their directories are not created until `/gsd:plan-phase` is run. The filesystem scan is a correct query for the wrong data source.

**How to avoid:**
Fix `cmdPhaseComplete` to parse phase numbers from ROADMAP.md instead of scanning filesystem directories. ROADMAP.md is the authoritative source of all phases in the milestone — it contains every phase (planned or not) under `### Phase N:` headers. The fix:
1. Parse all `Phase N:` headers from ROADMAP.md to build a complete ordered list of phase numbers.
2. Find the current phase in that list.
3. If any phase number in the list is greater than the current phase, `is_last_phase = false` and `nextPhaseNum` is the next entry.
4. The roadmap-parsing capability already exists in `roadmap.cjs` — use `cmdRoadmapGetPhase` or extract phase headers inline.

Note: the `execute-plan.md` workflow's `offer_next` step also implements its own "current < highest phase" check using filesystem directory counts. Both locations need consistent logic.

**Warning signs:**
- Users completing Phase 1 of a 5-phase project and immediately being told "Milestone complete."
- STATE.md showing "Milestone complete" status when ROADMAP.md still has unchecked phases.
- `/gsd:complete-milestone` being triggered on multi-phase milestones after the first phase.

**Phase to address:**
Bug fix phase (earliest in the roadmap) — this bug makes the fork unusable for multi-phase milestones and must be fixed before quality enforcement is layered on top.

---

### Pitfall 3: Additive Changes Break Existing CLI Command Parsing

**What goes wrong:**
`phase.cjs` is loaded and called via `gsd-tools.cjs` through a command dispatch table. When modifying `cmdPhaseComplete` or other functions, changes to return object shape, new fields in `output()` calls, or altered error conditions break callers that parse the JSON output. The `execute-plan.md` workflow and `transition.md` workflow both call `gsd-tools.cjs phases complete` and consume `is_last_phase`, `next_phase`, and `next_phase_name` from the result. If the fix adds new fields but the callers don't handle them, or if error output format changes, workflows silently misroute.

**Why it happens:**
The GSD CLI uses a structured JSON output pattern (`output(result, raw, text)`) with no versioning or schema validation. Callers rely on field presence by convention. Adding new fields is safe; renaming or removing fields silently breaks callers that do field access without existence checks.

**How to avoid:**
- The fix to `cmdPhaseComplete` must preserve all existing output fields (`is_last_phase`, `next_phase`, `next_phase_name`, `completed_phase`, `phase_name`, `plans_executed`, `date`, `roadmap_updated`, `state_updated`).
- New fields can be added freely — they will be ignored by existing callers.
- Never rename an existing output field, even if the name is misleading.
- After fixing, run all CLI commands that consume phase-complete output: `phases complete`, the transition workflow step, and the `offer_next` step in execute-plan.md.
- Test with: a project where phase directories exist for all phases (old behavior), and a project where later phases have no directories yet (the bug scenario).

**Warning signs:**
- `gsd-tools.cjs phases complete` outputting `null` or `undefined` for previously populated fields after the fix.
- Workflows routing to wrong next step after phase completion.
- `transition.md` workflow hitting unexpected branches.

**Phase to address:**
Bug fix phase — write a before/after test fixture that captures the exact JSON output of `cmdPhaseComplete` for both scenarios before touching any code.

---

### Pitfall 4: Testing Enforcement Blocking Config and Styling Changes

**What goes wrong:**
A mandatory test step that requires tests for all code changes will false-positive block legitimate config-only changes (updating `.planning/config.json` schema, changing `model_profile` defaults), styling/formatting changes, documentation updates, and template modifications. GSD plans frequently modify `.md` template files, workflow step prose, and `config.json` defaults — none of which are meaningfully testable with unit tests.

**Why it happens:**
The test enforcement layer is written for application code patterns ("write tests for new logic") and applied globally. Config changes, Markdown template changes, and framework workflow prose don't have testable units. Enforcing the same test requirement on `templates/summary.md` as on `phase.cjs` creates friction without value.

**How to avoid:**
- Test enforcement must be file-type aware. Files matching `*.md`, `*.json` config files, and template files should be exempt from the "write tests" gate.
- The test gate should fire based on the PLAN.md `files-modified` frontmatter: if all modified files are non-code, skip mandatory test requirement and log why.
- Enforcement rules must explicitly enumerate the exempt categories in the config (not as implicit magic): `quality.test_exemptions: ["*.md", "*.json", "templates/**", ".planning/**"]`.
- The "write tests for new logic" requirement applies to `.cjs`, `.js`, `.ts` files with exported functions — not to config and prose.

**Warning signs:**
- Test enforcement blocking plans that only touch `.planning/` files.
- Verifier raising "no tests written" failures for documentation or config phases.
- Users disabling quality enforcement entirely because it blocks config-only work.

**Phase to address:**
Phase implementing mandatory test step and verifier quality checks — exemption logic must be part of the initial design, not retrofitted after complaints.

---

### Pitfall 5: Codebase Scanning Returning Noise Instead of Signal

**What goes wrong:**
The pre-implementation codebase scan (`map-codebase.md` reference in the project) finds every file in the repository and returns an undifferentiated list. The executor receives hundreds of file paths, utility function names, and import patterns. Most are irrelevant to the current task. The scan consumes context but provides no focused guidance — it's the opposite of "find existing patterns, reuse utilities."

**Why it happens:**
Codebase scanning is implemented as a broad search (`find . -name "*.cjs"` style) rather than a targeted query. Without relevance filtering, signal-to-noise is low. The executor cannot distinguish between a utility function used 47 times across the codebase and a one-off helper in an archived file.

**How to avoid:**
- Scope scans to task-relevant directories only, derived from the PLAN's `files-modified` and `subsystem` frontmatter fields.
- Scan for patterns, not files: "find functions that do X" (via grep for function signatures matching the task domain) rather than "list all files."
- Limit scan output to the top 5–10 most relevant findings. Truncate with "... N more" rather than dumping everything.
- If `.planning/codebase/` map exists (it's updated by execute-plan.md), use it as the primary lookup before running a live scan — it's already filtered to structural information.
- Never scan `node_modules`, `.git`, `.planning/phases`, or archived phase directories.

**Warning signs:**
- Scan output containing more than 50 results for a targeted task.
- Executor citing files from unrelated subsystems in its implementation.
- Context budget consumed before task execution begins on large codebases.

**Phase to address:**
Phase implementing pre-implementation codebase scan — the relevance filtering design must be defined before implementation begins.

---

### Pitfall 6: Context7 Integration Adding Excessive Tokens

**What goes wrong:**
Context7 docs queries return full library documentation sections — sometimes thousands of tokens covering the entire API surface of a library. An executor asked to "use the `output()` function from core.cjs" that triggers a Context7 lookup for "Node.js fs module" gets back every `fs` method, filesystem constants, stream docs, and examples. This is worse than not looking it up at all.

**Why it happens:**
Context7 library resolution (`resolve-library-id` then `query-docs`) returns broad documentation pages by default. Without a highly specific query scoped to the exact method or pattern needed, the response covers far more than the task requires.

**How to avoid:**
- Context7 queries must be triggered only when the executor is about to hand-roll something that a library provides. The trigger condition is specific: "I am about to implement X from scratch, does any resolved library do this?"
- Queries must name the exact method or pattern, not the library: "how to use Commander.js option parsing with required arguments" not "Commander.js documentation."
- Cap Context7 integration to one query per plan execution maximum. If multiple lookups are needed, the plan is too broad and should be split.
- Store Context7 results in the executor's working state as a summary (5–10 key facts extracted), not the full response.
- Mark Context7 as optional when the `quality_level` is set to `fast` — skip lookups entirely in fast mode.

**Warning signs:**
- Executor context containing more than 2,000 tokens from Context7 responses.
- Multiple Context7 queries per plan execution.
- Context7 being invoked for native Node.js APIs (fs, path, os) that the executor already knows well.

**Phase to address:**
Phase integrating Context7 into executor — the query discipline and token cap rules must be enforced as part of the integration spec, not left to the executor's judgment.

---

### Pitfall 7: Quality Enforcement Levels Not Wired to Config at Implementation Time

**What goes wrong:**
The `strict/standard/fast` enforcement level config is defined in `config.json` but quality gate code is written with hardcoded "always check" logic. When users set `quality_level: fast`, the sentinel still runs full scans and Context7 lookups because the enforcement code never reads the config setting. The config key exists but has no behavioral effect.

**Why it happens:**
Quality gate implementation is written first, config wiring is deferred as "phase 2." The gates ship without reading the config. Later, wiring the config requires understanding every gate's execution path and threading the config value through — significantly more work than wiring it correctly upfront.

**How to avoid:**
- Every quality gate function must read `quality_level` from config at its entry point. This is not optional and is not a follow-up.
- Define the behavior matrix upfront before writing any gate:
  - `fast`: no pre-task scan, no Context7, post-task diff only
  - `standard`: targeted pre-task scan, Context7 on explicit library use, diff + duplication check
  - `strict`: full pre-task scan, mandatory Context7 before any library use, diff + duplication + test coverage + dead code
- Gate functions receive `qualityLevel` as a parameter or read it from config at the top. No gate should have hardcoded "always run" logic.

**Warning signs:**
- Setting `quality_level: fast` in config and observing no change in execution time.
- Quality gate code containing no references to `config-get` or `qualityLevel` parameter.
- "fast mode" mentioned in docs but not in any gate's code path.

**Phase to address:**
Phase implementing configurable enforcement levels — define the behavior matrix as the first deliverable of this phase, before writing any gate code.

---

### Pitfall 8: Roadmap-Aware Phase Routing Fix Inconsistency Across Callers

**What goes wrong:**
`cmdPhaseComplete` is fixed to parse ROADMAP.md for total phase count, but `execute-plan.md`'s `offer_next` step uses its own filesystem-based logic (comparing current phase directory to "highest phase" on disk) that is not updated. The two code paths give contradictory answers — `gsd-tools.cjs phases complete` says "next phase is Phase 3" but the `offer_next` step in the workflow says "milestone done" because it still counts filesystem directories.

**Why it happens:**
The bug exists in two places: the CLI tool and the workflow prose. Fixing only one creates a split-brain state where the tool output and the workflow's routing logic disagree. The workflow's `offer_next` step uses shell commands directly (`ls .planning/phases/...`) rather than calling `gsd-tools.cjs`, so fixing the tool doesn't fix the workflow.

**How to avoid:**
- Fix `cmdPhaseComplete` in `phase.cjs` and simultaneously update the `offer_next` step in `execute-plan.md` to use the tool's output (`is_last_phase` from `gsd-tools.cjs phases complete`) rather than re-implementing the detection logic.
- Any phase routing logic that currently uses filesystem directory counts must be audited and updated to call the fixed CLI tool.
- The canonical answer for "is this the last phase?" is always the output of `gsd-tools.cjs phases complete`, never a local filesystem check.

**Warning signs:**
- `gsd-tools.cjs phases complete` returning `is_last_phase: false` but the workflow offering "complete milestone" to the user.
- Two different routing outcomes depending on whether phase completion is driven by the CLI vs. the workflow.

**Phase to address:**
Bug fix phase — the two-location fix must be atomic. Fix both in the same plan to avoid the inconsistent state window.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip config wiring in quality gates | Faster initial implementation | Gates have no enforcement levels; `fast` mode does nothing | Never — wire config at implementation time |
| Use broad codebase scans instead of targeted | Simpler scan code | Context budget exhaustion; low signal-to-noise | Never — targeted scans only |
| Dump raw Context7 output into executor context | No summarization step | Token explosion; context overrun on any library task | Never — summarize to key facts |
| Hardcode test requirement for all file types | Simpler gate logic | Blocks config and styling changes; users disable quality enforcement | Never — file-type exemptions are mandatory |
| Fix `is_last_phase` only in `phase.cjs` | Minimal change surface | `execute-plan.md` still routes incorrectly; split-brain state | Never — both locations must be fixed atomically |
| Add quality sentinel as prompt prefix instead of structured step | Easy to implement | Uncontrolled context growth with each added gate | Never — gates must be structured steps with budget caps |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Context7 library resolution | Querying broad library name ("fs", "path") | Query exact method or pattern ("fs.readFileSync options for utf-8 encoding") |
| Context7 in executor | Triggering on every task regardless of relevance | Trigger only when executor signals "about to hand-roll X that a library provides" |
| gsd-tools.cjs CLI | Parsing text output instead of JSON (`--raw` flag missing) | Always use `--raw` flag and parse JSON; text output is for human display only |
| ROADMAP.md phase parsing | Using regex that requires padded numbers (`01`) | ROADMAP.md uses unpadded numbers in headers (`Phase 1:`) — match both padded and unpadded |
| STATE.md updates | Writing STATE.md in the quality sentinel | STATE.md is owned by the executor workflow steps; sentinel must not write it |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Pre-task scan of full codebase | Each plan takes 2x longer; context budget exhausted before coding | Scope scan to task-relevant directories from PLAN frontmatter | Breaks at ~50 files in codebase |
| Duplication detection scanning all files | Verifier step runs for minutes on large repos | Scope duplication check to files in `files-modified` + direct imports | Breaks at ~200 files |
| Context7 query per library method | Multiple queries per plan; 10k+ tokens from docs | One query per plan maximum; query the pattern not the method | Breaks at plans with 3+ library usages |
| Writing quality reports to disk per task | `.planning/` accumulates large sentinel log files | Store sentinel findings in-memory for current execution only; never persist | Breaks at 20+ plans per milestone |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Quality enforcement levels:** Config key `quality_level` exists in config.json — verify that setting `fast` actually skips scan and Context7 steps (not just defined)
- [ ] **is_last_phase fix:** `gsd-tools.cjs phases complete 1` returns `is_last_phase: false` on a project with Phases 1–5 in ROADMAP.md but only Phase 1 directory on disk — verify with live test
- [ ] **execute-plan.md offer_next step:** Workflow routes to "plan next phase" (not "complete milestone") after Phase 1 completion in a multi-phase project — verify both CLI tool AND workflow output
- [ ] **Context7 token cap:** Quality sentinel adds a Context7 lookup and the total executor context stays under 50% budget — measure before shipping
- [ ] **Test exemptions:** Plans modifying only `.md` and `.json` files do not trigger "write tests" gate — verify with a config-only plan
- [ ] **Codebase scan scope:** Pre-task scan for a plan targeting `phase.cjs` does not return files from `node_modules`, `.planning/phases`, or unrelated subsystems
- [ ] **Backward compatibility:** All existing workflows (`execute-plan.md`, `transition.md`, `verify-phase.md`) continue to function identically after changes to `phase.cjs`

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context budget exhausted mid-plan | MEDIUM | Split the offending plan into two smaller plans; cap scan scope; reduce Context7 from query to summary |
| is_last_phase bug still active after fix | LOW | Manually run `gsd-tools.cjs phases complete` and check `is_last_phase` field; if wrong, verify ROADMAP.md parser is reading the correct file path |
| Quality gates blocking valid code | LOW | Set `quality_level: fast` in `.planning/config.json` to bypass gates temporarily; investigate false positive; fix exemption rule |
| execute-plan.md offer_next routing wrong phase | MEDIUM | Manually invoke `/gsd:plan-phase N` for the correct next phase; update `offer_next` step to use CLI tool output |
| Context7 flooding executor context | LOW | Reduce to one Context7 query per plan; add token cap check before inserting docs into context |
| Testing enforcement too rigid | LOW | Add file type to `quality.test_exemptions` in config; re-run verification |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Quality gates exhausting context budget | Quality Sentinel implementation phase | Measure executor context usage before and after sentinel; must stay under 50% budget |
| is_last_phase bug | Bug fix phase (first in roadmap) | Run `gsd-tools.cjs phases complete` on a project with unplanned future phases; verify `is_last_phase: false` |
| Additive changes breaking CLI commands | Bug fix phase | Run all CLI commands that consume phase-complete JSON; compare output schema before and after |
| Testing enforcement blocking config changes | Test step + verifier enhancement phase | Run a config-only plan through the enforcement layer; verify no "missing tests" failure |
| Codebase scan noise | Quality Sentinel implementation phase | Compare scan output size before and after scope filtering; must be under 50 results |
| Context7 token explosion | Context7 integration phase | Measure Context7 contribution to executor context; must be under 2,000 tokens |
| Enforcement levels not wired | Configurable enforcement phase | Set `quality_level: fast` and verify zero pre-task scan and zero Context7 calls |
| Roadmap routing inconsistency across callers | Bug fix phase | Verify `execute-plan.md` offer_next and `gsd-tools.cjs phases complete` agree on next phase |

---

## Sources

- First-party codebase analysis: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/phase.cjs` (lines 786–802, is_last_phase bug confirmed)
- First-party codebase analysis: `/Users/tmac/Projects/gsdup/get-shit-done/workflows/execute-plan.md` (offer_next step, independent filesystem routing logic confirmed)
- First-party codebase analysis: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/config.cjs` (config structure, existing workflow flags)
- Project context: `/Users/tmac/Projects/gsdup/.planning/PROJECT.md` (requirements, constraints, known bugs)
- Domain knowledge: Claude Code context window behavior under subagent spawning (context budget ~50% per plan execution — stated in PROJECT.md constraints)

---
*Pitfalls research for: AI coding agent framework quality enforcement layer (GSD Enhanced Fork)*
*Researched: 2026-02-23*
