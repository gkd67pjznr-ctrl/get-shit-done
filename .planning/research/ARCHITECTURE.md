# Architecture Research

**Domain:** Agent orchestration quality enforcement — Claude Code framework (GSD)
**Researched:** 2026-02-23
**Confidence:** HIGH — based on direct analysis of all 11 existing agent source files, PROJECT.md, and PROPOSAL.md

---

## Standard Architecture

### System Overview

The GSD pipeline is a sequential orchestration chain where each stage produces artifacts consumed by the next. Quality enforcement layers into this chain at three natural insertion points: pre-execution (planning + checking), during-execution (executor), and post-execution (verification).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PLANNING LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │gsd-planner   │→ │gsd-plan-     │→ │  PLAN.md     │                   │
│  │(quality      │  │checker       │  │  (quality     │                   │
│  │ directives)  │  │(8 dims +     │  │   directives  │                   │
│  │              │  │ quality dim) │  │   embedded)   │                   │
│  └──────────────┘  └──────────────┘  └──────┬───────┘                   │
├────────────────────────────────────────────  │ ──────────────────────────┤
│                        EXECUTION LAYER        ↓                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      gsd-executor                                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │ Pre-task     │→ │ Task impl    │→ │ Post-task    │           │    │
│  │  │ Quality      │  │ + Context7   │  │ Quality      │           │    │
│  │  │ Sentinel     │  │   lookup     │  │ Gate +       │           │    │
│  │  │ (scan +      │  │ + per-file   │  │ Test gate    │           │    │
│  │  │  baseline)   │  │   lint/type  │  │ + Commit     │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                        VERIFICATION LAYER                                │
│  ┌──────────────────────────┐  ┌──────────────────────────┐             │
│  │     gsd-verifier         │  │  gsd-integration-checker │             │
│  │  (existing 3-level +     │  │  (cross-phase wiring,    │             │
│  │   new quality dims:      │  │   unchanged for this     │             │
│  │   duplication, dead code,│  │   milestone)             │             │
│  │   test coverage,         │  │                          │             │
│  │   pattern consistency)   │  │                          │             │
│  └──────────────────────────┘  └──────────────────────────┘             │
├─────────────────────────────────────────────────────────────────────────┤
│                        STATE + CONFIG LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  STATE.md    │  │  ROADMAP.md  │  │  config.json │                   │
│  │  (unchanged) │  │  (unchanged) │  │  (quality    │                   │
│  │              │  │              │  │   level key  │                   │
│  │              │  │              │  │   added)     │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Component Responsibilities

| Component | Existing Responsibility | Quality Enforcement Addition | Where Added |
|-----------|------------------------|------------------------------|-------------|
| `gsd-planner` | Decompose phases into executable plans with task breakdown, dependency graphs, goal-backward must-haves | Add quality directives to every task `<action>`: which codebase patterns to reuse, which Context7 queries to run, what tests to write | New `<quality_directives>` subsection inside `<task_breakdown>` |
| `gsd-plan-checker` | 8 verification dimensions pre-execution | Add Dimension 9: Quality Directive Completeness — verify tasks reference codebase reuse, library docs, test expectations | New `## Dimension 9` block in `<verification_dimensions>` |
| `gsd-executor` | Execute tasks, atomic commits, deviation handling, TDD flow | Quality Sentinel (pre-task scan, Context7 lookup, during-task lint/type gates, post-task diff review, mandatory test gate) | New `<quality_sentinel>` section, `mcp__context7__*` added to tools, `<context7_protocol>` section, modified `<execute_tasks>` step |
| `gsd-verifier` | 3-level artifact verification (exists, substantive, wired) + anti-pattern scan | Add quality dimensions: duplication detection, dead code scan, test coverage check, pattern consistency, dependency hygiene | New `## Step 7b` block after existing Step 7 (anti-patterns) |
| `gsd-integration-checker` | Cross-phase export/import wiring | No change required — integration checking is already thorough | None |
| `gsd-codebase-mapper` | Analyze tech/arch/quality/concerns | No change required — already produces quality-relevant docs | None |
| `gsd-phase-researcher` | Domain research with Context7, produces RESEARCH.md | No change required — already has Validation Architecture / Nyquist section | None |
| `config.json` (template) | Workflow settings | Add `quality` key with `level`, `enforce_tests`, `enforce_context7`, `enforce_codebase_scan`, `enforce_lint_check` | New key in existing config template |

**Agents not touched:** gsd-project-researcher, gsd-research-synthesizer, gsd-roadmapper, gsd-debugger — their responsibilities are architectural, not execution-layer.

---

## Recommended Project Structure (What Changes)

```
gsdup/
├── agents/
│   ├── gsd-executor.md         # PRIMARY target — largest changes
│   │   ├── tools: add mcp__context7__*
│   │   ├── <quality_sentinel>  # NEW section
│   │   ├── <context7_protocol> # NEW section
│   │   └── <execute_tasks>     # MODIFIED — add pre-task scan step
│   ├── gsd-verifier.md         # SECONDARY target — additive quality dims
│   │   └── <verification_process> # MODIFIED — new Step 7b
│   └── gsd-planner.md          # TERTIARY target — task action format
│       └── <task_breakdown>    # MODIFIED — quality directive format
├── get-shit-done/
│   └── templates/
│       └── config.json         # Add quality key
└── .planning/
    └── (STATE.md, ROADMAP.md — unchanged)
```

### Structure Rationale

- **gsd-executor.md is the primary target** because quality problems originate at write-time, not detection-time. Fixing quality at source is cheaper than fixing it in verification.
- **gsd-verifier.md is secondary** because it provides the quality backstop — if the executor's inline gates miss something, the verifier catches it at phase close.
- **gsd-planner.md is tertiary** because quality directives embedded in task actions pre-load the executor's context with "what to reuse, what docs to consult" — reducing the executor's scan cost.
- **config.json** provides the killswitch — `fast` mode disables expensive gates for quick experiments without changing agent files.

---

## Architectural Patterns

### Pattern 1: Inline Sentinel (not Separate Agent)

**What:** Quality gates embedded inside the executor agent as a named protocol block (`<quality_sentinel>`), not as a separate spawned agent.

**When to use:** When quality checks must run inline with execution because they require the executor's already-loaded task context.

**Why chosen over separate agent:** A separate quality agent would require a full context handoff (pass task context, scan results, back to executor) which burns ~30-50K tokens per task. The executor already has task context loaded. Inline sentinel adds ~5K tokens of scan overhead per task by operating within existing context.

**Trade-off:** The quality sentinel consumes executor context budget. Mitigated by keeping scans targeted (grep for specific patterns, not full codebase reads) and gated on `config.quality.level`.

**Implementation sketch:**
```xml
<quality_sentinel>
## Pre-Task Protocol (runs before each type="auto" task)

**Step 1: Codebase Scan (targeted)**
Search for existing patterns related to this task's domain:
grep -r "{task_domain_term}" src/ --include="*.ts" -l 2>/dev/null | head -10

If similar code found: evaluate for reuse before writing new code.
Document decision in commit message: "Reuses X from Y" or "New because X is different in Z way"

**Step 2: Context7 Lookup (conditional)**
Required before implementing: auth, validation, date/time, state management, API clients, ORM queries, any library from package.json not used before in this session.

1. mcp__context7__resolve-library-id with libraryName: "{library}"
2. mcp__context7__query-docs with libraryId: {id}, query: "{specific pattern needed}"
3. Apply documented pattern — do not use training data assumption

Skip if: config-only task, UI-only styling, no library dependencies.

**Step 3: Test Baseline**
npm test 2>&1 | tail -5  (or equivalent)
Record: how many tests pass/fail before changes. If baseline is red, document in SUMMARY.md.

## During-Task Gates (after writing each file)
Run: tsc --noEmit (if TypeScript), lint command (if configured), affected test files.
Fix before moving to next file.

## Post-Task Review (before commit)
Read own diff: git diff --staged
Checklist: no TODO/FIXME left in changed lines, error cases handled, names consistent with codebase.
</quality_sentinel>
```

**Context budget estimate:** Pre-task scan ~2-5K tokens (targeted grep + pattern review). Context7 query ~3-8K tokens per library lookup. During-task gates: output only (no additional reads). Post-task diff read: ~1-3K tokens. Total overhead per task: ~6-16K tokens.

---

### Pattern 2: Cascading Quality Directives (Planner → Executor)

**What:** Planner embeds specific quality instructions directly into each task's `<action>` field, pre-loading the executor with "what to reuse" and "what docs to consult" before execution begins.

**When to use:** When the planner has access to codebase map documents (CONVENTIONS.md, ARCHITECTURE.md, STACK.md) that give it prior knowledge of existing patterns.

**Why this matters:** Without cascading directives, the executor must re-discover patterns from scratch on every task (duplicate scan work). With directives, the planner does the scan once during planning and the executor just follows instructions.

**Example in task action:**
```xml
<task type="auto">
  <name>Task 2: Implement user validation</name>
  <files>src/lib/validators/user.ts</files>
  <action>
    Quality directives:
    - REUSE: src/lib/validators/base.ts has validateEmail() — import and use it
    - CONSULT Context7: zod library for schema validation (project uses zod per STACK.md)
    - TESTS: write src/lib/validators/user.test.ts with valid/invalid input cases

    Implementation: Create validateUser(input) using zod schema. Import validateEmail from
    base.ts for the email field. Do not hand-roll email regex.
  </action>
  <verify>...</verify>
  <done>...</done>
</task>
```

**Context budget estimate:** Each task's quality directives add ~200-400 tokens to plan size. Plans are loaded fresh per executor spawn, so no cumulative cost.

---

### Pattern 3: Additive Verification Dimensions (not New Verification Passes)

**What:** New quality checks (duplication, dead code, test coverage, pattern consistency) added as additional steps inside the existing `gsd-verifier` flow — not as a new agent or separate verification pass.

**When to use:** When checks can be done with the same grep/file-check approach the verifier already uses, on files already identified from SUMMARY.md.

**Why additive:** A separate quality verification agent would require spawning a new subagent with fresh context, re-loading all the phase artifacts, and returning results to the orchestrator. The verifier already has these artifacts loaded in Steps 1-7. Steps 7b+ are zero-cost from a context-loading perspective.

**New Step 7b structure:**
```bash
## Step 7b: Code Quality Checks

# Duplication detection — find near-identical function bodies
# (run on files from SUMMARY.md key-files, not full codebase)
for file in ${PHASE_FILES}; do
  # Check for functions that might duplicate existing utilities
  func_names=$(grep -E "^(export )?function |^(export )?const .* = \(" "$file" | head -20)
  # Cross-reference against utility directories
  for name in $func_names; do
    grep -r "$name" src/lib src/utils src/helpers --include="*.ts" | grep -v "$file"
  done
done

# Test coverage check — new logic without tests
for file in ${PHASE_FILES}; do
  test_file="${file/.ts/.test.ts}"
  [ ! -f "$test_file" ] && echo "WARNING: No test file for $file"
done

# Dead code — exports with no importers
for file in ${PHASE_FILES}; do
  exports=$(grep -E "^export " "$file" | grep -oE "(function|const|class) \w+" | awk '{print $2}')
  for export in $exports; do
    uses=$(grep -r "$export" src/ --include="*.ts" --include="*.tsx" | grep -v "import" | grep -v "$file" | wc -l)
    [ "$uses" -eq 0 ] && echo "DEAD EXPORT: $export in $file"
  done
done
```

**Context budget estimate:** Step 7b adds ~2-5K tokens of grep output to the verifier's context. Well within the verifier's budget since it doesn't spawn additional agents.

---

### Pattern 4: Config-Gated Quality Levels

**What:** All quality gates read `config.quality.level` before executing. Gate behavior per level:

| Gate | strict | standard | fast |
|------|--------|----------|------|
| Pre-task codebase scan | Always | Always | Skip |
| Context7 lookup | Always | Conditional (new deps only) | Skip |
| During-task type check | Always | Always | Skip |
| During-task lint | Always | Always | Skip |
| Mandatory test write | Always | New logic only | Skip |
| Post-task diff review | Always | Always | Skip |
| Verifier quality dims | All | Core only | Skip |

**Implementation:** Each quality gate checks config at runtime:
```bash
QUALITY_CFG=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "standard")
# Gate: [ "$QUALITY_CFG" = "fast" ] && skip_gate || run_gate
```

**Why this matters architecturally:** The config gate is what makes this enhancement compatible with the constraint "All changes are additive." Users with existing projects running `fast` mode experience zero behavior change. `strict` users get full enforcement. The agent files change once; behavior changes per project via config.

---

## Data Flow

### Quality-Enhanced Execution Flow

```
PLAN.md (with quality directives embedded by planner)
    ↓
gsd-executor spawned (fresh context, ~200K)
    ↓
[Step: load_project_state] — reads config.quality.level
    ↓
[Step: execute_tasks] — for each task:
    │
    ├── [quality_sentinel: pre-task]
    │     ├── grep codebase for similar patterns (targeted, 10-line output limit)
    │     ├── Context7 lookup (if library used OR config=strict)
    │     └── npm test → record baseline pass count
    │
    ├── [task implementation] — write code files
    │     └── after each file: tsc --noEmit + lint + affected tests
    │
    └── [quality_sentinel: post-task]
          ├── git diff --staged (read own diff)
          ├── duplication check against scan results
          └── test gate: write test if new logic created
    ↓
[task_commit_protocol] — commit implementation + tests together
    ↓
SUMMARY.md created → key-files list feeds gsd-verifier
    ↓
gsd-verifier spawned (fresh context)
    ↓
[Steps 1-7: existing verification]
    ↓
[Step 7b: quality dimensions — NEW]
    │   ├── duplication detection on phase files
    │   ├── dead code / orphaned exports
    │   ├── test coverage check (test file existence)
    │   └── pattern consistency (naming, structure vs CONVENTIONS.md)
    ↓
VERIFICATION.md — includes quality findings in gaps: section
```

### Context7 Data Flow (within executor)

```
Task action references library (e.g., "zod for validation")
    ↓
quality_sentinel: pre-task
    └── mcp__context7__resolve-library-id(libraryName: "zod")
         → returns library ID
    └── mcp__context7__query-docs(libraryId, query: "schema validation pattern")
         → returns current API docs + code examples
    ↓
Task implementation uses documented pattern (not training data)
    ↓
Commit message notes: "Per zod docs via Context7 (schema.parse pattern)"
```

### Config Quality Level Data Flow

```
.planning/config.json
    { "quality": { "level": "strict" } }
    ↓
gsd-executor reads at startup (auto_mode_detection step)
    └── QUALITY_CFG = "strict" | "standard" | "fast"
    ↓
Each gate reads QUALITY_CFG before running
    └── strict: all gates active
    └── standard: scan + context7 conditional + tests for new logic
    └── fast: gates skipped, normal GSD flow preserved
```

---

## Build Order

The build order is driven by what depends on what. Changes must be built in this sequence:

### Phase 1: Config Foundation (unblocks everything else)

**What:** Add `quality` key to `get-shit-done/templates/config.json`. Add config-read pattern to executor and verifier gate checks.

**Why first:** Every quality gate reads config. Without the config key, gates cannot be conditionally enabled/disabled. This is a 1-file change with no agent logic — lowest risk, highest leverage.

**Depends on:** Nothing.

**File:** `get-shit-done/templates/config.json`

---

### Phase 2: Executor Core Quality Sentinel (largest change, critical path)

**What:** Modify `agents/gsd-executor.md`:
1. Add `mcp__context7__*` to the `tools:` frontmatter line
2. Add `<quality_sentinel>` section (pre-task, during-task, post-task protocols)
3. Add `<context7_protocol>` section
4. Modify `<execute_tasks>` step to call quality_sentinel at correct points
5. Modify `<task_commit_protocol>` to include test gate before commit

**Why second:** This is the highest-value change (executor is where code is written, executor is where slop originates). Everything else is backstop or upstream signaling — the executor is ground truth.

**Depends on:** Phase 1 (config level determines which gates run).

**File:** `agents/gsd-executor.md`

**Context budget implication:** The executor's own context budget gets consumed by quality gates. Estimated impact: +15-25% context per task vs. current. This means plans with complex tasks (3 files, 30-60 min Claude time) may approach the ~50% context target sooner. Mitigation: quality gate outputs are capped (grep output limited to relevant lines, Context7 queries targeted to specific pattern needed, not full library docs).

---

### Phase 3: Verifier Quality Dimensions (backstop layer)

**What:** Modify `agents/gsd-verifier.md`:
1. Add Step 7b: Code Quality Checks after existing Step 7 (Anti-Patterns)
2. Update Step 9 (Overall Status) to include quality dimension failures in `gaps_found`
3. Update VERIFICATION.md output template to include quality findings section

**Why third:** The verifier is the backstop — it catches what the executor's inline gates miss. It operates on the complete phase output, so it needs Phase 2 (executor changes) to have run first to generate the test files and commit patterns it verifies.

**Depends on:** Phase 2 (verifier's quality checks are meaningful only after executor has been taught to write tests; otherwise every verification fails on test coverage).

**File:** `agents/gsd-verifier.md`

---

### Phase 4: Planner Quality Directives (upstream signaling)

**What:** Modify `agents/gsd-planner.md`:
1. Add quality directive format to `<task_breakdown>` section
2. Add instruction: task `<action>` must identify (a) existing code to reuse, (b) library docs to consult, (c) tests to write
3. Add self-check: before returning plans, verify each task action has quality directives populated

**Why fourth:** Planner quality directives pre-load executor with scan results — reducing executor scan cost. But executor can work without them (quality_sentinel runs its own scan if directives are absent). Building planner changes last means phases 1-3 are stable before we change how plans are created.

**Depends on:** Phase 2 (directives are only meaningful if executor knows what to do with them; the `quality_sentinel` section in executor defines the contract planner directives fill).

**File:** `agents/gsd-planner.md`

---

### Phase 5: Plan-Checker Quality Dimension (pre-execution validation)

**What:** Add Dimension 9 to `agents/gsd-plan-checker.md`: verify task actions include quality directives (codebase reference, library consultation note, test expectation). Non-blocking in standard mode, blocking in strict mode.

**Why fifth (and optional at first):** Plan-checker enforces that planners follow the Phase 4 changes. Building it after the planner changes means there's something to validate. This is the least critical change — the executor's inline sentinel catches gaps regardless of whether the checker validates plan quality.

**Depends on:** Phase 4 (no point checking for quality directives in plans if planner hasn't been taught to write them).

**File:** `agents/gsd-plan-checker.md`

---

## Context Budget Implications

### Executor Budget Analysis

Current executor context consumption per task (estimated):
- Plan context loaded: ~15-25K tokens
- Task implementation (write 2-4 files): ~20-40K tokens
- Verify + commit: ~5-10K tokens
- **Current total per task: ~40-75K tokens of a 200K budget**

Quality sentinel additions per task:
- Pre-task codebase scan (grep output, limited): ~2-5K tokens
- Context7 lookup (1-2 queries, targeted): ~3-8K tokens
- During-task lint/type output: ~1-2K tokens
- Post-task diff read: ~1-3K tokens
- Test writing (if new logic): ~10-20K tokens (significant)
- **Quality overhead per task: ~17-38K tokens**

**Net result:** Executor context per task increases from ~40-75K to ~57-113K tokens. For a 2-task plan (~50% context target), current budget allows ~100K tokens before degradation. Quality gates push this to ~114-226K — potentially exceeding the 200K fresh context budget for complex tasks.

**Mitigation strategies embedded in design:**
1. Cap grep output (`| head -10`, `-l` flag for file-list-only)
2. Target Context7 queries narrowly ("how to use X for Y" not "all about X")
3. Test gate applies only when new logic is created (not for config/style tasks)
4. Config `fast` mode disables all gates when budget matters more than quality
5. Plans should account for quality overhead: complex tasks that add quality gates should target ~40% context (not 50%) to preserve headroom

### Verifier Budget Analysis

Verifier budget is less constrained — it runs post-phase with a fresh context, reading already-committed artifacts via grep/file checks. Step 7b adds ~2-5K tokens of additional grep output. No significant budget concern.

### Planner Budget Analysis

Planner runs once per plan creation, not per task. Adding quality directive format to each task action adds ~200-400 tokens per task to the PLAN.md file. Plans are read fresh by each executor spawn — no cumulative cost. The planner's own context budget is not materially affected.

---

## Anti-Patterns

### Anti-Pattern 1: Separate Quality Agent

**What people do:** Create a new `gsd-quality-checker` agent that spawns between executor tasks to validate code.

**Why it's wrong:** A separate agent requires full context handoff — the orchestrator must pass the executor's task results to the quality agent, run it, collect results, and pass them back. This adds ~50-100K tokens of orchestrator overhead per task and breaks the "lean orchestrators" principle that keeps the main context at 10-15%.

**Do this instead:** Inline quality sentinel within the executor agent. The executor already has task context loaded — gates run in the same context window at near-zero handoff cost.

---

### Anti-Pattern 2: Full Codebase Scan on Each Task

**What people do:** Run `grep -r "pattern" src/` across the entire source tree for every pre-task scan.

**Why it's wrong:** A full grep on a large codebase produces thousands of lines of output that consume context budget. For a project with 500 TypeScript files, an unfiltered grep can return 5,000+ lines — instantly consuming 15-25K tokens of executor context, triggering quality degradation before the task even starts.

**Do this instead:** Targeted scans limited by (a) search term derived from task's domain, (b) output line cap (`| head -10`), (c) file-list mode first (`-l` flag) then read only relevant files. The planner's quality directives further narrow the scan by pre-identifying relevant files.

---

### Anti-Pattern 3: Verification Quality Checks as Blocking in All Modes

**What people do:** Make Step 7b quality findings always block `status: passed`.

**Why it's wrong:** Quality issues like "no test file for this utility" may be intentional in a rapid-prototyping project. Hard-blocking all phases on quality forces users who want `fast` mode to disable the entire verifier, not just the quality checks.

**Do this instead:** Step 7b findings map to severity based on config level. In `strict`: duplication and missing tests are `gaps_found` blockers. In `standard`: they are warnings in the report but don't change status. In `fast`: Step 7b is skipped entirely. Verifier reads `QUALITY_CFG` at the same startup step it reads other config.

---

### Anti-Pattern 4: Context7 on Every Import

**What people do:** Resolve and query Context7 for every imported library in every task.

**Why it's wrong:** A task that imports React, a utility function, and lodash does not need Context7 docs for all three. React patterns are established in the codebase (CONVENTIONS.md covers them), utility functions are local, and lodash usage is trivial. Querying Context7 for all three adds ~15-20K tokens of overhead for zero quality benefit.

**Do this instead:** Context7 queries are triggered by specific conditions: (a) first use of a library in this session, (b) using a library API that could have changed (auth, ORM, HTTP clients), (c) implementing something the PROPOSAL explicitly flagged as "don't hand-roll" (auth, validation, date handling, state management). Config `standard` mode: query on new deps only. Config `fast` mode: skip all Context7 queries in executor.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Planner → Executor | PLAN.md file (static artifact) | Quality directives embedded in `<action>` fields; executor reads at startup |
| Executor → Verifier | SUMMARY.md + committed files | Verifier reads key-files from SUMMARY.md frontmatter to scope quality checks |
| Config → All Agents | `config-get quality.level` via gsd-tools | Agents read config at startup; no runtime config changes during agent run |
| Executor → Context7 | `mcp__context7__*` MCP calls | Calls made inline during quality_sentinel pre-task step; results used immediately in same context |
| Plan-Checker → Planner | Structured issues YAML returned to orchestrator | Revision loop unchanged; Dimension 9 issues follow same format as existing dimensions |

### External Service Integration

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Context7 MCP | `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` | Added to executor's tools list in frontmatter; already used by planner and phase-researcher — same pattern |
| gsd-tools CLI | `config-get quality.level` | New config key read via existing CLI; no new CLI commands needed |

---

## Scaling Considerations

This is an agent orchestration system, not a web application. "Scaling" here means: what happens as projects grow larger?

| Concern | Small Project (<50 files) | Medium Project (50-500 files) | Large Project (500+ files) |
|---------|--------------------------|-------------------------------|---------------------------|
| Pre-task codebase scan | Negligible context cost | Moderate — output caps critical | High — output caps essential; consider STRUCTURE.md pre-loaded context |
| Context7 queries per session | All libraries new — high query rate | Established libraries known — lower rate | Same as medium; most libraries stable |
| Verifier Step 7b quality checks | Fast — few files per phase | Moderate — files from SUMMARY.md limit scope | Acceptable — verifier only scans phase files, not full codebase |
| Config fast mode value | Low (small projects can afford strict) | Medium | High — large projects likely need targeted quality, not blanket strict |

### Scaling Notes

1. **First bottleneck:** Pre-task codebase scan context cost on large projects. Fix: planner quality directives pre-identify relevant files, eliminating executor's need to grep broadly.
2. **Second bottleneck:** Context7 query rate in early phases when all libraries are "new." Fix: gsd-codebase-mapper's STACK.md documents existing library patterns — executor can check STACK.md first, only query Context7 for patterns not documented there.

---

## Sources

- Direct analysis of `agents/gsd-executor.md` — execution flow, deviation rules, task commit protocol, tool list
- Direct analysis of `agents/gsd-verifier.md` — 3-level artifact verification, anti-pattern detection, step structure
- Direct analysis of `agents/gsd-planner.md` — task anatomy, quality degradation curve, context budget rules, discovery levels
- Direct analysis of `agents/gsd-plan-checker.md` — 8 verification dimensions including Dimension 8 (Nyquist), scope sanity thresholds
- Direct analysis of `agents/gsd-phase-researcher.md` — Context7 tool strategy, Validation Architecture section
- Direct analysis of `agents/gsd-codebase-mapper.md` — codebase analysis approach, doc types produced
- Direct analysis of `agents/gsd-integration-checker.md` — cross-phase wiring verification scope
- `.planning/PROJECT.md` — constraints, out-of-scope items, key decisions, bug list
- `PROPOSAL.md` — gap analysis, proposed changes with code sketches, expected outcomes, risk assessment
- **Confidence: HIGH** — all findings from direct source file analysis, no inference required

---

*Architecture research for: GSD quality enforcement layer — agent orchestration system*
*Researched: 2026-02-23*
