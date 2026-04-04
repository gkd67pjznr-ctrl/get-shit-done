# v16.0 Auto Mode — Milestone Design

## Overview

Auto Mode allows a user to invoke `/gsd:auto` and have gsdup autonomously chain discuss-phase → plan-phase → execute-phase → transition across every phase in a milestone, pausing only when a human-action checkpoint or verification gap requires human judgment. The result is a hands-off execution loop that respects quality gates and safety rails while eliminating the manual `/clear`-and-reinvoke ceremony between phases.

The gsdup codebase already has the overwhelming majority of this infrastructure in place. All three workflow entry points (discuss-phase.md, plan-phase.md, execute-phase.md) have `--auto` flag parsing, `_auto_chain_active` chain flag syncing, chain flag reading, Skill()-based chaining to keep nesting flat, and stop conditions for gap/checkpoint cases. The transition.md workflow clears the chain flag at milestone boundaries and invokes the next phase's slash command with `--auto` when YOLO mode is active. new-project.md bootstraps the chain from a PRD document and sets both `auto_advance: true` in config and `_auto_chain_active: true` before invoking discuss-phase 1 --auto.

What this milestone adds: a `/gsd:auto` entry point that starts the chain mid-project (new-project only covers greenfield), a headless path in discuss-phase that synthesizes CONTEXT.md from the roadmap when `--auto` is active (today it still requires interactive questioning), surface-level observability in the MCP dashboard, **multi-milestone chaining** that runs through ALL planned milestones end-to-end (auto-completing each milestone and advancing to the next), and **doctor checkpoints** — periodic self-assessment where GSD code-reviews its own recent output, checks test trends, and flags quality drift before continuing. Together these additions close the loop from "chain mechanics work" to "a user can type `/gsd:auto` and walk away while the entire project builds itself, with periodic health checks."

---

## What Already Works (Do Not Rebuild)

The following is fully implemented and tested. Future executors must not re-implement any of this.

### discuss-phase.md — `auto_advance` step (lines 636–705)

- **Chain flag sync on manual invocation** (line 642–644): When `--auto` is NOT in `$ARGUMENTS`, clears `workflow._auto_chain_active` via `config-set`. This prevents an old interrupted chain from re-triggering accidentally.
- **Chain flag write on `--auto` present** (line 652–655): When `--auto` IS present and `AUTO_CHAIN` is not already true, writes `workflow._auto_chain_active=true` to config. This supports direct `--auto` usage without going through new-project.
- **Config reads** (lines 648–649): Reads both `workflow._auto_chain_active` and `workflow.auto_advance` — either being true triggers the chain.
- **Skill() invocation** (line 670): `Skill(skill="gsd:plan-phase", args="${PHASE} --auto")` — uses Skill, not Task, to keep nesting flat. Comment references #686 (context explosion issue).
- **Return routing** (lines 675–704): Handles PHASE COMPLETE, PLANNING COMPLETE, PLANNING INCONCLUSIVE/CHECKPOINT, and GAPS FOUND — all with appropriate stop/continue decisions.

### plan-phase.md — `auto_advance` section (lines 529–585)

- **Chain flag sync on manual invocation** (lines 534–538): Same pattern as discuss-phase.md.
- **Config reads** (lines 542–543): Reads `_auto_chain_active` and `auto_advance`.
- **Skill() invocation** (line 559): `Skill(skill="gsd:execute-phase", args="${PHASE} --auto --no-transition")` — passes `--no-transition` to tell execute-phase to return status instead of running transition itself.
- **Return routing** (lines 564–582): PHASE COMPLETE (next discuss-phase --auto) and GAPS FOUND/VERIFICATION FAILED (stop chain).

### execute-phase.md — `init` and `offer_next` steps

- **Chain flag sync on manual invocation** (lines 41–44): Clears `_auto_chain_active` on manual invocation, before any other config reads (checkpoint_handling also reads auto flags).
- **checkpoint_handling step** (lines 252–266): When `AUTO_CHAIN` or `AUTO_CFG` is true and executor returns a checkpoint:
  - `human-verify` → auto-approved (`"approved"`)
  - `decision` → auto-selects first option
  - `human-action` → always presented to user — cannot be automated (permanent safety rail)
- **offer_next step** (lines 493–544):
  - `--no-transition` guard (lines 497–516): When spawned by plan-phase's auto-advance, returns `PHASE COMPLETE` status block and stops. Does not run transition.
  - Auto-advance detection (lines 518–544): Reads `AUTO_CHAIN`/`AUTO_CFG`, reads and follows `transition.md` inline (not via Task) passing `--auto` through.

### transition.md — `offer_next_phase` step (lines 353–511)

- **is_last_phase routing** (lines 353–355): `is_last_phase: false` → Route A (more phases), `is_last_phase: true` → Route B (milestone complete).
- **Route A — YOLO mode** (lines 380–406): If CONTEXT.md exists, `SlashCommand("/gsd:plan-phase [X+1] --auto")`; if not, `SlashCommand("/gsd:discuss-phase [X+1] --auto")`.
- **Route B — milestone boundary** (lines 463–510): Clears `_auto_chain_active` (line 467) then in YOLO mode invokes `SlashCommand("/gsd:complete-milestone {version}")`. This is the natural auto-chain stopping point.

### new-project.md — `--auto` bootstrap (lines 1–40, 195, 212, 1074)

- **Document requirement check** (lines 12–39): `--auto` requires an idea document; errors if absent.
- **Config bootstrap** (line 195): Sets `"auto_advance": true` in config.
- **Chain flag bootstrap** (line 212): `config-set workflow._auto_chain_active true`.
- **Chain invocation** (line 1074): `SlashCommand("/gsd:discuss-phase 1 --auto")`.

### settings.md — `auto_advance` already surfaced (lines 81–88, 136, 187)

- **AskUserQuestion option** (lines 81–88): "Auto-advance pipeline?" is already one of the 8 settings presented to the user.
- **update_config** (line 136): `"auto_advance": true/false` written to config.
- **save_as_defaults** (line 187): `auto_advance` included in `~/.gsd/defaults.json`.

**Key gap:** `auto_chain_max_phases` is NOT present in settings.md. Only `auto_advance` boolean is there. The safety cap is entirely absent.

### config.cjs — dot-notation path traversal (line 247)

`config-get workflow._auto_chain_active` and `config-get workflow.auto_advance` both work via the dot-notation traversal already in config.cjs. No new config infrastructure needed.

---

## Gaps This Milestone Closes

### Gap 1: No `/gsd:auto` entry point for mid-project chains

`new-project --auto` bootstraps the chain from project creation. But if a user is mid-project on phase 45 of a 52-phase milestone, there is no way to say "chain everything from here." They must invoke `discuss-phase 45 --auto`, which works but requires knowing the current phase number and typing the explicit phase flag. `/gsd:auto` should read STATE.md, find the current phase, set the chain flag, and start the chain — one command, no arguments required.

### Gap 2: discuss-phase has no headless CONTEXT.md synthesis

When `--auto` is active and no CONTEXT.md exists, discuss-phase still runs its full interactive questioning loop. The questions cannot be answered unattended. The auto-advance step is only reached AFTER the discussion. This means auto-chaining from a phase without a pre-existing CONTEXT.md always blocks on human input. The headless path must synthesize CONTEXT.md from the phase goal and requirements in ROADMAP.md/REQUIREMENTS.md, mark all decisions as "Auto-generated: {phase_goal}", and proceed directly to auto_advance without user interaction.

### Gap 3: No dashboard visibility for chain status

The MCP dashboard has panels for gate health, skill loads, and brainstorm ideas, but nothing that shows: is the chain currently running? What phase is it on? How many phases are left? When a chain is active, the user has no observability without reading STATE.md manually.

### Gap 4: No periodic self-assessment (doctor checkpoints)

There is no mechanism for GSD to periodically assess whether its own output is drifting in quality. Over a long auto chain (dozens of phases across multiple milestones), quality problems can compound. Doctor checkpoints provide a "health check" that code-reviews recent changes, checks test health, monitors correction density, and flags scope drift.

### Gap 5: No multi-milestone chaining

The chain stops at milestone boundaries (`is_last_phase` clears `_auto_chain_active`). For a full project autopilot, the chain must cross milestone boundaries — auto-completing each milestone (audit → archive) and advancing to the next. This requires modifying transition.md Route B and making `/gsd:complete-milestone` auto-invocable.

### Gap 6: No gate auto-retry for strict mode

When `quality.level` is `"strict"` and a gate blocks, execution stops immediately. In auto mode this is too aggressive — the executor should get one automatic retry to fix the issue before the chain stops. This reduces false-positive interruptions.

### Gap 7: doctor_interval missing from /gsd:settings

Once doctor checkpoints are implemented, the interval must be exposed in `/gsd:settings` so users can configure it without manually editing config.json.

---

## Requirements

### AUTO-CHAIN (AC) — Entry Points & Orchestration

- **AC-01:** `/gsd:auto` slash command reads STATE.md to find current incomplete phase, validates the phase is not already complete, sets `_auto_chain_active=true`, and invokes `Skill("gsd:discuss-phase", "{phase} --auto")`. If no CONTEXT.md exists for the phase, the headless path (HD-01) handles it.
- **AC-02:** `/gsd:auto --from N` flag overrides STATE.md phase detection and starts the chain at phase N. Validates phase N exists in ROADMAP.md.
- **AC-03:** `/gsd:auto --discuss` flag forces interactive discuss-phase for the current phase only, then resumes auto chain for subsequent phases. Overrides headless synthesis for that one phase.
- **AC-04:** `new-project --auto` already bootstraps the chain — this is pre-met. Document it as implemented and verify the config-set + SlashCommand sequence at lines 195, 212, 1074 of new-project.md.
- **AC-05:** Chain flag persists across context compaction via disk-backed `_auto_chain_active` in config.json — pre-met. Document as implemented invariant.
- **AC-06:** `--stop` flag: `/gsd:auto --stop` clears `_auto_chain_active` immediately and displays confirmation. No chaining occurs.

### HEADLESS-DISCUSS (HD) — Auto Context Generation

- **HD-01:** When `--auto` is active (flag or chain flag) and `has_context` is false (no CONTEXT.md exists for the phase) and no `--prd` flag is present, discuss-phase reads the phase goal and requirements from ROADMAP.md and REQUIREMENTS.md, synthesizes a CONTEXT.md, commits it, and proceeds directly to the `auto_advance` step — skipping the interactive questioning loop entirely.
- **HD-02:** Synthesized CONTEXT.md marks every decision field with `"Auto-generated from roadmap goal: {phase_goal}"` and places all implementation areas under "Claude's Discretion". The synthesized file must pass the planner's CONTEXT.md validation check (has required frontmatter and domain section).
- **HD-03:** When CONTEXT.md already exists for the phase and `--auto` is active, discuss-phase uses the existing CONTEXT.md as-is and proceeds directly to `auto_advance`. The synthesis path is skipped entirely.
- **HD-04:** When `--prd` flag is present (PRD express path), `--auto` uses the PRD-derived context directly as the headless input. PRD-derived context counts as headless-ready.

### SETTINGS (ST) — User Control Surface

- **ST-01:** `/gsd:settings` exposes `workflow.doctor_interval` as a configurable integer with label "Doctor checkpoint interval" and description "Run self-assessment every N phases (0 = disabled)". Default: 5.
- **ST-02:** `/gsd:settings` update_config step writes `workflow.doctor_interval` to config.json alongside the existing `auto_advance` field.
- **ST-03:** `/gsd:settings` save_as_defaults step includes `doctor_interval` in `~/.gsd/defaults.json`.
- **ST-04:** `gsd-tools config-get workflow._auto_chain_active` already works (pre-met) — document as the mechanism for querying live chain state.

### MULTI-MILESTONE (MM) — Cross-Milestone Chaining

- **MM-01:** At milestone boundary (`is_last_phase: true`), when auto chain is active, transition.md auto-invokes the full milestone completion flow: `audit-milestone` → `complete-milestone` → archive.
- **MM-02:** After milestone completion, auto chain detects the next planned milestone from MILESTONES.md / ROADMAP.md. If one exists, invokes `/gsd:auto` on the new milestone's first phase.
- **MM-03:** If no more milestones are planned, chain terminates with summary: milestones completed, total phases, total time.
- **MM-04:** `/gsd:complete-milestone` must be auto-invocable when `_auto_chain_active` is true — skip confirmation prompts, auto-approve archive.
- **MM-05:** Milestone boundary transitions log to `auto-chain-log.jsonl`: `{ event: "milestone_complete", milestone: "vN.0", phases: N, timestamp }`.

### DOCTOR CHECKPOINTS (DC) — Self-Assessment

- **DC-01:** Every `workflow.doctor_interval` phases (default: 5), the auto chain spawns a "doctor" self-assessment agent before continuing to the next phase.
- **DC-02:** Doctor agent runs 4 diagnostic checks:
  1. **Code review**: Spawns code-review agent on git diff of last N phases — checks for quality drift, dead code, missing tests.
  2. **Test health**: Runs `npm test` (or project test command), checks pass rate and coverage trend (if available).
  3. **Correction density**: Reads corrections.jsonl, computes correction rate for recent phases vs project average. Flags if trending up.
  4. **Scope drift**: Compares git diff size (lines changed) to plan scope (estimated from PLAN.md task count). Flags if actual >> expected.
- **DC-03:** Doctor produces a diagnostic report: `DOCTOR-CHECK-{N}.md` in `.planning/auto-chain/`.
- **DC-04:** If all checks pass: log "Doctor check passed at phase {N}", continue chain automatically.
- **DC-05:** If any check flags issues: pause chain, present diagnostic report, ask "Continue, investigate, or stop?" via AskUserQuestion.
- **DC-06:** Doctor check interval is configurable via `/gsd:settings` (ST-01) and `/gsd:auto --doctor-interval N` flag.

### DASHBOARD (DB) — Observability

- **DB-01:** The MCP dashboard has an "Auto Chain" panel (`AutoChainPanel`) showing: active/idle badge, current phase name, phases completed in this chain run, total phases in milestone, estimated completion (phases remaining × avg phase duration if available), and a "PAUSED — human-action checkpoint" message when blocked.
- **DB-02:** The panel's collector reads `_auto_chain_active` from config.json, current phase position from STATE.md, and total phases + phase names from ROADMAP.md.
- **DB-03:** Dashboard panel updates via standard MCP poll (same pattern as gate-health and skill-loads panels — no push required).
- **DB-04:** When `_auto_chain_active` is false, panel displays "Idle — run /gsd:auto to start chain" with the current phase as the suggested entry point.

### SAFETY (SF) — Runaway Prevention & Quality

- **SF-01:** Doctor checkpoints (DC-01 through DC-06) serve as the primary runaway prevention mechanism, replacing the dropped `auto_chain_max_phases` cap. The doctor self-assesses quality drift, test health, correction density, and scope creep at configurable intervals.
- **SF-02:** When `quality.level` is `"strict"` and a gate blocks during auto mode, the executor gets ONE automatic retry to fix the issue. If the retry also fails, the chain stops and presents the issue. This is the "auto-retry once" policy.
- **SF-03:** `human-action` checkpoints always block regardless of `auto_advance` or `_auto_chain_active` settings — pre-met by execute-phase.md checkpoint_handling at line 266. Document as hard invariant. No code change needed.
- **SF-04:** `gaps_found` from verify_phase_goal stops the chain and presents the manual recovery path (`/gsd:plan-phase {X} --gaps`) — pre-met by discuss-phase.md return routing (lines 698–701) and plan-phase.md return routing (lines 575–582). Document as hard invariant. No code change needed.
- **SF-05:** `/gsd:auto --stop` clears `_auto_chain_active` immediately (AC-06). This is the emergency stop. Implemented as part of the `/gsd:auto` command (Phase 84).
- **SF-06:** Milestone completion in auto mode is logged to `auto-chain-log.jsonl` for auditability (MM-05). If milestone audit fails, chain stops with audit report.

---

## Phase Design

### Phase 84: Auto Entry Points & Chain Bootstrap

**Goal:** `/gsd:auto` slash command exists in gsdup's project-claude layer and correctly reads STATE.md to find the current phase, bootstraps the chain flag, and invokes discuss-phase --auto. Handles `--from`, `--phases`, and `--stop` flags. Documents new-project --auto as pre-met.

**Depends on:** Nothing (all chain mechanics already exist in workflow files).

**Requirements:** AC-01, AC-02, AC-03, AC-04 (doc), AC-05 (doc), AC-06, SF-05.

**Plans:**

- **84-01: Create `/gsd:auto` slash command**
  - File: `project-claude/commands/gsd/auto.md`
  - Step 1: Parse flags: `--from N`, `--discuss`, `--stop`, `--doctor-interval N`
  - Step 2 (`--stop` path): `config-set workflow._auto_chain_active false`, display "Auto chain cleared." Stop.
  - Step 3 (normal path): Load STATE.md, parse current incomplete phase. If `--from N` provided, use N instead.
  - Step 4: Validate phase exists in ROADMAP.md. Error if not found or already complete.
  - Step 5: If `--doctor-interval N` provided, set `workflow.doctor_interval=N` in config.
  - Step 6: `config-set workflow._auto_chain_active true`
  - Step 7: Display banner: "Auto chain starting at Phase {N} — {name}. Chain will run through all planned milestones."
  - Step 8: If `--discuss` flag set, invoke `Skill(skill="gsd:discuss-phase", args="{phase}")` (interactive, no --auto for this one phase), then after return, invoke `Skill(skill="gsd:plan-phase", args="{phase} --auto")` to resume auto chain.
  - Step 8 (default): `Skill(skill="gsd:discuss-phase", args="{phase} --auto")`
  - After return: Display chain result (COMPLETE, PAUSED, STOPPED).
  - Must install into project-claude layer (not global ~/.claude/commands) — gsdup project-specific command.

- **84-02: Document pre-met entry points (AC-04, AC-05)**
  - File: `get-shit-done/references/auto-mode.md` (create)
  - Document the new-project --auto bootstrap sequence with file:line references.
  - Document _auto_chain_active disk-persistence as a config.json key.
  - Document the Skill() vs Task() anti-nesting pattern with reference to discuss-phase.md #686 comment.

---

### Phase 85: Headless Discuss Path

**Goal:** `discuss-phase` with `--auto` active synthesizes CONTEXT.md from the phase goal when no CONTEXT.md exists, enabling fully unattended phase discussion. The headless path skips interactive questioning and produces a valid planner input.

**Depends on:** Phase 84 (for chain entry); can be developed independently since discuss-phase already receives --auto).

**Requirements:** HD-01, HD-02, HD-03, HD-04.

**Plans:**

- **85-01: Add `auto_synthesize_context` step to discuss-phase.md**
  - File: `get-shit-done/workflows/discuss-phase.md`
  - Insert new step `auto_synthesize_context` before the existing interactive questioning steps, after `init`.
  - Trigger condition: `--auto` flag present (or `AUTO_CHAIN`/`AUTO_CFG` true) AND `has_context` is false AND no `--prd` flag.
  - Step reads:
    - Phase goal line from ROADMAP.md (the `Goal:` field for the current phase)
    - All requirement IDs touching this phase from REQUIREMENTS.md
    - Phase number and name
  - Generates CONTEXT.md with:
    - Standard CONTEXT.md frontmatter (`phase`, `plan_ready`, `generated_by: auto-synthesize`)
    - Domain section: phase goal as the domain description
    - All requirement areas listed with `"Auto-generated from roadmap goal: {phase_goal}"` as the decision value
    - Footer: `Generated automatically by discuss-phase --auto. All areas under Claude's Discretion.`
  - Commits CONTEXT.md: `chore(context): auto-synthesize context for phase {N} --auto`
  - Jumps directly to `auto_advance` step (bypasses all interactive steps including has_context guard).
  - Guard: if CONTEXT.md already exists (HD-03), skip synthesis entirely and proceed to `auto_advance`.

- **85-02: Verify headless path correctness**
  - Add test or verification checklist to `get-shit-done/references/auto-mode.md`:
    - Synthesized CONTEXT.md passes plan-phase's `load_context` validation (required fields present).
    - When CONTEXT.md already exists, `--auto` does NOT overwrite it.
    - When `--prd` is present, synthesis is skipped (PRD path is used).
  - Verify by reading the synthesized CONTEXT.md in a test scenario and checking that plan-phase accepts it.

---

### Phase 86: Settings Surface & Dashboard Panel

**Goal:** `auto_chain_max_phases` is visible and configurable via `/gsd:settings`, and the MCP dashboard shows live auto-chain status. Users have full observability and control without touching config.json directly.

**Depends on:** Phase 84 (chain state must exist to display it meaningfully).

**Requirements:** ST-01, ST-02, ST-03, ST-04, DB-01, DB-02, DB-03, DB-04.

**Plans:**

- **86-01: Wire `doctor_interval` into `/gsd:settings` workflow**
  - File: `get-shit-done/workflows/settings.md`
  - Add 9th AskUserQuestion option: "Doctor checkpoint interval?" with description "Run self-assessment every N phases (0 = disabled, 5 = recommended)". Integer input.
  - update_config step: add `workflow.doctor_interval` to config JSON shape.
  - save_as_defaults step: include `doctor_interval` in `~/.gsd/defaults.json`.
  - confirm display step: add "Doctor interval | every {value} phases" row to the settings table.
  - Note: `auto_advance` boolean is already wired (lines 81–88, 136, 187) — do NOT remove or alter it.

- **86-02: Add `auto-chain-status` MCP tool and `AutoChainPanel` dashboard panel**
  - New MCP tool: `get_auto_chain_status`
    - File: `src/mcp/tools/auto-chain-status.ts`
    - Returns: `{ active: boolean, current_phase: string | null, current_phase_name: string | null, phases_in_chain: number, total_phases: number, chain_started_at: string | null, blocked_on: string | null }`
    - Reads: `_auto_chain_active` from config.json, current phase from STATE.md, total phases + phase names from ROADMAP.md.
  - New collector: `src/dashboard/collectors/auto-chain-collector.ts`
    - Calls `get_auto_chain_status`, returns typed `AutoChainStatus` object.
  - New panel component: `src/components/panels/auto-chain/AutoChainPanel.tsx`
    - Active badge (green "RUNNING" or gray "IDLE")
    - Progress bar: `{phases_in_chain} / {total_phases}` with phase name
    - Blocked-on message when `blocked_on` is set (amber "PAUSED — human-action checkpoint")
    - Idle message: "Run /gsd:auto to start chain" with current phase suggestion
  - Wire into dashboard generator (`src/dashboard/dashboard-generator.ts`) following skill-loads panel pattern.
  - Export from barrel (`src/components/panels/index.ts`).

---

### Phase 87: Doctor Checkpoints & Gate Retry

**Goal:** Doctor self-assessment runs at configurable intervals during auto chain, code-reviewing recent output and checking for quality drift. Gate retry gives the executor one chance to fix strict-mode blocks before stopping the chain.

**Depends on:** Phase 84 (chain state), Phase 86 (doctor_interval setting).

**Requirements:** DC-01, DC-02, DC-03, DC-04, DC-05, DC-06, SF-01, SF-02.

**Plans:**

- **87-01: Implement doctor checkpoint agent and chain integration**
  - Files: `get-shit-done/workflows/discuss-phase.md`, `get-shit-done/agents/gsd-doctor.md` (new)
  - Create `gsd-doctor.md` agent spec — a diagnostic subagent that runs 4 checks:
    1. **Code review**: `git diff HEAD~{N}..HEAD` — spawn code-review skill on the diff
    2. **Test health**: run project test command, check for failures or coverage regression
    3. **Correction density**: read corrections.jsonl, compare recent phase rate to project average
    4. **Scope drift**: compare actual lines changed to plan task count (heuristic: >3x expected = flag)
  - Output: `DOCTOR-CHECK-{N}.md` in `.planning/auto-chain/` with pass/flag/fail per check
  - Wire into discuss-phase auto_advance step:
    1. Read `workflow.doctor_interval` from config (default: 5, 0 = disabled)
    2. Read `workflow._auto_chain_phase_count` from config (incremented each phase)
    3. If `doctor_interval > 0` AND `phase_count % doctor_interval == 0`: spawn doctor agent
    4. If doctor passes: log "Doctor check passed", increment counter, continue chain
    5. If doctor flags issues: pause chain, present report, AskUserQuestion "Continue, investigate, or stop?"
  - Counter (`_auto_chain_phase_count`): incremented in discuss-phase auto_advance, reset when `_auto_chain_active` cleared

- **87-02: Implement gate auto-retry in execute-phase**
  - File: `get-shit-done/workflows/execute-phase.md`
  - In checkpoint_handling: when `quality.level == "strict"` and a gate blocks:
    1. First occurrence: log "Gate blocked — auto-retrying", re-run the executor task
    2. Second occurrence (same gate): stop chain, present issue to user
  - Track retry state via `_gate_retry_count` in executor context (not persisted — per-execution only)

---

### Phase 88: Multi-Milestone Chaining & Integration Tests

**Goal:** Auto chain crosses milestone boundaries automatically, completing each milestone (audit → verify → archive) and advancing to the next. Chain continues until no more milestones are planned. All safety invariants documented and tested end-to-end.

**Depends on:** Phases 84–87 all complete.

**Requirements:** MM-01, MM-02, MM-03, MM-04, MM-05, SF-03 (doc), SF-04 (doc), SF-06.

**Plans:**

- **88-01: Wire multi-milestone chaining into transition.md**
  - File: `get-shit-done/workflows/transition.md`
  - Modify Route B (`is_last_phase: true`):
    - Current behavior: clears `_auto_chain_active`, invokes `/gsd:complete-milestone`
    - New behavior when `_auto_chain_active` is true:
      1. Do NOT clear `_auto_chain_active`
      2. Auto-invoke milestone completion flow: `Skill("gsd:audit-milestone")` → `Skill("gsd:complete-milestone", "{version} --auto")`
      3. Log to `auto-chain-log.jsonl`: `{ event: "milestone_complete", milestone, phases_completed, timestamp }`
      4. Detect next planned milestone from MILESTONES.md / main ROADMAP.md
      5. If next milestone exists: `Skill("gsd:discuss-phase", "{first_phase} --auto")` on new milestone
      6. If no more milestones: clear `_auto_chain_active`, display final summary (milestones completed, total phases, total time)
  - Modify `/gsd:complete-milestone` to accept `--auto` flag:
    - Skip confirmation prompts
    - Auto-approve archive
    - Return milestone summary instead of interactive next-steps
  - If milestone audit fails (gaps found): stop chain, present audit report, require human decision

- **88-02: Integration tests and invariant documentation**
  - File: `get-shit-done/references/auto-mode.md` (extend)
  - Document all safety invariants:
    - `human-action` checkpoints always block: execute-phase.md line 266
    - `gaps_found` stops chain: discuss-phase.md lines 698–701, plan-phase.md lines 575–582
    - Doctor checkpoints flag quality drift: discuss-phase auto_advance step
    - Gate auto-retry: one chance before stopping chain
    - Milestone audit failure stops chain with report
    - No-more-milestones terminates chain with summary
  - Write verification test scenarios:
    - Scenario A: `human-action` checkpoint blocks regardless of `auto_advance: true`
    - Scenario B: `gaps_found` stops chain at discuss-phase return routing
    - Scenario C: Multi-milestone chain crosses boundary and starts next milestone
    - Scenario D: No more milestones — chain terminates with summary
    - Scenario E: `/gsd:auto --stop` clears chain immediately
    - Scenario F: CONTEXT.md exists — headless path skips synthesis
    - Scenario G: No CONTEXT.md — headless path synthesizes, planner accepts
    - Scenario H: Strict quality gate blocks — auto-retry once, then stop
    - Scenario I: Doctor check flags issues — chain pauses with diagnostic report
    - Scenario J: Doctor check passes — chain continues with log entry
    - Scenario K: Milestone audit fails — chain stops with audit report
    - Scenario L: `--discuss` flag forces interactive discussion for one phase, then resumes auto

---

## Implementation Notes

### Why Skill() Not Task() for Chaining

All auto-advance steps use `Skill()` to invoke the next workflow, NOT `Task()`. This keeps execution at the same nesting level. Using `Task()` would create: discuss spawns a task which spawns plan which spawns execute — three levels deep. Deep Task nesting caused the context explosion described in discuss-phase.md comment #686, which resulted in runtime freezes. `Skill()` executes inline in the current context window, keeping the chain flat regardless of how many phases it runs.

The existing Skill() invocations in the codebase:
- `discuss → plan`: `Skill(skill="gsd:plan-phase", args="${PHASE} --auto")` (discuss-phase.md, line 670)
- `plan → execute`: `Skill(skill="gsd:execute-phase", args="${PHASE} --auto --no-transition")` (plan-phase.md, line 559)
- `execute → transition`: inline read-and-follow of `transition.md` (execute-phase.md, line 540)
- `transition → next discuss`: `SlashCommand("/gsd:discuss-phase [X+1] --auto")` (transition.md, lines 392/404)

### Config Key Architecture

Four config keys govern auto mode:

| Key | Type | Scope | Description |
|-----|------|-------|-------------|
| `workflow.auto_advance` | boolean | Persistent preference | User's standing preference. Survives sessions. Set via /gsd:settings or new-project --auto. |
| `workflow._auto_chain_active` | boolean | Ephemeral (disk-backed) | Chain is currently running. Cleared on manual invocations, --stop, gaps found, or no-more-milestones. NOT cleared at milestone boundary (chains across milestones). |
| `workflow.doctor_interval` | integer | Persistent preference | Doctor checkpoint interval. 0 = disabled, 5 = recommended. Set via /gsd:settings or /gsd:auto --doctor-interval N. |
| `workflow._auto_chain_phase_count` | integer | Ephemeral (session) | Counter for phases advanced in current chain run. Used by doctor checkpoint trigger. Reset when `_auto_chain_active` is cleared. |

Key design decisions:
- User can set `auto_advance=true` without triggering a chain (chain only starts when `--auto` is passed or `/gsd:auto` is invoked).
- Manual invocation of any workflow clears `_auto_chain_active` without touching `auto_advance` preference.
- Interrupted chains do not re-trigger on next session start.
- **Multi-milestone**: `_auto_chain_active` is NOT cleared at milestone boundaries — chain continues through all planned milestones. Only cleared on: manual invocation, `--stop`, gaps_found, or no more milestones.

### discuss-phase Headless Path Decision

Auto-mode CONTEXT.md generation uses only the phase goal and requirements as input. This is intentional: in headless mode Claude has full discretion on HOW to implement — the ROADMAP already defines WHAT to build. The synthesized CONTEXT.md is a minimal stub that satisfies the planner's "CONTEXT.md loaded" requirement. This differs from vanilla GSD's `new-project --auto`, which synthesizes from a provided PRD document. In gsdup, the ROADMAP IS the document — per-phase goals already encode the same information a PRD would provide for that phase.

The synthesized CONTEXT.md uses `generated_by: auto-synthesize` in frontmatter so plan-phase can detect that it was auto-generated and potentially flag it in the plan summary for user awareness (optional enhancement, not required for v16.0).

### Dashboard Panel Architecture

The auto-chain panel follows the exact same pattern as existing panels:

| Layer | File | Pattern Example |
|-------|------|-----------------|
| MCP tool | `src/mcp/tools/auto-chain-status.ts` | `src/mcp/tools/skill-loads.ts` |
| Collector | `src/dashboard/collectors/auto-chain-collector.ts` | `src/dashboard/collectors/skill-loads-collector.ts` |
| Panel component | `src/components/panels/auto-chain/AutoChainPanel.tsx` | `src/components/panels/skill-loads/` |
| Generator wiring | `src/dashboard/dashboard-generator.ts` | existing barrel entries |
| Barrel export | `src/components/panels/index.ts` | existing exports |

### Milestone Boundary Chaining

`/gsd:auto` chains through ALL planned milestones. At `is_last_phase`, instead of clearing the chain flag, transition.md auto-invokes the milestone completion flow (audit → complete → archive), then detects the next planned milestone and continues the chain. The chain only terminates when:
1. No more milestones are planned
2. A blocking condition occurs (human-action, gaps_found, doctor flags, gate block after retry)
3. User runs `/gsd:auto --stop`

Doctor checkpoints serve as the periodic review mechanism, replacing the milestone-boundary-as-checkpoint pattern. This gives finer-grained control: a user can set `doctor_interval: 3` to get a health check every 3 phases regardless of milestone boundaries.

### Settings Backward Compatibility

`auto_advance` is already wired in settings.md (lines 81–88, 136, 187). Phase 86-01 adds `auto_chain_max_phases` alongside it but does NOT change the existing `auto_advance` option's position, label, or behavior. Settings are additive.

---

## Estimated Effort

| Phase | Plans | Complexity | Primary Files |
|-------|-------|------------|---------------|
| 84 | 2 | Low | `project-claude/commands/gsd/auto.md` (new), `get-shit-done/references/auto-mode.md` (new) |
| 85 | 2 | Medium | `get-shit-done/workflows/discuss-phase.md` (modify) |
| 86 | 2 | Medium-High | `get-shit-done/workflows/settings.md` (modify), `src/mcp/tools/auto-chain-status.ts` (new), dashboard components (new) |
| 87 | 2 | High | `get-shit-done/agents/gsd-doctor.md` (new), `discuss-phase.md` (modify), `execute-phase.md` (modify) |
| 88 | 2 | High | `get-shit-done/workflows/transition.md` (modify), `complete-milestone` (modify), `references/auto-mode.md` (extend) |

Total: 10 plans across 5 phases. Larger than any single previous milestone — closest comparison is v8.0 Close the Loop (4 phases) + v9.0 Signal Intelligence (6 phases) combined.

---

## What This Enables

Once v16.0 ships, a user can type:

```
/gsd:auto
```

And gsdup will:
1. Find the current incomplete phase in STATE.md
2. If no CONTEXT.md: synthesize it from the phase goal in ROADMAP.md (headless path)
3. If CONTEXT.md exists: use it directly
4. Plan the phase with research and verification
5. Execute all plans, auto-approving `human-verify` and `decision` checkpoints
6. If strict gate blocks: auto-retry once before stopping
7. Transition to the next phase
8. Every N phases (configurable): run doctor self-assessment — code review, test health, correction density, scope drift
9. At milestone boundary: auto-complete milestone (audit → archive), advance to next milestone
10. Repeat until no more milestones are planned or a blocking condition occurs

**The user can walk away while the entire project builds itself.**

The only times intervention is required:
- `human-action` checkpoint (auth gates, destructive operations — hard invariant)
- Verification `gaps_found` (quality issues need human judgment — hard invariant)
- Doctor check flags quality drift (configurable interval, presents diagnostic report)
- Strict gate blocks after auto-retry (quality enforcement)
- Milestone audit failure (gaps in milestone requirements)
- No more milestones planned (chain complete — natural termination)

Optional mid-chain intervention:
- `/gsd:auto --discuss` — force interactive discussion for next phase, then resume auto
- `/gsd:auto --stop` — emergency stop, clears chain immediately

---

## Design Decisions (Resolved 2026-04-04)

These questions were resolved in discussion with the user. Decisions are **locked** — treat as requirements.

### 1. Headless discuss: `--discuss` override — APPROVED

Add a `--discuss` flag to `/gsd:auto` that forces interactive discuss-phase for the current phase only, then resumes auto chain. This lets the user provide direction on specific phases mid-chain. The headless path (auto-synthesize from ROADMAP) remains the default for unattended phases.

**Impact:** New flag on `/gsd:auto` command (Phase 84), discuss-phase must detect `--discuss` override even when `--auto` is active.

### 2. Phase cap: NOT NEEDED — DROPPED

`auto_chain_max_phases` is dropped entirely. Milestone boundaries + human-action checkpoints + doctor checkpoints (see #3) are sufficient safety rails. This simplifies the config architecture (3 keys instead of 4), removes Phase 87-01 enforcement logic, and removes ST-01/ST-02/ST-03 settings wiring.

**Impact:** Remove AC-03, SF-01, SF-02, ST-01, ST-02, ST-03. Remove `_auto_chain_phase_count` counter. Phase 87-01 becomes doctor checkpoint implementation instead.

### 3. Multi-milestone chaining: FULL PIPELINE — MAJOR SCOPE EXPANSION

The auto chain should NOT stop at milestone boundaries. Instead, `/gsd:auto` chains through ALL planned milestones end-to-end:
- At milestone boundary: auto-invoke the full completion flow (audit → verify → integration-check → complete-milestone → archive)
- After milestone completion: detect next planned milestone, invoke `/gsd:auto` on it
- Continue until no more milestones are planned or a blocking condition occurs

**Doctor checkpoints:** Periodically (every N phases, configurable), GSD enters a self-assessment workflow:
- Spawns a code-review agent to audit recent changes for quality drift
- Checks test coverage trends (are tests still passing? coverage dropping?)
- Reviews correction density (has the learning loop flagged recurring issues?)
- Checks git diff size vs plan scope (scope creep detection)
- If issues found: pauses chain, presents diagnostic report, asks "Continue or investigate?"
- If clean: logs "Doctor check passed at phase {N}", continues chain

This transforms auto mode from "single milestone autopilot" to "full project autopilot with periodic health checks."

**Impact:** Adds new requirement group (DC — Doctor Checkpoints). Adds new phase (88: Multi-Milestone Chaining + Doctor). Transition.md Route B must chain instead of stopping. Complete-milestone must be auto-invocable.

### 4. Strict quality gates: AUTO-RETRY ONCE — APPROVED

When `quality.level` is `"strict"` and a gate blocks during auto mode, the executor gets one automatic retry to fix the issue before stopping the chain. This reduces false-positive interruptions while maintaining quality enforcement. If the retry also fails, the chain stops and presents the issue.

**Impact:** execute-phase checkpoint_handling needs a retry counter for gate blocks. Phase 87-02 adds Scenario H: "auto mode + strict quality — gate retry then block."

### 5. PRD-driven auto per-phase: DEFERRED to v17.0

No change from original proposal. PRD chunking is interesting but complex — deferred.
