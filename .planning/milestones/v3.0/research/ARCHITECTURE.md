# Architecture Research

**Domain:** Tech debt tracking system + CLI debt logging + agent wiring + /gsd:fix-debt skill + project migration tool — integrated into GSD Enhanced Fork v3.0
**Researched:** 2026-02-25
**Confidence:** HIGH (direct codebase inspection of all affected modules, no training-data guesswork)

---

## System Overview

The existing system has a layered structure. The three v3.0 features slot into specific layers without architectural displacement:

```
┌───────────────────────────────────────────────────────────────────┐
│                       Command Layer                               │
│  commands/gsd/debug.md    commands/gsd/set-quality.md            │
│  [NEW] commands/gsd/fix-debt.md                                   │
├───────────────────────────────────────────────────────────────────┤
│                      Workflow Layer                               │
│  workflows/execute-phase.md   workflows/plan-phase.md  etc.      │
│  (no new workflow files needed for v3.0)                          │
├───────────────────────────────────────────────────────────────────┤
│                       Agent Layer                                 │
│  agents/gsd-executor.md    agents/gsd-verifier.md               │
│  agents/gsd-debugger.md                                          │
│  [MODIFY all three to wire debt logging]                          │
├───────────────────────────────────────────────────────────────────┤
│                       CLI Layer                                   │
│  get-shit-done/bin/gsd-tools.cjs  (CLI router)                   │
│  [MODIFY: add 'debt' case + 'migrate' case to switch]            │
├───────────────────────────────────────────────────────────────────┤
│                    Module Layer (bin/lib/)                        │
│  core.cjs  state.cjs  config.cjs  phase.cjs  roadmap.cjs        │
│  milestone.cjs  verify.cjs  init.cjs  template.cjs  etc.        │
│  [NEW] debt.cjs   [NEW] migrate.cjs                              │
│  [MODIFY] roadmap.cjs (INTEGRATION-4)                            │
│  [MODIFY] init.cjs (INTEGRATION-3)                               │
├───────────────────────────────────────────────────────────────────┤
│                   File-State Layer (.planning/)                   │
│  STATE.md  ROADMAP.md  REQUIREMENTS.md  config.json  TO-DOS.md  │
│  debug/  (existing)                                              │
│  [NEW] DEBT.md   (per planningRoot — milestone-scoped aware)     │
└───────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### New Components (v3.0)

| Component | Type | Responsibility |
|-----------|------|----------------|
| `DEBT.md` | File-state | Central hub of all logged tech debt entries. Structured Markdown, machine-readable. Lives at `planningRoot(cwd, milestoneScope)/DEBT.md` |
| `debt.cjs` | Module | CLI operations: `debt log`, `debt list`, `debt resolve`. Reads/writes DEBT.md using regex-on-Markdown pattern matching existing codebase conventions |
| `migrate.cjs` | Module | Inspects `.planning/` layout, applies migration rules to bring a project folder to current spec. One-shot idempotent operation |
| `commands/gsd/fix-debt.md` | Command (skill) | Orchestrator skill for on-demand debt resolution via debugger-driven investigation loop |

### Modified Components (v3.0)

| Component | Change | Scope |
|-----------|--------|-------|
| `gsd-tools.cjs` | Add `debt` and `migrate` command cases to the main `switch` router | 2 new `case` blocks, ~20 lines each |
| `agents/gsd-executor.md` | Add `<debt_logging>` instruction inside existing `<quality_sentinel>` post-task protocol | ~20-line additive section |
| `agents/gsd-verifier.md` | Add debt-logging instruction for unresolvable gaps discovered during verification | ~15-line additive section |
| `agents/gsd-debugger.md` | Add debt-logging instruction when root cause is a confirmed known-workaround | ~10-line additive section inside `fix_and_verify` step |
| `get-shit-done/bin/lib/roadmap.cjs` | INTEGRATION-4 fix: add `milestoneScope` param to `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze`, use `planningRoot()` for path | Lines ~10 and ~94 |
| `get-shit-done/bin/lib/init.cjs` | INTEGRATION-3 fix: replace hardcoded `.planning/STATE.md` etc. with `planningRoot()`-derived paths in `cmdInitPlanPhase` | Lines ~138-140 |
| `get-shit-done/bin/gsd-tools.cjs` | INTEGRATION-4 fix: pass `milestoneScope` to `roadmap.cmdRoadmapGetPhase` and `roadmap.cmdRoadmapAnalyze` | Lines ~436-438 |

---

## Recommended Project Structure (New Files Only)

```
get-shit-done/
├── bin/
│   ├── gsd-tools.cjs           # MODIFY: add debt + migrate command cases
│   └── lib/
│       ├── debt.cjs            # NEW: DEBT.md CRUD operations
│       └── migrate.cjs         # NEW: .planning/ layout migration tool

agents/
├── gsd-executor.md             # MODIFY: add debt-log instruction post-task
├── gsd-verifier.md             # MODIFY: add debt-log instruction for gaps
└── gsd-debugger.md             # MODIFY: add debt-log instruction at fix step

commands/gsd/
└── fix-debt.md                 # NEW: /gsd:fix-debt orchestrator skill

get-shit-done/templates/
└── DEBT.md                     # NEW: template for debt hub (mirrors STATE.md template)

tests/
└── debt.test.cjs               # NEW: debt.cjs + migrate.cjs unit tests
```

The `DEBT.md` file itself lives in the user's project at runtime (`.planning/DEBT.md` for legacy projects, `.planning/milestones/<version>/DEBT.md` for milestone-scoped projects). The template lives in the framework source tree and is used to initialize DEBT.md when it does not exist.

---

## Architectural Patterns

### Pattern 1: Module + CLI Router (Established — Follow Exactly)

**What:** New capability = new `lib/*.cjs` module + new `case` in the `gsd-tools.cjs` `switch`. Never add business logic directly in the router.

**When to use:** Every new gsd-tools command follows this pattern. The entire lib/ directory demonstrates it: `state.cjs`, `config.cjs`, `roadmap.cjs`, `milestone.cjs`, `verify.cjs`, `init.cjs` all follow the same shape.

**Trade-offs:** Slightly more boilerplate (export functions + wire in router), but enables unit testing of modules in isolation without spawning the CLI process. The existing test suite (8 test files, 232 passing) relies entirely on this boundary.

**debt.cjs pattern:**
```javascript
// get-shit-done/bin/lib/debt.cjs
const fs = require('fs');
const path = require('path');
const { output, error, planningRoot } = require('./core.cjs');

function cmdDebtLog(cwd, milestoneScope, opts, raw) {
  const root = planningRoot(cwd, milestoneScope);
  const debtPath = path.join(root, 'DEBT.md');
  // append structured entry, output { logged: true, id: 'DEBT-007' }
}

function cmdDebtList(cwd, milestoneScope, opts, raw) { /* ... */ }
function cmdDebtResolve(cwd, milestoneScope, id, opts, raw) { /* ... */ }

module.exports = { cmdDebtLog, cmdDebtList, cmdDebtResolve };
```

**Router wiring (gsd-tools.cjs):**
```javascript
case 'debt': {
  const debt = require('./lib/debt.cjs');
  const subcommand = args[1];
  if (subcommand === 'log') {
    const descIdx = args.indexOf('--description');
    const sevIdx = args.indexOf('--severity');
    const catIdx = args.indexOf('--category');
    const srcIdx = args.indexOf('--source');
    debt.cmdDebtLog(cwd, milestoneScope, {
      description: descIdx !== -1 ? args[descIdx + 1] : null,
      severity: sevIdx !== -1 ? args[sevIdx + 1] : 'medium',
      category: catIdx !== -1 ? args[catIdx + 1] : 'implementation',
      source: srcIdx !== -1 ? args[srcIdx + 1] : null,
    }, raw);
  } else if (subcommand === 'list') {
    const statusIdx = args.indexOf('--status');
    debt.cmdDebtList(cwd, milestoneScope, {
      status: statusIdx !== -1 ? args[statusIdx + 1] : 'open',
    }, raw);
  } else if (subcommand === 'resolve') {
    const debtId = args[2];
    const commitIdx = args.indexOf('--commit');
    debt.cmdDebtResolve(cwd, milestoneScope, debtId, {
      commit: commitIdx !== -1 ? args[commitIdx + 1] : null,
    }, raw);
  } else {
    error('Unknown debt subcommand. Available: log, list, resolve');
  }
  break;
}
```

### Pattern 2: planningRoot() for All File Paths (Non-Negotiable)

**What:** Every path to a `.planning/` file must go through `planningRoot(cwd, milestoneScope)`. No hardcoded `.planning/` strings in new code.

**When to use:** Always. In every new module. The existing INTEGRATION-3 and INTEGRATION-4 bugs are direct consequences of violating this pattern. Adding a third violation in v3.0 would be a regression.

**Trade-offs:** None. This is a correctness requirement. Hardcoded paths silently read the wrong file for milestone-scoped projects.

**Example:**
```javascript
// CORRECT
const root = planningRoot(cwd, milestoneScope);
const debtPath = path.join(root, 'DEBT.md');

// WRONG — silently breaks milestone-scoped projects
const debtPath = path.join(cwd, '.planning', 'DEBT.md');
```

### Pattern 3: Agent Instruction Injection (Additive, Section-Tagged)

**What:** Modifications to agent `.md` files are added as new XML-tagged sections appended to existing named sections. Never replace existing content — only add.

**When to use:** Wiring executor, verifier, and debugger agents to emit debt log calls.

**Trade-offs:** Each new section costs context tokens on every agent spawn. Keep additions minimal (under 25 lines each). Use conditional phrasing ("only log when a shortcut was taken") to prevent noise.

**Example (executor debt logging addition):**
```xml
<debt_logging>
After completing any task where a known shortcut, workaround, or incomplete
solution was applied, log it before committing:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt log \
  --description "brief description of the shortcut or gap" \
  --severity medium \
  --category implementation \
  --source "phase-${PHASE_NUMBER} plan-${PLAN_NUMBER}"
```

Only log when actual debt exists. Do not log for clean implementations.
</debt_logging>
```

### Pattern 4: Command Skill as Lean Orchestrator (Follow /gsd:debug Pattern)

**What:** `/gsd:fix-debt` is a command file in `commands/gsd/fix-debt.md` that acts as a lean orchestrator — reads DEBT.md entries, presents options, spawns `gsd-debugger` with debt context, handles the return, marks debt resolved.

**When to use:** Any on-demand user-facing skill that requires an investigate-fix cycle. The `commands/gsd/debug.md` file is the canonical model: 160 lines, purely orchestration, zero code changes, spawns Task() for all real work.

**Trade-offs:** Adds a new slash-command entry point. Overhead is minimal since orchestrators stay at 10-15% context (the established GSD principle).

**fix-debt.md structure:**
```markdown
---
name: gsd:fix-debt
description: Investigate and resolve tracked tech debt items
argument-hint: [debt-id or description]
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
---

<process>
## 1. Load Debt Registry
node gsd-tools.cjs debt list --status open

## 2. Select Target
If $ARGUMENTS matches a DEBT-NNN ID: use it directly.
Else if $ARGUMENTS is text: find matching entry by description.
Else: display open items, ask user to pick via AskUserQuestion.

## 3. Spawn gsd-debugger
Pass debt entry as investigation context with symptoms_prefilled: true.
goal: find_and_fix

## 4. Handle Return
On DEBUG COMPLETE: node gsd-tools.cjs debt resolve DEBT-NNN --commit <hash>
On ROOT CAUSE FOUND (no fix): present to user, offer plan-phase --gaps
On CHECKPOINT REACHED: spawn continuation agent (same as debug.md pattern)
</process>
```

### Pattern 5: Regex-on-Markdown for File Operations (Established — Match Existing Code)

**What:** DEBT.md is read and written using regex pattern matching on Markdown content. No YAML frontmatter, no JSON, no AST parsing.

**When to use:** All file operations in `debt.cjs`. This matches how `roadmap.cjs`, `state.cjs`, and `milestone.cjs` all operate on their respective Markdown files.

**Trade-offs:** Less structured than JSON/YAML but consistent with the whole codebase. Regex-on-Markdown is maintainable as long as the file structure is stable (which it is — DEBT.md has a defined schema).

**Example:**
```javascript
// Read open entries: match ### DEBT-NNN headers in ## Open section
const openSectionMatch = content.match(/## Open\n([\s\S]*?)(?=## Resolved|$)/);
const entryPattern = /### (DEBT-\d+)\n([\s\S]*?)(?=### DEBT-|\n## |$)/g;

// Append new entry (same pattern as state.cjs adding blockers)
const newEntry = `### ${newId}\n- **Description:** ${opts.description}\n...`;
const updatedContent = content.replace(
  /## Open\n/,
  `## Open\n\n${newEntry}\n`
);
```

---

## Data Flow

### Debt Logging Flow (Executor Path)

```
gsd-executor agent executes task
    |
    ↓ (shortcut or workaround applied)
agent runs: node gsd-tools.cjs debt log --description "..." --severity medium --source "phase-3 plan-2"
    |
    ↓
CLI router → debt.cjs:cmdDebtLog(cwd, milestoneScope, opts, raw)
    |
    ↓ resolves path via planningRoot(cwd, milestoneScope)
DEBT.md ← appends structured entry with sequential ID, timestamp, source, severity
    |
    ↓
output({ logged: true, id: "DEBT-007" }) printed to stdout
agent sees confirmation, proceeds to commit
```

### Debt Resolution Flow (/gsd:fix-debt Path)

```
User: /gsd:fix-debt DEBT-007
    |
    ↓
commands/gsd/fix-debt.md (orchestrator)
    |
    ↓ node gsd-tools.cjs debt list --status open
DEBT.md → structured list of open entries printed
    |
    ↓ orchestrator selects DEBT-007, constructs debugger prompt
    ↓ spawns Task(subagent_type="gsd-debugger", symptoms_prefilled=true)
gsd-debugger agent investigates, applies fix, returns DEBUG COMPLETE
    |
    ↓ orchestrator receives DEBUG COMPLETE with commit hash
    ↓ node gsd-tools.cjs debt resolve DEBT-007 --commit abc1234
DEBT.md ← entry moved to ## Resolved section, timestamp + commit recorded
```

### Migration Flow

```
User runs: node gsd-tools.cjs migrate [--dry-run]
    |
    ↓
CLI router → migrate.cjs:cmdMigrate(cwd, { dryRun }, raw)
    |
    ├─ detectLayoutStyle(cwd) → 'legacy' | 'milestone-scoped' | 'uninitialized'
    ├─ reads .planning/ directory structure
    ├─ checks each migration condition (idempotent — skip if already satisfied):
    │   ├─ config.json has quality block? if not → add it (reuse config.cjs logic)
    │   ├─ config.json has context7_token_cap? if not → add it
    │   ├─ DEBT.md exists at planningRoot? if not → create from template
    │   └─ (future conditions as spec evolves)
    |
    ↓ dry-run: reports what would change without writing
    ↓ normal: applies changes, reports what was done
output({ migrated: true, changes: [...] }, raw, summary_string)
```

### INTEGRATION-3 Fix Data Flow

```
cmdInitPlanPhase(cwd, phase, raw, milestoneScope)
    |
    ↓ [BEFORE FIX]: returns hardcoded strings
    │   state_path: '.planning/STATE.md'           ← always root, ignores milestone
    │   roadmap_path: '.planning/ROADMAP.md'       ← always root, ignores milestone
    │   requirements_path: '.planning/REQUIREMENTS.md'
    |
    ↓ [AFTER FIX]:
    const root = planningRoot(cwd, milestoneScope);
    state_path = path.relative(cwd, path.join(root, 'STATE.md'))
    roadmap_path = path.relative(cwd, path.join(root, 'ROADMAP.md'))
    requirements_path = path.relative(cwd, path.join(root, 'REQUIREMENTS.md'))
    └─ for legacy: '.planning/STATE.md' (same as before — backward compatible)
    └─ for milestone-scoped: '.planning/milestones/v3.0/STATE.md' (correct)
```

### INTEGRATION-4 Fix Data Flow

```
gsd-tools.cjs router receives: roadmap get-phase 3 --milestone v3.0
    |
    ↓ [BEFORE FIX]: milestoneScope parsed but never passed to roadmap module
    │   roadmap.cmdRoadmapGetPhase(cwd, args[2], raw)  ← drops milestoneScope
    │   inside cmdRoadmapGetPhase: hardcodes '.planning/ROADMAP.md'
    │   reads WRONG file for milestone-scoped projects
    |
    ↓ [AFTER FIX]:
    roadmap.cmdRoadmapGetPhase(cwd, args[2], raw, milestoneScope)  ← pass it
    inside cmdRoadmapGetPhase:
      const roadmapPath = path.join(planningRoot(cwd, milestoneScope), 'ROADMAP.md')
    └─ reads correct file for both legacy and milestone-scoped projects
```

---

## DEBT.md Schema

The central hub is structured Markdown with two required anchor sections and a consistent entry format:

```markdown
# Tech Debt Registry

<!-- Entries managed by gsd-tools debt commands. ID sequence is append-only. -->

## Open

### DEBT-001
- **Description:** Auth token refresh hand-rolled instead of using jose library
- **Severity:** medium
- **Category:** implementation
- **Source:** phase-3 plan-2 task-1
- **Logged:** 2026-02-25T14:30:00Z
- **Status:** open

## Resolved

### DEBT-002
- **Description:** Hardcoded timeout of 5000ms, should come from config
- **Severity:** low
- **Category:** configuration
- **Source:** phase-2 plan-1 task-3
- **Logged:** 2026-02-20T09:00:00Z
- **Resolved:** 2026-02-25T16:45:00Z
- **Commit:** abc1234
- **Status:** resolved
```

**Design decisions:**
- IDs are sequential (`DEBT-001`, `DEBT-002`) — human-readable and stable as CLI arguments
- `planningRoot(cwd, milestoneScope)` determines file location — milestone-scoped projects get per-milestone debt registries (debt is scoped to where it was introduced)
- `## Open` and `## Resolved` are required anchors for the CLI parser
- Machine-parseable via regex on `### DEBT-NNN` headers and `- **Key:** value` lines — no YAML frontmatter needed, consistent with how `state.cjs` and `roadmap.cjs` operate
- `resolve` moves entry from `## Open` to `## Resolved` (append to resolved section, remove from open section)

---

## Integration Points

### Internal Module Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `gsd-tools.cjs` → `debt.cjs` | `require('./lib/debt.cjs')` | Same require pattern as all other lib modules |
| `gsd-tools.cjs` → `migrate.cjs` | `require('./lib/migrate.cjs')` | Same require pattern |
| `debt.cjs` → `core.cjs` | Imports `planningRoot`, `output`, `error` | Standard dependency on core utilities |
| `migrate.cjs` → `core.cjs` | Imports `planningRoot`, `detectLayoutStyle`, `loadConfig` | Standard dependency |
| `migrate.cjs` → `config.cjs` | Calls `cmdConfigEnsureSection` logic or imports its helpers | Reuse existing migration logic for quality block |
| `gsd-executor.md` → CLI | `node gsd-tools.cjs debt log ...` (bash subprocess call) | Same pattern as existing `state update`, `verify-summary` calls |
| `gsd-verifier.md` → CLI | `node gsd-tools.cjs debt log ...` (bash subprocess call) | Same pattern |
| `gsd-debugger.md` → CLI | `node gsd-tools.cjs debt log ...` (bash subprocess call) | Same pattern |
| `fix-debt.md` → CLI | `node gsd-tools.cjs debt list`, `debt resolve` (bash calls) | Same pattern as `debug.md` uses `state load` |
| `fix-debt.md` → `gsd-debugger` | `Task(subagent_type="gsd-debugger", ...)` | Identical to `commands/gsd/debug.md` spawn pattern |

### Agent Wiring Integration Points

| Agent | Where to Wire | What to Add | Condition |
|-------|---------------|-------------|-----------|
| `gsd-executor.md` | Inside `<quality_sentinel>` post-task section | `<debt_logging>` section with bash call | "Only log when a shortcut was taken" |
| `gsd-verifier.md` | After gap discovery in verification process | Instruction to log unresolvable gaps | "Log if gap cannot be fixed in this phase" |
| `gsd-debugger.md` | In `fix_and_verify` step, before `archive_session` | Instruction to log if fix is a known workaround | "Log if fix is temporary or incomplete" |

### INTEGRATION-3 Fix — Exact Touch Points

| File | Line Range | Change |
|------|-----------|--------|
| `get-shit-done/bin/lib/init.cjs` | ~138-140 | Replace hardcoded `'.planning/STATE.md'` etc. with `path.relative(cwd, path.join(root, 'STATE.md'))` where `root = planningRoot(cwd, milestoneScope)` |
| Note | | `planning_root` is already computed at line ~144; refactor to compute it earlier and reuse |

### INTEGRATION-4 Fix — Exact Touch Points

| File | Lines | Change |
|------|-------|--------|
| `get-shit-done/bin/lib/roadmap.cjs` | ~10 | Add `milestoneScope` param to `cmdRoadmapGetPhase`; replace hardcoded `'.planning/ROADMAP.md'` with `path.join(planningRoot(cwd, milestoneScope), 'ROADMAP.md')` |
| `get-shit-done/bin/lib/roadmap.cjs` | ~94 | Add `milestoneScope` param to `cmdRoadmapAnalyze`; same path fix |
| `get-shit-done/bin/gsd-tools.cjs` | ~436 | Update `roadmap get-phase` dispatch: pass `milestoneScope` as 4th arg |
| `get-shit-done/bin/gsd-tools.cjs` | ~438 | Update `roadmap analyze` dispatch: pass `milestoneScope` as 3rd arg |

---

## Build Order (Dependency Graph)

Dependencies flow strictly downward. Build in this order:

```
Phase 1: Integration Fixes (no deps on v3.0 code, unblocks milestone-scoped testing)
    INTEGRATION-3: init.cjs cmdInitPlanPhase path fix
    INTEGRATION-4: roadmap.cjs milestoneScope param + gsd-tools.cjs router fix
    Tests: update routing.test.cjs and init.test.cjs for milestone-scoped correctness
    ↓
Phase 2: Core Debt Module (depends on core.cjs only)
    get-shit-done/templates/DEBT.md (template file)
    get-shit-done/bin/lib/debt.cjs (cmdDebtLog, cmdDebtList, cmdDebtResolve)
    gsd-tools.cjs 'debt' case wiring
    tests/debt.test.cjs (debt.cjs unit tests)
    ↓
Phase 3: Migration Tool (depends on config.cjs + core.cjs)
    get-shit-done/bin/lib/migrate.cjs (cmdMigrate with --dry-run flag)
    gsd-tools.cjs 'migrate' case wiring
    tests/debt.test.cjs or separate migrate.test.cjs
    ↓
Phase 4: Agent Wiring (depends on debt.cjs CLI being available and tested)
    agents/gsd-executor.md: add <debt_logging> section
    agents/gsd-verifier.md: add debt logging instruction
    agents/gsd-debugger.md: add debt logging at fix step
    ↓
Phase 5: /gsd:fix-debt Skill (depends on debt.cjs + debugger wiring)
    commands/gsd/fix-debt.md (orchestrator skill)
```

**Rationale:**
- Integration fixes first because they unblock correct behavior for all subsequent milestone-scoped testing. Debt.cjs itself needs `planningRoot()` to work correctly for milestone-scoped projects, which requires INTEGRATION-4's roadmap fix to be testable end-to-end.
- `debt.cjs` before agent wiring: agents call the CLI subprocess, so the CLI command must exist and be tested before agents invoke it.
- Migration tool before agent wiring: `migrate.cjs` can be tested in complete isolation; no dependency on agents.
- Agent wiring before `/gsd:fix-debt`: the skill reads DEBT.md entries that agents write; the write path must exist first.
- `/gsd:fix-debt` last: pure orchestrator, all its dependencies (debt CLI + debugger agent) must exist first.

---

## Anti-Patterns

### Anti-Pattern 1: Hardcoded `.planning/` Paths in New Modules

**What people do:** `path.join(cwd, '.planning', 'DEBT.md')` in new module code.

**Why it's wrong:** Silently reads the wrong file for milestone-scoped projects. INTEGRATION-3 and INTEGRATION-4 exist because of exactly this mistake in previously-written code. Adding a third instance in v3.0 would be a direct regression of the v2.0 architecture contract.

**Do this instead:** `const root = planningRoot(cwd, milestoneScope); const debtPath = path.join(root, 'DEBT.md');`

### Anti-Pattern 2: Business Logic in the CLI Router

**What people do:** Put file I/O, parsing logic, or computation inside the `case 'debt':` block in `gsd-tools.cjs`.

**Why it's wrong:** The router cannot be unit-tested without spawning a child process. The entire test suite (8 files, 232 tests) relies on testing module functions directly via `require('../get-shit-done/bin/lib/debt.cjs')`. Logic in the router bypasses this test boundary.

**Do this instead:** All logic in `lib/debt.cjs`. Router only parses flags and calls module functions. Target: 10-15 lines per case in the router.

### Anti-Pattern 3: Monolithic DEBT.md Parser

**What people do:** Write a full Markdown AST parser or YAML-based structure for DEBT.md.

**Why it's wrong:** The existing codebase uses lightweight regex for all Markdown file operations (see `roadmap.cjs` lines 320-350, `state.cjs` blockers, `milestone.cjs` requirements). Introducing a new dependency or parsing strategy creates an inconsistency that future maintainers must track.

**Do this instead:** Regex-on-Markdown matching the existing pattern. Parse `### DEBT-NNN` headers and `- **Key:** value` lines. Append new entries as string blocks. Exact same approach as `state.cjs` appending blockers.

### Anti-Pattern 4: Unconditional Debt Logging in Agent Instructions

**What people do:** Agent instructions log a debt entry after every single task as a safety measure.

**Why it's wrong:** DEBT.md becomes noise — hundreds of entries for non-debt executions. The signal value of the registry disappears. The `/gsd:fix-debt` skill would present an unmanageable list to the user.

**Do this instead:** Agent instructions must be explicitly conditional: "If a shortcut, workaround, or incomplete solution was applied, log it. If the implementation is clean and complete, do not log."

### Anti-Pattern 5: /gsd:fix-debt Directly Modifying Code

**What people do:** Make `fix-debt.md` contain implementation logic that reads files, forms hypotheses, and writes fixes.

**Why it's wrong:** Violates the established pattern that commands are orchestrators only. The `commands/gsd/debug.md` precedent is clear: orchestrators spawn Task() for all real work. Commands that mix orchestration and implementation burn context on the orchestrator side and cannot benefit from fresh 200K subagent contexts.

**Do this instead:** `fix-debt.md` selects debt items and constructs the investigation prompt, then spawns `gsd-debugger`. All code investigation and changes happen inside the spawned agent.

### Anti-Pattern 6: Per-Milestone Debt Commands Without milestoneScope

**What people do:** Call `node gsd-tools.cjs debt log ...` from inside a milestone-scoped workflow without the `--milestone` flag.

**Why it's wrong:** Logs debt to the root `.planning/DEBT.md` instead of the milestone workspace. Debt from v3.0 work appears in the wrong registry. In milestone-scoped projects this is especially confusing because `.planning/DEBT.md` may not even exist.

**Do this instead:** Workflow orchestrators that know their `MILESTONE_FLAG` must pass it to all `gsd-tools` calls including `debt log`. The agent wiring instructions should use `${MILESTONE_FLAG}` in the bash template, same as all other workflow commands.

---

## Scaling Considerations

This is a CLI orchestration tool, not a web service. "Scaling" here means project size and debt volume.

| Concern | Mitigation |
|---------|------------|
| DEBT.md grows large over time | `debt list --status open` filters; resolved entries remain for audit history |
| Milestone-scoped projects accumulate per-milestone DEBT.md files | Correct by design — debt is scoped to where it was introduced; `debt list` in a milestone context shows only that milestone's debt |
| Migration tool applied to large `.planning/` dirs | O(n) file scan, no external calls, idempotent — safe to run repeatedly |
| Sequential IDs in DEBT.md across concurrent milestones | Each milestone's DEBT.md has its own ID sequence (DEBT-001 in v3.0 and DEBT-001 in v3.1 are different items in different files — no global collision) |

---

## Sources

- Direct codebase inspection: `/Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs` — full router pattern, existing command cases
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs` — `planningRoot()`, `detectLayoutStyle()`, `output()`, `error()`
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/config.cjs` — `cmdConfigEnsureSection` migration pattern (model for migrate.cjs)
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/agents/gsd-executor.md` — `<quality_sentinel>` section structure, post-task protocol
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/agents/gsd-verifier.md` — verification process structure, gap reporting
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/agents/gsd-debugger.md` — `fix_and_verify` step, `archive_session` step
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/commands/gsd/debug.md` — canonical orchestrator command pattern (model for fix-debt.md)
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/.planning/TO-DOS.md` — INTEGRATION-3 and INTEGRATION-4 exact fix specifications with line numbers
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/.planning/PROJECT.md` — v3.0 target features, constraints, key decisions
- Direct codebase inspection: `/Users/tmac/Projects/gsdup/tests/helpers.cjs` — test pattern: `require('../get-shit-done/bin/lib/...')` for module-level testing

---

*Architecture research for: GSD v3.0 Tech Debt System + Migration Tool*
*Researched: 2026-02-25*
