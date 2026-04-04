---
phase: "quick-42"
plan: "42"
type: "research-design"
autonomous: false
wave: 1
depends_on: []
requirements: []
files_modified:
  - .planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md

must_haves:
  truths:
    - "The auto chain already works in ~/.gsd workflows: discuss→plan→execute all have --auto threading, chain flag syncing, and Skill() chaining to avoid nested Task context explosion"
    - "gsdup has workflow.auto_advance and workflow._auto_chain_active config keys wired into all three workflow entry points (discuss-phase.md, plan-phase.md, execute-phase.md) and transition.md"
    - "The auto chain in discuss-phase uses Skill() not Task() — this is the anti-nesting pattern that keeps execution flat and prevents context explosion"
    - "Chain flag syncing clears _auto_chain_active on manual invocations, preventing accidental chaining after interrupted auto runs"
    - "Milestone boundary (is_last_phase: true) clears the chain flag and stops chaining — this is the natural stopping point"
    - "human-action checkpoint type is the only one that cannot be auto-approved — this is a permanent safety rail"
    - "gsdup already supports: auto-approve checkpoints (human-verify→approve, decision→first-option) in execute-phase.md checkpoint_handling step"
    - "The key gap is NOT the workflow mechanics (already implemented) — it is the START of the chain: new-project --auto that bootstraps _auto_chain_active and kicks off discuss-phase 1 --auto"
    - "gsdup discuss-phase has no CONTEXT.md auto-generation path for --auto mode (vanilla GSD uses document-extracted defaults; gsdup expects interactive user discussion)"
    - "v16.0 auto mode needs: (1) gsd:auto slash command or new-project --auto entry point, (2) discuss-phase auto-path using ROADMAP.md phase goals as CONTEXT.md, (3) dashboard auto-chain status panel, (4) safety telemetry for runaway prevention"
  artifacts:
    - .planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md
  key_links:
    - get-shit-done/workflows/discuss-phase.md
    - get-shit-done/workflows/plan-phase.md
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/transition.md
    - get-shit-done/workflows/new-project.md
    - .planning/milestones/v15.0/ROADMAP.md
---

# Plan 42: Auto Mode Milestone Design

## Objective

Produce `AUTO-MODE-MILESTONE.md` — a comprehensive milestone design document for v16.0 Auto Mode that could be directly used to create ROADMAP.md, REQUIREMENTS.md, and phases for a new milestone. This is a deep research-and-design output: full phase breakdown, requirement IDs, wiring decisions, safety rail specifications, and implementation notes grounded in the actual codebase.

## Context

The research findings above reveal that gsdup already has most of the auto-chain infrastructure in the workflow files (discuss-phase.md, plan-phase.md, execute-phase.md, transition.md all wire `--auto`, `_auto_chain_active`, and `auto_advance`). The gaps are narrower than they appear:

1. **No entry point for pure auto mode** — `/gsd:auto` slash command or `new-project --auto` does not exist in gsdup's project-claude layer; the auto-chain can only be triggered per-phase
2. **discuss-phase has no headless path** — when `--auto` is active it still tries to do interactive questioning; it needs a "synthesize CONTEXT.md from ROADMAP.md phase goal" fallback
3. **No dashboard integration** — the MCP dashboard has no panel showing chain status, current auto phase, or estimated completion
4. **No runaway prevention** — a config option to cap how many phases auto-advance can chain before pausing for a check-in
5. **Missing gsd:settings integration** — `auto_advance` is not surfaced in the `/gsd:settings` workflow, making it hidden

## Tasks

---

### Task 1: Deep-dive current auto-chain wiring state

**Files:**
- get-shit-done/workflows/discuss-phase.md (read, lines 636-706 — auto_advance step)
- get-shit-done/workflows/plan-phase.md (read, lines 529-586 — auto-advance check)
- get-shit-done/workflows/execute-phase.md (read, lines 493-545 — offer_next step)
- get-shit-done/workflows/transition.md (read, lines 380-510 — offer_next_phase step)
- get-shit-done/workflows/settings.md (read entire)
- get-shit-done/lib/config.cjs (read, grep for auto_advance, _auto_chain_active)

**Action:**
Read the six files above. Build a complete map of:
1. Every place `_auto_chain_active` is read, written, or cleared
2. Every place `auto_advance` is read
3. The exact Skill() invocation signatures used for chaining (discuss→plan, plan→execute)
4. What `--no-transition` prevents and where it's consumed
5. What `is_last_phase` does and which workflow file reads it
6. Whether `gsd:settings` workflow currently exposes `workflow.auto_advance` as a user-configurable option

Document findings as a "Current Wiring" section in the output document.

**Verify:**
Grep confirms locations:
```bash
grep -rn "auto_chain_active\|auto_advance\|--auto\|--no-transition" \
  get-shit-done/workflows/ get-shit-done/bin/lib/ | head -50
```

**Done:** Output document section "Current Wiring" lists every wiring point with file:line references.

---

### Task 2: Write the AUTO-MODE-MILESTONE.md design document

**Files:**
- .planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md (create)

**Action:**
Write a comprehensive milestone design document structured as follows. This is the primary deliverable — write it thoroughly enough that it could be fed directly to `/gsd:new-milestone` to create v16.0.

```
# v16.0 Auto Mode — Milestone Design

## Overview
[2-3 paragraphs: what auto mode is, what gsdup already has, what this milestone adds]

## What Already Works (Do Not Rebuild)
[Exhaustive list of existing wiring from Task 1 — saves re-implementing things already done]

## Gaps This Milestone Closes
[The 5 gaps enumerated above, each with clear scope]

## Requirements

### AUTO-CHAIN (AC) — Entry Points & Orchestration
- AC-01: /gsd:auto slash command that bootstraps chain flag and invokes discuss-phase N --auto for current roadmap position
- AC-02: /gsd:auto --from N flag to start chain at specific phase
- AC-03: /gsd:auto --phases N flag to limit chain length (runaway prevention)
- AC-04: new-project --auto activates chain and invokes discuss-phase 1 --auto after roadmap creation
- AC-05: Chain flag persists across context compaction (disk-backed _auto_chain_active already satisfies this — note as pre-met)

### HEADLESS-DISCUSS (HD) — Auto Context Generation
- HD-01: When --auto is active and no CONTEXT.md exists, discuss-phase synthesizes CONTEXT.md from ROADMAP.md phase goal and requirements without user interaction
- HD-02: Synthesized CONTEXT.md marks all decisions as "Auto-generated from roadmap goal" with Claude's discretion
- HD-03: When CONTEXT.md already exists (user ran discuss-phase manually), --auto skips synthesis and uses existing CONTEXT.md as-is
- HD-04: PRD express path (--prd flag) also satisfies HD-01 — document-derived context counts as headless-ready

### SETTINGS (ST) — User Control Surface  
- ST-01: /gsd:settings exposes workflow.auto_advance as a toggleable option
- ST-02: /gsd:settings exposes workflow.auto_chain_max_phases (default: unlimited) as a configurable integer
- ST-03: /gsd:settings --set auto_advance true/false updates config.json
- ST-04: Chain status visible: gsd-tools config-get workflow._auto_chain_active returns current state

### DASHBOARD (DB) — Observability
- DB-01: MCP dashboard has an "Auto Chain" panel showing: active/idle state, current phase, phases completed in chain, phases remaining, estimated completion
- DB-02: Auto chain panel reads _auto_chain_active, current phase from STATE.md, and total phases from ROADMAP.md
- DB-03: Dashboard panel updates automatically (MCP poll — no push required)
- DB-04: Chain panel shows "PAUSED — human-action checkpoint" when blocked

### SAFETY (SF) — Runaway Prevention
- SF-01: When auto_chain_max_phases is set and chain has advanced that many phases, chain pauses and presents summary before continuing
- SF-02: On chain pause, display: phases completed, time elapsed, what was built, "Continue?" prompt
- SF-03: human-action checkpoints always block — this is already implemented, document it as a hard invariant
- SF-04: Verification gaps_found stops chain and presents manual recovery path — already implemented, document as invariant
- SF-05: Emergency stop: /gsd:auto --stop clears _auto_chain_active immediately

## Phase Design

### Phase 84: Auto Entry Points & Chain Bootstrap
Goal: /gsd:auto slash command exists and correctly bootstraps the chain flag, invokes discuss-phase --auto, and handles milestone boundaries
Depends on: Nothing (all chain mechanics already exist in workflow files)
Requirements: AC-01, AC-02, AC-03, AC-05, SF-05
Plans:
  - 84-01: Create /gsd:auto slash command (project-claude/commands/gsd/auto.md)
    - Reads current phase from STATE.md
    - Validates phase is ready to plan (not already complete)
    - Sets _auto_chain_active=true in config
    - Invokes Skill("gsd:discuss-phase", "{phase} --auto")
    - Handles --from N and --phases N flags
    - --stop flag clears chain flag and exits
  - 84-02: Wire AC-04 into new-project --auto
    - After roadmap approval step: set _auto_chain_active=true
    - Invoke Skill("gsd:discuss-phase", "1 --auto")
    - Document: new-project --auto requires idea document (existing guard already enforces this)

### Phase 85: Headless Discuss Path
Goal: discuss-phase with --auto active synthesizes CONTEXT.md from phase goal when no CONTEXT.md exists, enabling fully unattended phase discussion
Depends on: Phase 84 (for chain entry), but can be built independently
Requirements: HD-01, HD-02, HD-03, HD-04
Plans:
  - 85-01: Add auto_synthesize_context() step to discuss-phase
    - Triggered when: --auto flag present AND has_context is false AND no --prd flag
    - Reads phase goal + requirements from ROADMAP.md and REQUIREMENTS.md
    - Generates CONTEXT.md with decisions marked "Auto-generated: {phase_goal}"
    - All areas go under "Claude's Discretion" — headless mode gives Claude full latitude
    - Commits CONTEXT.md
    - Proceeds directly to auto_advance step (skips interactive questioning entirely)
  - 85-02: Guard and test headless path
    - Verify: when CONTEXT.md already exists, --auto skips synthesis (HD-03)
    - Verify: synthesized CONTEXT.md has correct frontmatter and domain section
    - Add test: headless CONTEXT.md generation produces valid planner input

### Phase 86: Settings Surface & Dashboard Panel
Goal: Auto advance is visible and controllable via /gsd:settings, and the MCP dashboard shows chain status in real time
Depends on: Phase 84 (chain state must exist to display it)
Requirements: ST-01, ST-02, ST-03, ST-04, DB-01, DB-02, DB-03, DB-04
Plans:
  - 86-01: Wire auto_advance into /gsd:settings workflow
    - Add "Auto Advance" toggle to settings options
    - Show current value, allow toggle
    - Show auto_chain_max_phases (integer input, default "unlimited")
    - Persist to config.json via config-set
  - 86-02: Add auto-chain-status MCP tool and dashboard panel
    - New MCP tool: get_auto_chain_status → returns {active, current_phase, phases_in_chain, chain_started_at, blocked_on}
    - Tool reads: _auto_chain_active from config, current position from STATE.md, roadmap for total phases
    - New dashboard panel: AutoChainPanel component (src/components/panels/auto-chain/)
    - Panel shows: active/idle badge, progress bar (phases completed / total), current phase name, blocked-on message if paused
    - Wire into dashboard generator

### Phase 87: Safety Rails & Integration Tests
Goal: Runaway prevention works, all safety invariants are documented and tested, end-to-end auto chain can be demonstrated with a test project
Depends on: Phases 84-86
Requirements: SF-01, SF-02, SF-03, SF-04, SF-05
Plans:
  - 87-01: Implement auto_chain_max_phases enforcement
    - In each auto_advance step (discuss, plan, execute): check phase count against max
    - On limit hit: display summary, prompt "Continue {N} more phases?" before resuming
    - Wire SF-05 --stop flag to immediate chain flag clear
  - 87-02: Integration tests and invariant documentation
    - Test: human-action checkpoint always blocks regardless of auto_advance setting
    - Test: gaps_found stops chain and presents manual recovery
    - Test: is_last_phase clears chain flag (existing behavior — regression test)
    - Test: max_phases enforcement triggers at correct count
    - Test: --stop clears chain immediately
    - Document all safety invariants in get-shit-done/references/auto-mode.md

## Implementation Notes

### Why Skill() Not Task() for Chaining
All auto-advance steps use Skill() to invoke the next workflow, NOT Task(). This keeps execution at the same nesting level. Using Task() would create: discuss spawns a task which spawns plan which spawns execute — three levels deep. Skill() executes inline in the current context window, preventing the context explosion that caused the original issue (#686 in discuss-phase.md).

### Config Key Architecture
- workflow.auto_advance (boolean, persistent): User's standing preference — survives sessions
- workflow._auto_chain_active (boolean, ephemeral-but-disk-backed): Chain is currently running
- workflow.auto_chain_max_phases (integer, persistent): Safety cap — 0 means unlimited

The two-key design (persistent preference + ephemeral chain flag) enables:
- User can set auto_advance=true without triggering a chain (chain only starts when --auto is passed or /gsd:auto is invoked)
- Manual invocation of any workflow clears _auto_chain_active without touching auto_advance preference
- Interrupted chains do not re-trigger on next session start

### discuss-phase Headless Path Decision
Auto-mode CONTEXT.md generation uses the phase goal + requirements as the only input. This is intentional: in headless mode Claude has full discretion on HOW to implement, the ROADMAP already defines WHAT to build. The synthesized CONTEXT.md is a minimal stub that satisfies the planner's "CONTEXT.md loaded" requirement. This is different from vanilla GSD's new-project --auto which synthesizes from a provided PRD document — in gsdup, the ROADMAP IS the document.

### Dashboard Panel Architecture
The auto-chain panel follows the same pattern as existing panels (skill-loads, gate-health):
- Collector: reads config.json + STATE.md + ROADMAP.md
- MCP tool: get_auto_chain_status with typed return
- Panel component: AutoChainPanel.tsx with status badge, progress bar, phase name
- Generator wiring: added to dashboard-generator.ts barrel

### Milestone vs Phase Boundary
The /gsd:auto command operates within a single milestone. It starts at the current position in STATE.md and runs until is_last_phase. To chain across milestones, the user would run /gsd:auto again after /gsd:complete-milestone — this is intentional, milestone boundaries are natural human checkpoints.

## Estimated Effort

| Phase | Plans | Complexity | Primary Files |
|-------|-------|------------|---------------|
| 84 | 2 | Low | project-claude/commands/gsd/auto.md, new-project.md |
| 85 | 2 | Medium | discuss-phase.md |
| 86 | 2 | Medium-High | settings.md, src/mcp/, src/components/panels/ |
| 87 | 2 | Medium | all workflows, references/auto-mode.md |

Total: 8 plans across 4 phases — comparable to v13.0 Unified Observability.

## What This Enables

Once v16.0 ships, a user can:
```
/gsd:auto
```
And gsdup will:
1. Synthesize CONTEXT.md from the current phase goal
2. Plan the phase with research and verification
3. Execute all plans, auto-approving human-verify and decision checkpoints
4. Transition to next phase
5. Repeat until milestone complete or human-action checkpoint blocks

The only times the user must intervene:
- human-action checkpoint (auth gates, destructive operations)
- Verification gaps found (quality issues need human judgment)
- max_phases cap reached (configured safety check-in)
- Milestone boundary (natural stopping point — run /gsd:auto again to continue)

## Open Questions

1. **discuss-phase headless quality**: Will plans generated from auto-synthesized CONTEXT.md be as good as plans from interactive discussion? Likely phase 85 should include a flag `--discuss` that re-enables interactive mode even when --auto is set, for phases where the user wants to provide direction.

2. **settings workflow scope**: Should /gsd:settings expose the full config schema (model profiles, quality gates, branching strategy) or just the auto_advance toggle? The latter is safer for this milestone — full settings surface could be a v17.0 item.

3. **multi-milestone auto**: Is there a use case for `/gsd:auto --all-milestones`? Probably not — milestone boundaries exist for good reason. Deferred.

4. **PRD-driven auto**: `/gsd:auto --prd prd.md` would use PRD express path for CONTEXT.md in every phase. This is interesting but complex — the PRD covers the whole product, individual phases need per-phase extraction. Deferred to phase 85 follow-on work.
```

Write this document verbatim (filling in the "Current Wiring" section from Task 1's findings) to the output file.

**Verify:**
```bash
test -f /Users/tmac/Projects/gsdup/.planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md && \
  wc -l /Users/tmac/Projects/gsdup/.planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md
```

File exists and has at least 200 lines.

**Done:**
- AUTO-MODE-MILESTONE.md exists with all sections present
- "Current Wiring" section populated with actual file:line references from Task 1
- Requirements section has all requirement IDs (AC-*, HD-*, ST-*, DB-*, SF-*)
- Phase Design section covers 4 phases (84-87) with plan breakdowns
- Implementation Notes section covers Skill() vs Task(), config key architecture, headless path decision
- Open Questions section captures ambiguities for human decision

---

## Verification

```bash
# Document exists
test -f /Users/tmac/Projects/gsdup/.planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md && echo "EXISTS"

# Has required sections
grep -c "^## " /Users/tmac/Projects/gsdup/.planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md

# Has requirement IDs
grep -c "AC-0\|HD-0\|ST-0\|DB-0\|SF-0" /Users/tmac/Projects/gsdup/.planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md

# Current wiring section populated
grep -c "file:" /Users/tmac/Projects/gsdup/.planning/quick/42-analyze-gsd-auto-workflow-and-design-aut/AUTO-MODE-MILESTONE.md
```

## Done Criteria

- [ ] AUTO-MODE-MILESTONE.md exists at the output path
- [ ] Document has "What Already Works" section with actual file references (not generic statements)
- [ ] Document has 15+ requirement IDs with clear acceptance criteria
- [ ] Document has 4 phases (84-87) with concrete plan descriptions matching gsdup's file structure
- [ ] Document has Implementation Notes covering the Skill() anti-nesting pattern with a reference to #686 in discuss-phase.md
- [ ] Document has Open Questions section with at least 3 unresolved design decisions
- [ ] Document is self-contained: an executor with no other context could use it to create a new milestone roadmap
