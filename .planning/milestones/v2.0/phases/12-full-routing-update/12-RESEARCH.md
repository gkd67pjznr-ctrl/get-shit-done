# Phase 12: Full Routing Update - Research

**Researched:** 2026-02-24
**Domain:** Node.js CLI routing, workflow file editing, documentation
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-01 | All workflow files pass `--milestone` to gsd-tools.cjs calls when in milestone-scoped mode | Workflow files use hardcoded paths; need conditional `--milestone` threading based on `layout_style` from init |
| ROUTE-02 | All init commands return milestone-scoped paths when `--milestone` is provided | `cmdInitPhaseOp`, `cmdInitVerifyWork`, `cmdInitProgress`, `cmdInitResume`, `cmdInitMilestoneOp` currently don't accept `milestoneScope` param |
| ROUTE-03 | `/gsd:progress`, `/gsd:health`, `/gsd:complete-milestone`, `/gsd:resume-work` updated to be milestone-aware | Progress already has `cmdProgressRenderMulti` (Phase 11 complete); health, complete-milestone, resume-project need layout_style awareness |
| ROUTE-04 | Canonical path variable glossary committed as reference before workflow/agent editing begins | No glossary exists; all path variable names used in init JSON results need to be defined in one place |
| ROUTE-05 | Agent specs remain unchanged — paths flow through `<files_to_read>` from orchestrators | Confirmed: agent specs read files_to_read blocks provided by orchestrators — no agent file changes needed |
| PHASE-01 | Phase numbering resets to 01 per milestone (not global sequential) | `cmdPhaseComplete` reads `.planning/phases/` with no milestone awareness — needs milestoneScope to route to correct phases dir |
| PHASE-02 | Cross-milestone phase references use qualified format `<version>/phase-<NN>` | This is a documentation/convention requirement; no code changes needed, only glossary + documentation |
| PHASE-03 | `phase-complete` command accepts `--milestone` flag and routes to milestone-scoped phase folder | CLI router already strips `--milestone` but doesn't pass `milestoneScope` to `phase.cmdPhaseComplete` |
| TEAM-01 | Research findings documented — Agent Teams recommended for intra-milestone parallel phases, not inter-milestone concurrency | Requires writing a documentation file (e.g., `.planning/docs/agent-teams.md` or a references file) |

</phase_requirements>

---

## Summary

Phase 12 is a **wiring and documentation phase**, not a net-new feature phase. All foundational building blocks are in place from Phases 8-11: `planningRoot()`, `detectLayoutStyle()`, `--milestone` CLI flag parsing, `cmdInitExecutePhase`/`cmdInitPlanPhase` already accept `milestoneScope`, `cmdMilestoneWriteStatus`/`cmdManifestCheck` are implemented, `cmdProgressRenderMulti` is wired. What remains is threading `milestoneScope` through the remaining init commands, passing `--milestone` in workflow files when `layout_style === "milestone-scoped"`, making `phase complete` milestone-aware, and producing documentation artifacts.

The work divides cleanly into three areas: (1) **CLI layer** — extend milestoneScope to 8 remaining init commands and `phase complete` in gsd-tools.cjs, (2) **workflow layer** — update workflows to conditionally pass `--milestone` flag through gsd-tools.cjs calls, and (3) **documentation layer** — write the canonical path variable glossary and Agent Teams findings. There is no new infrastructure to build.

The critical design insight from Phase 8 decisions: `milestoneScope` flows as an explicit parameter from the CLI router through to init functions, and all path-returning functions call `planningRoot(cwd, milestoneScope)` rather than hardcoding `.planning/`. The pattern is already proven in `cmdInitExecutePhase` and `cmdInitPlanPhase` — Phase 12 replicates it for the remaining commands.

**Primary recommendation:** Implement in two plans: Plan 1 threads `milestoneScope` through remaining init commands and `phase complete` in the CLI/lib layer; Plan 2 updates workflow files and produces the glossary and TEAM-01 documentation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | Node 20+ | fs, path, process.argv | Already the only dependency; no external libraries in gsd-tools.cjs |
| Node.js `--test` runner | Node 20+ | Running tests | Already used in `npm test` script |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tests/helpers.cjs` | project-local | `createTempProject()`, `runGsdTools()`, `runGsdToolsFull()` | All test cases; established pattern from Phases 8-11 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit milestoneScope param threading | Global state / env variable | Global state breaks concurrent sessions — established architectural decision from Phase 8 |

**Installation:**
No new packages needed. All changes are in existing `.cjs` files.

---

## Architecture Patterns

### Pattern 1: milestoneScope Threading (Existing — Extend)

**What:** Parse `--milestone` in gsd-tools.cjs main, pass as last param to init functions. Init functions call `planningRoot(cwd, milestoneScope)` for all path resolution.

**When to use:** Every init command that returns file paths or needs to know which milestone workspace to operate in.

**Example (already implemented in cmdInitExecutePhase):**
```javascript
// Source: get-shit-done/bin/lib/init.cjs lines 10, 80-84
function cmdInitExecutePhase(cwd, phase, raw, milestoneScope) {
  // ...
  return {
    milestone_scope: milestoneScope || null,
    planning_root: planningRoot(cwd, milestoneScope),
    layout_style: detectLayoutStyle(cwd),
    // file paths use planningRoot:
    state_path: path.join(planningRoot(cwd, milestoneScope), 'STATE.md'),
    // ...
  };
}
```

**Commands that still need this pattern applied:**
- `cmdInitPhaseOp(cwd, phase, raw)` → add `milestoneScope` param
- `cmdInitVerifyWork(cwd, phase, raw)` → add `milestoneScope` param
- `cmdInitProgress(cwd, raw)` → add `milestoneScope` param
- `cmdInitResume(cwd, raw)` → add `milestoneScope` param
- `cmdInitMilestoneOp(cwd, raw)` → add `milestoneScope` param (lower priority)
- `cmdInitNewMilestone(cwd, raw)` → layout_style detection only, milestoneScope not relevant
- `cmdPhaseComplete(cwd, phaseNum, raw)` → needs `milestoneScope` to resolve correct phases dir

**In gsd-tools.cjs router (lines 562-604), currently only 2 of 11 init cases pass milestoneScope:**
```javascript
// Currently:
case 'phase-op':
  init.cmdInitPhaseOp(cwd, args[2], raw);  // milestoneScope MISSING
  break;
// Should be:
case 'phase-op':
  init.cmdInitPhaseOp(cwd, args[2], raw, milestoneScope);
  break;
```

### Pattern 2: Workflow Conditional --milestone Threading

**What:** When `layout_style` from init is `"milestone-scoped"`, append `--milestone ${milestone_scope}` to subsequent gsd-tools.cjs calls.

**When to use:** Workflow steps that call gsd-tools.cjs with commands that use paths (phase, roadmap, state, requirements).

**Example pattern:**
```bash
# After init:
LAYOUT=$(echo "$INIT" | jq -r '.layout_style // "legacy"')
MILESTONE_FLAG=""
if [ "$LAYOUT" = "milestone-scoped" ]; then
  MILESTONE_SCOPE=$(echo "$INIT" | jq -r '.milestone_scope // empty')
  MILESTONE_FLAG="--milestone ${MILESTONE_SCOPE}"
fi

# Then:
COMPLETION=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs phase complete "${PHASE_NUMBER}" ${MILESTONE_FLAG})
```

**CRITICAL: ROUTE-05 constraint.** Agent specs are NOT modified. Only orchestrator workflow files pass `--milestone`. Agents receive file paths via `<files_to_read>` blocks from the orchestrator, so agents automatically read from the correct milestone workspace without needing `--milestone` themselves.

### Pattern 3: Canonical Path Variable Glossary (ROUTE-04)

**What:** A reference document at `get-shit-done/references/path-variables.md` that defines all init JSON fields related to paths, their meaning in legacy vs milestone-scoped layouts.

**Content structure:**
```markdown
# Path Variable Glossary

## Variables from init commands

| Variable | Source | Legacy value | Milestone-scoped value |
|----------|--------|-------------|------------------------|
| planning_root | init JSON | .planning/ | .planning/milestones/v2.0/ |
| layout_style | init JSON | "legacy" | "milestone-scoped" |
| milestone_scope | init JSON | null | "v2.0" |
| milestone_version | init JSON | "v1.0" (from ROADMAP) | "v2.0" (explicit) |
| state_path | init JSON | .planning/STATE.md | .planning/milestones/v2.0/STATE.md |
...
```

### Pattern 4: Phase Numbering — Disk-Based Reset (PHASE-01)

**What:** In milestone-scoped layout, each milestone's workspace has its own `phases/` directory. Phase numbers start at 01 per workspace naturally because each workspace has its own filesystem subtree. No code change needed for the reset behavior itself — it's an emergent property of workspace isolation.

**What DOES need code changes:** `cmdPhaseComplete` currently hardcodes `.planning/phases/` for directory listing. When called with `--milestone v2.0`, it must look at `.planning/milestones/v2.0/phases/` for phase discovery and `.planning/milestones/v2.0/ROADMAP.md` for roadmap updates.

**Pattern:**
```javascript
// get-shit-done/bin/lib/phase.cjs
function cmdPhaseComplete(cwd, phaseNum, raw, milestoneScope) {
  const root = planningRoot(cwd, milestoneScope);
  const roadmapPath = path.join(root, 'ROADMAP.md');
  const statePath = path.join(root, 'STATE.md');
  const phasesDir = path.join(root, 'phases');
  // ... rest unchanged
}
```

### Anti-Patterns to Avoid

- **Hardcoded `.planning/` strings in lib functions:** All path construction should go through `planningRoot()`. The violation pattern is `path.join(cwd, '.planning', ...)` instead of `path.join(planningRoot(cwd, milestoneScope), ...)`.
- **Modifying agent spec files:** ROUTE-05 explicitly prohibits this. Agents are downstream consumers of paths from orchestrators.
- **Checking `layout_style` in lib layer:** The lib layer should not gate behavior on `layout_style`. The CLI layer passes `milestoneScope` (null for legacy, version string for milestone-scoped) and the lib layer uses it unconditionally via `planningRoot()`.
- **Threading `--milestone` to health/validate commands:** `validate health` checks `.planning/` integrity itself — it scans the global config root, not a milestone workspace. No --milestone threading needed there.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path resolution | Custom per-command path logic | `planningRoot(cwd, milestoneScope)` | Already proven in 2 init commands; consistent behavior |
| Layout detection | Re-reading config.json per command | `detectLayoutStyle(cwd)` | Centralized, testable, returns 3-state enum |
| Test project setup | New helper function | Extend existing `createTempProject()` in `tests/helpers.cjs` | All 11 test files already use it; consistent fixture approach |

**Key insight:** The entire Phase 12 implementation is _routing_ — connecting existing functions together in new call chains, not building new functions. Resist the temptation to add new abstraction layers.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Thread milestoneScope in gsd-tools.cjs Router

**What goes wrong:** `cmdInitPhaseOp` gets `milestoneScope` param added to init.cjs, but the call in gsd-tools.cjs `init phase-op` case still calls `init.cmdInitPhaseOp(cwd, args[2], raw)` without it.

**Why it happens:** Two files must change in coordination: the function signature in init.cjs AND the call site in gsd-tools.cjs.

**How to avoid:** For each init function: (1) update function signature in init.cjs, (2) update call in gsd-tools.cjs in the same commit.

**Warning signs:** Tests pass but `milestone_scope` is always null in init JSON output when `--milestone` is provided.

### Pitfall 2: Breaking Existing Callers with Signature Changes

**What goes wrong:** Adding `milestoneScope` as a new required parameter breaks existing tests that call the function without it.

**Why it happens:** JavaScript doesn't enforce parameter counts, but tests will break if they inspect `milestone_scope` or `planning_root` fields.

**How to avoid:** Add `milestoneScope` as the LAST parameter with default value `null` (or undefined). Pattern: `function cmdInitPhaseOp(cwd, phase, raw, milestoneScope)`. Existing calls without the 4th argument will pass `undefined`, which `planningRoot(cwd, undefined)` handles correctly (returns legacy path).

**Verification:** The `planningRoot()` implementation uses truthiness check: `if (milestoneScope)` — so null, undefined, and empty string all return legacy path. This is the established decision from Phase 8.

### Pitfall 3: Workflow --milestone Flag Placement

**What goes wrong:** `--milestone` placed after subcommand instead of before command, or missing from specific subcommands.

**Why it happens:** The `--milestone` flag is parsed BEFORE the command name in gsd-tools.cjs. It must appear anywhere in the args list — the parser strips it out before routing. So `gsd-tools.cjs phase complete 12 --milestone v2.0` works.

**How to avoid:** In workflow MILESTONE_FLAG pattern: `${MILESTONE_FLAG}` can appear anywhere in the command. The `--milestone` strip happens early in `main()` regardless of position.

### Pitfall 4: cmdPhaseComplete Path Hardcoding

**What goes wrong:** `cmdPhaseComplete` in phase.cjs currently has 5 hardcoded `.planning/` paths (roadmapPath, statePath, phasesDir, reqPath, reqPath). Fixing only some of them causes partial milestone routing.

**Why it happens:** Each call to `path.join(cwd, '.planning', ...)` needs to change to `path.join(planningRoot(cwd, milestoneScope), ...)`.

**How to avoid:** At the top of `cmdPhaseComplete`, compute `const root = planningRoot(cwd, milestoneScope)` then replace all `path.join(cwd, '.planning', ...)` with `path.join(root, ...)`. Do a full replace, not piecemeal.

**Count to fix:** 4 distinct hardcoded paths in `cmdPhaseComplete` (lines 698-700, 748-749).

### Pitfall 5: PHASE-02 Cross-Milestone Reference Format

**What goes wrong:** Implementing PHASE-02 as a code feature rather than a documentation convention.

**Why it happens:** The requirement says "cross-milestone phase references use qualified format `<version>/phase-<NN>`" which sounds like it needs enforcement.

**How to avoid:** PHASE-02 is a **naming convention** documented in the glossary (ROUTE-04). It means: when a human or AI refers to a specific phase across milestones, they should use `v2.0/phase-01` not just `phase-01`. This does not require any gsd-tools.cjs changes — just documentation.

### Pitfall 6: health.md Does NOT Need --milestone

**What goes wrong:** Including `validate health --milestone` in the milestone-aware workflow update.

**Why it happens:** ROUTE-03 says "health updated to be milestone-aware" which could be read as needing --milestone threading.

**How to avoid:** `validate health` validates the global `.planning/` structure integrity — not milestone workspace-specific content. It should NOT take a --milestone flag. "Milestone-aware" for health means: health checks should recognize the concurrent project layout (it already uses `detectLayoutStyle` patterns through the existing verify.cjs). No changes needed to health.md.

---

## Code Examples

### Init Function Upgrade Pattern (verified against cmdInitExecutePhase)

```javascript
// Source: get-shit-done/bin/lib/init.cjs (pattern from cmdInitExecutePhase lines 10-84)

// BEFORE:
function cmdInitPhaseOp(cwd, phase, raw) {
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);
  // ...
  const result = {
    // ...
    phase_found: !!phaseInfo,
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,
  };
  output(result, raw);
}

// AFTER:
function cmdInitPhaseOp(cwd, phase, raw, milestoneScope) {
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);  // findPhaseInternal already handles milestone archive scanning
  // ...
  const result = {
    // ...
    phase_found: !!phaseInfo,
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,
    // NEW: milestone routing fields
    milestone_scope: milestoneScope || null,
    planning_root: planningRoot(cwd, milestoneScope),
    layout_style: detectLayoutStyle(cwd),
  };
  output(result, raw);
}
```

### gsd-tools.cjs Router Update Pattern

```javascript
// Source: get-shit-done/bin/gsd-tools.cjs (pattern from lines 565-569)

// BEFORE:
case 'phase-op':
  init.cmdInitPhaseOp(cwd, args[2], raw);
  break;
case 'verify-work':
  init.cmdInitVerifyWork(cwd, args[2], raw);
  break;
case 'progress':
  init.cmdInitProgress(cwd, raw);
  break;

// AFTER:
case 'phase-op':
  init.cmdInitPhaseOp(cwd, args[2], raw, milestoneScope);
  break;
case 'verify-work':
  init.cmdInitVerifyWork(cwd, args[2], raw, milestoneScope);
  break;
case 'progress':
  init.cmdInitProgress(cwd, raw, milestoneScope);
  break;
```

### cmdPhaseComplete Milestone-Aware Path Pattern

```javascript
// Source: get-shit-done/bin/lib/phase.cjs (cmdPhaseComplete, currently lines 693-700)

// BEFORE:
function cmdPhaseComplete(cwd, phaseNum, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  // ...
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');

// AFTER:
function cmdPhaseComplete(cwd, phaseNum, raw, milestoneScope) {
  const root = planningRoot(cwd, milestoneScope);
  const roadmapPath = path.join(root, 'ROADMAP.md');
  const statePath = path.join(root, 'STATE.md');
  const phasesDir = path.join(root, 'phases');
  // ...
  const reqPath = path.join(root, 'REQUIREMENTS.md');
```

### Workflow --milestone Threading Pattern

```bash
# Source: established pattern from execute-phase.md layout_style checks (lines 150-167)

# Step 1: Extract layout and milestone scope from init
LAYOUT=$(echo "$INIT" | jq -r '.layout_style // "legacy"')
MILESTONE_SCOPE=$(echo "$INIT" | jq -r '.milestone_scope // empty')

# Step 2: Build conditional flag
MILESTONE_FLAG=""
if [ "$LAYOUT" = "milestone-scoped" ] && [ -n "$MILESTONE_SCOPE" ]; then
  MILESTONE_FLAG="--milestone ${MILESTONE_SCOPE}"
fi

# Step 3: Thread through subsequent calls
COMPLETION=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs phase complete "${PHASE_NUMBER}" ${MILESTONE_FLAG})
ROADMAP=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs roadmap analyze ${MILESTONE_FLAG})
```

---

## Inventory of Changes Required

### A. gsd-tools.cjs — CLI Router (HIGH CONFIDENCE)

The `--milestone` flag is already parsed at lines 171-184. The following `init` cases need `milestoneScope` added:

| Case | Current call | Fix |
|------|-------------|-----|
| `phase-op` | `init.cmdInitPhaseOp(cwd, args[2], raw)` | Add `, milestoneScope` |
| `verify-work` | `init.cmdInitVerifyWork(cwd, args[2], raw)` | Add `, milestoneScope` |
| `progress` | `init.cmdInitProgress(cwd, raw)` | Add `, milestoneScope` |
| `resume` | `init.cmdInitResume(cwd, raw)` | Add `, milestoneScope` |
| `milestone-op` | `init.cmdInitMilestoneOp(cwd, raw)` | Add `, milestoneScope` |

Additionally:
- `phase complete` case: `phase.cmdPhaseComplete(cwd, args[2], raw)` → add `, milestoneScope`

### B. init.cjs — Function Signatures (HIGH CONFIDENCE)

Functions to update (add `milestoneScope` param + add 3 fields to result):
- `cmdInitPhaseOp` — add milestoneScope, update paths
- `cmdInitVerifyWork` — add milestoneScope, update paths
- `cmdInitProgress` — add milestoneScope, update phasesDir scan to use planningRoot
- `cmdInitResume` — add milestoneScope, update state/roadmap paths
- `cmdInitMilestoneOp` — add milestoneScope, update phasesDir

Fields to add to each result object:
```javascript
milestone_scope: milestoneScope || null,
planning_root: planningRoot(cwd, milestoneScope),
layout_style: detectLayoutStyle(cwd),
```

### C. phase.cjs — cmdPhaseComplete (HIGH CONFIDENCE)

- Import `planningRoot` from core.cjs
- Add `milestoneScope` param to `cmdPhaseComplete`
- Replace 4 `path.join(cwd, '.planning', ...)` with `path.join(root, ...)`
- Ensure gsd-tools.cjs `phase complete` case passes `milestoneScope`

### D. Workflow Files — Conditional --milestone Threading (MEDIUM CONFIDENCE)

Workflows where phase-scoped gsd-tools.cjs calls need `${MILESTONE_FLAG}` threading:

**High priority (called during active phase execution):**
- `execute-phase.md` — `phase complete` call (line 380), `roadmap update-plan-progress` call
- `transition.md` — `phase complete` call (line 126)
- `plan-phase.md` — `roadmap get-phase` call, `roadmap update-plan-progress` call
- `verify-work.md` — any `init phase-op` or `init verify-work` calls
- `progress.md` — `init progress`, `roadmap analyze` calls
- `resume-project.md` — `init resume` call

**Lower priority (milestone management workflows):**
- `complete-milestone.md` — already milestone-specific, may need scoping
- `health.md` — NO change needed (validates global `.planning/` structure)

**ROUTE-05 note:** Workflow files do change but only the orchestrator portions. Agent spawn prompts do NOT change — agents receive correct paths through `<files_to_read>` blocks.

### E. Documentation Artifacts (HIGH CONFIDENCE — new files)

1. **ROUTE-04:** `get-shit-done/references/path-variables.md` — Canonical path variable glossary defining all init JSON path fields in legacy and milestone-scoped contexts. This document must exist BEFORE any workflow editing begins so editors reference it for correct variable names.

2. **TEAM-01:** `.planning/docs/agent-teams.md` or as a section in REQUIREMENTS.md/STATE.md — Documents the research finding that Agent Teams is appropriate for intra-milestone parallel phases (future v2.1) but NOT for inter-milestone concurrency (already implemented via concurrent Claude Code sessions with workspace isolation). The finding: Claude Code session resumption is incompatible with Agent Teams' execution model for the inter-milestone use case; workspace isolation + explicit `--milestone` flag is the correct pattern.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `.planning/` strings | `planningRoot(cwd, milestoneScope)` | Phase 8 | All path resolution is milestone-aware |
| Manual config.json detection | `detectLayoutStyle(cwd)` sentinel | Phase 8 | 3-state detection (legacy/milestone-scoped/uninitialized) |
| No --milestone flag | Parsed before command routing | Phase 8 | Concurrent sessions pass version via flag |
| Only execute-phase + plan-phase milestone-aware | All init commands milestone-aware | Phase 12 (this phase) | Full routing complete |
| Phases numbered globally (1-13) | Phases reset per milestone | Phase 12 (PHASE-01 convention) | Milestone workspaces are self-contained |

---

## Open Questions

1. **cmdInitProgress phasesDir scan**
   - What we know: `cmdInitProgress` scans `path.join(cwd, '.planning', 'phases')` for all phases
   - What's unclear: In milestone-scoped mode, should `init progress` scan the specific milestone's phases directory, or aggregate all milestones' phase data?
   - Recommendation: For single-milestone progress (the common case), use `planningRoot(cwd, milestoneScope)/phases`. For multi-milestone aggregation, `cmdProgressRenderMulti` (already implemented in Phase 11) handles the multi-milestone view separately. Use `planningRoot` for `init progress` with milestoneScope.

2. **Workflow file path references (`.planning/phases/` hardcoded strings)**
   - What we know: 21 workflow files contain `.planning/phases` references (65 total occurrences). Most are in inline bash snippets used as documentation patterns.
   - What's unclear: Do ALL of these need updating, or only the gsd-tools.cjs call sites?
   - Recommendation: Only gsd-tools.cjs call sites need `${MILESTONE_FLAG}` threading. Hardcoded `.planning/phases` in bash snippet examples (like `ls -1 .planning/phases/...`) are DISPLAY patterns — the actual data comes from init JSON `phase_dir` field which is already correct. Focus on call sites only.

3. **`cmdInitResume` for milestone-scoped projects**
   - What we know: `init resume` currently reads `.planning/STATE.md` and checks `.planning/` for project artifacts
   - What's unclear: In milestone-scoped layout, which STATE.md does resume read? The workspace-specific one at `.planning/milestones/v2.0/STATE.md`?
   - Recommendation: Yes — pass `milestoneScope` to `cmdInitResume` and use `planningRoot` for STATE.md path. A session resumes within a specific milestone context, so `--milestone v2.0` should be provided when resuming.

---

## Validation Architecture

NOTE: `workflow.nyquist_validation` is not set in `.planning/config.json` (only `workflow.research`, `workflow.plan_check`, `workflow.verifier` exist). This section is skipped.

---

## Sources

### Primary (HIGH confidence)
- Project source: `/Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs` — CLI router, --milestone parsing (lines 171-184), init dispatch (lines 562-604)
- Project source: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/init.cjs` — All init functions; cmdInitExecutePhase and cmdInitPlanPhase are the proven milestoneScope pattern (lines 10-84, 90-159)
- Project source: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs` — `planningRoot()` and `detectLayoutStyle()` implementations (lines 402-422)
- Project source: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/phase.cjs` — `cmdPhaseComplete` with hardcoded paths (lines 693-865)
- Project state: `/Users/tmac/Projects/gsdup/.planning/REQUIREMENTS.md` — ROUTE-01 through ROUTE-05, PHASE-01 through PHASE-03, TEAM-01 definitions
- Project state: `/Users/tmac/Projects/gsdup/.planning/STATE.md` — v2.0 decisions, pending todo for grep inventory (now completed: 65 `.planning/phases` refs, 24 STATE refs, 23 ROADMAP refs across workflow files)
- Verified Phase 11 output: `/Users/tmac/Projects/gsdup/.planning/phases/11-dashboard-conflict-detection/11-VERIFICATION.md` — confirms write-status, manifest-check, and cmdProgressRenderMulti are complete

### Secondary (MEDIUM confidence)
- Workflow files analyzed: execute-phase.md, plan-phase.md, progress.md, health.md, complete-milestone.md, resume-project.md, transition.md — mapped gsd-tools.cjs call sites needing --milestone threading

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns proven in Phases 8-11
- Architecture: HIGH — direct inspection of source code confirms exact lines to change
- Pitfalls: HIGH — derived from reading actual code, not speculation
- Workflow updates: MEDIUM — 21 files contain `.planning/phases` references; determining exactly which call sites need threading (vs display-only references) requires judgment during implementation

**Research date:** 2026-02-24
**Valid until:** 2026-03-25 (stable codebase, 30 days)
