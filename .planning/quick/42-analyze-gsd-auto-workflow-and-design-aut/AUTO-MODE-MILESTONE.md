# v16.0 Auto Mode — Milestone Design

## Overview

Auto Mode allows a user to invoke `/gsd:auto` and have gsdup autonomously chain discuss-phase → plan-phase → execute-phase → transition across every phase in a milestone, pausing only when a human-action checkpoint or verification gap requires human judgment. The result is a hands-off execution loop that respects quality gates and safety rails while eliminating the manual `/clear`-and-reinvoke ceremony between phases.

The gsdup codebase already has the overwhelming majority of this infrastructure in place. All three workflow entry points (discuss-phase.md, plan-phase.md, execute-phase.md) have `--auto` flag parsing, `_auto_chain_active` chain flag syncing, chain flag reading, Skill()-based chaining to keep nesting flat, and stop conditions for gap/checkpoint cases. The transition.md workflow clears the chain flag at milestone boundaries and invokes the next phase's slash command with `--auto` when YOLO mode is active. new-project.md bootstraps the chain from a PRD document and sets both `auto_advance: true` in config and `_auto_chain_active: true` before invoking discuss-phase 1 --auto.

What this milestone adds is narrow and precise: a `/gsd:auto` entry point that starts the chain mid-project (new-project only covers greenfield), a headless path in discuss-phase that synthesizes CONTEXT.md from the roadmap when `--auto` is active and no CONTEXT.md exists (today it still requires interactive questioning), surface-level observability in the MCP dashboard, and safety-cap enforcement via `auto_chain_max_phases`. Together these four additions close the loop from "chain mechanics work" to "a user can type `/gsd:auto` on any active milestone and walk away."

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

### Gap 4: No runaway prevention (auto_chain_max_phases)

There is no mechanism to cap how many phases auto-advance can chain before pausing for a check-in. A 52-phase milestone run completely headless with no intervention points (beyond human-action checkpoints) may be more automation than a user intends. `auto_chain_max_phases` provides a configurable safety cap.

### Gap 5: auto_chain_max_phases missing from /gsd:settings

This flows from Gap 4. Once `auto_chain_max_phases` is implemented, it must be exposed in `/gsd:settings` so users can configure it without manually editing config.json. (Note: `auto_advance` is already in settings — this gap is specifically about the new integer setting for max phases.)

---

## Requirements

### AUTO-CHAIN (AC) — Entry Points & Orchestration

- **AC-01:** `/gsd:auto` slash command reads STATE.md to find current incomplete phase, validates the phase is not already complete, sets `_auto_chain_active=true`, and invokes `Skill("gsd:discuss-phase", "{phase} --auto")`. If no CONTEXT.md exists for the phase, the headless path (HD-01) handles it.
- **AC-02:** `/gsd:auto --from N` flag overrides STATE.md phase detection and starts the chain at phase N. Validates phase N exists in ROADMAP.md.
- **AC-03:** `/gsd:auto --phases N` flag sets `auto_chain_max_phases=N` for this run (one-time, does not write to config). Chain pauses after N phases regardless of milestone progress.
- **AC-04:** `new-project --auto` already bootstraps the chain — this is pre-met. Document it as implemented and verify the config-set + SlashCommand sequence at lines 195, 212, 1074 of new-project.md.
- **AC-05:** Chain flag persists across context compaction via disk-backed `_auto_chain_active` in config.json — pre-met. Document as implemented invariant.
- **AC-06:** `--stop` flag: `/gsd:auto --stop` clears `_auto_chain_active` immediately and displays confirmation. No chaining occurs.

### HEADLESS-DISCUSS (HD) — Auto Context Generation

- **HD-01:** When `--auto` is active (flag or chain flag) and `has_context` is false (no CONTEXT.md exists for the phase) and no `--prd` flag is present, discuss-phase reads the phase goal and requirements from ROADMAP.md and REQUIREMENTS.md, synthesizes a CONTEXT.md, commits it, and proceeds directly to the `auto_advance` step — skipping the interactive questioning loop entirely.
- **HD-02:** Synthesized CONTEXT.md marks every decision field with `"Auto-generated from roadmap goal: {phase_goal}"` and places all implementation areas under "Claude's Discretion". The synthesized file must pass the planner's CONTEXT.md validation check (has required frontmatter and domain section).
- **HD-03:** When CONTEXT.md already exists for the phase and `--auto` is active, discuss-phase uses the existing CONTEXT.md as-is and proceeds directly to `auto_advance`. The synthesis path is skipped entirely.
- **HD-04:** When `--prd` flag is present (PRD express path), `--auto` uses the PRD-derived context directly as the headless input. PRD-derived context counts as headless-ready.

### SETTINGS (ST) — User Control Surface

- **ST-01:** `/gsd:settings` exposes `workflow.auto_chain_max_phases` as a configurable integer with label "Auto-chain phase cap" and description "Maximum phases to chain before pausing for a check-in (0 = unlimited)". Default: 0.
- **ST-02:** `/gsd:settings` update_config step writes `workflow.auto_chain_max_phases` to config.json alongside the existing `auto_advance` field.
- **ST-03:** `/gsd:settings` save_as_defaults step includes `auto_chain_max_phases` in `~/.gsd/defaults.json`.
- **ST-04:** `gsd-tools config-get workflow._auto_chain_active` already works (pre-met) — document as the mechanism for querying live chain state.

### DASHBOARD (DB) — Observability

- **DB-01:** The MCP dashboard has an "Auto Chain" panel (`AutoChainPanel`) showing: active/idle badge, current phase name, phases completed in this chain run, total phases in milestone, estimated completion (phases remaining × avg phase duration if available), and a "PAUSED — human-action checkpoint" message when blocked.
- **DB-02:** The panel's collector reads `_auto_chain_active` from config.json, current phase position from STATE.md, and total phases + phase names from ROADMAP.md.
- **DB-03:** Dashboard panel updates via standard MCP poll (same pattern as gate-health and skill-loads panels — no push required).
- **DB-04:** When `_auto_chain_active` is false, panel displays "Idle — run /gsd:auto to start chain" with the current phase as the suggested entry point.

### SAFETY (SF) — Runaway Prevention

- **SF-01:** When `workflow.auto_chain_max_phases` is non-zero and the chain has advanced that many phases in the current session, the chain pauses before invoking the next discuss-phase. Displays: phases completed, time elapsed, phase names completed, and "Continue N more phases? (y/n)" prompt.
- **SF-02:** On pause (SF-01), user must explicitly continue. `/gsd:auto --phases N` can be used to continue with a new cap. The chain flag (`_auto_chain_active`) remains true during the pause — it is not cleared, preventing accidental orphan chains on context reset.
- **SF-03:** `human-action` checkpoints always block regardless of `auto_advance` or `_auto_chain_active` settings — pre-met by execute-phase.md checkpoint_handling at line 266. Document as hard invariant. No code change needed.
- **SF-04:** `gaps_found` from verify_phase_goal stops the chain and presents the manual recovery path (`/gsd:plan-phase {X} --gaps`) — pre-met by discuss-phase.md return routing (lines 698–701) and plan-phase.md return routing (lines 575–582). Document as hard invariant. No code change needed.
- **SF-05:** `/gsd:auto --stop` clears `_auto_chain_active` immediately (AC-06). This is the emergency stop. Implemented as part of the `/gsd:auto` command (Phase 84).

---

## Phase Design

### Phase 84: Auto Entry Points & Chain Bootstrap

**Goal:** `/gsd:auto` slash command exists in gsdup's project-claude layer and correctly reads STATE.md to find the current phase, bootstraps the chain flag, and invokes discuss-phase --auto. Handles `--from`, `--phases`, and `--stop` flags. Documents new-project --auto as pre-met.

**Depends on:** Nothing (all chain mechanics already exist in workflow files).

**Requirements:** AC-01, AC-02, AC-03, AC-04 (doc), AC-05 (doc), AC-06, SF-05.

**Plans:**

- **84-01: Create `/gsd:auto` slash command**
  - File: `project-claude/commands/gsd/auto.md`
  - Step 1: Parse flags: `--from N`, `--phases N`, `--stop`
  - Step 2 (`--stop` path): `config-set workflow._auto_chain_active false`, display "Auto chain cleared." Stop.
  - Step 3 (normal path): Load STATE.md, parse current incomplete phase. If `--from N` provided, use N instead.
  - Step 4: Validate phase exists in ROADMAP.md. Error if not found or already complete.
  - Step 5: If `--phases N` provided, set `workflow.auto_chain_max_phases=N` in config (one-time).
  - Step 6: `config-set workflow._auto_chain_active true`
  - Step 7: Display banner: "Auto chain starting at Phase {N} — {name}. Chain will run to milestone boundary."
  - Step 8: `Skill(skill="gsd:discuss-phase", args="{phase} --auto")`
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

- **86-01: Wire `auto_chain_max_phases` into `/gsd:settings` workflow**
  - File: `get-shit-done/workflows/settings.md`
  - Add 9th AskUserQuestion option: "Auto-chain phase cap?" with description "Max phases to chain before pausing (0 = unlimited, recommended for first use)". Integer input or "Unlimited" select.
  - update_config step: add `workflow.auto_chain_max_phases` to config JSON shape.
  - save_as_defaults step: include `auto_chain_max_phases` in `~/.gsd/defaults.json`.
  - confirm display step: add "Auto-chain cap | {value}" row to the settings table.
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

### Phase 87: Safety Rails & Integration Tests

**Goal:** Runaway prevention works end-to-end, all safety invariants are documented and regression-tested, and the complete auto-chain can be demonstrated with a controlled test scenario.

**Depends on:** Phases 84–86 all complete.

**Requirements:** SF-01, SF-02, SF-03 (doc), SF-04 (doc), SF-05.

**Plans:**

- **87-01: Implement `auto_chain_max_phases` enforcement in auto_advance steps**
  - Files: `get-shit-done/workflows/discuss-phase.md`, `plan-phase.md`
  - In each `auto_advance` step, before invoking the next Skill():
    1. Read `workflow.auto_chain_max_phases` from config.
    2. Read `workflow._auto_chain_phase_count` from config (new counter — incremented on each phase advance).
    3. If `max_phases > 0` AND `phase_count >= max_phases`: pause chain.
    4. Pause display:
       ```
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        GSD ► AUTO-CHAIN PAUSED — phase cap reached
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Phases completed this run: {phase_count}
       Phases completed: {list of phase names}
       Continue? Run: /gsd:auto --phases {N}
       Or clear chain: /gsd:auto --stop
       ```
    5. Stop. Do NOT invoke next Skill(). Do NOT clear `_auto_chain_active`.
  - Add `_auto_chain_phase_count` counter: incremented in discuss-phase auto_advance when chain flag is already active (each phase advance increments). Cleared when `_auto_chain_active` is set to false.

- **87-02: Integration tests and invariant documentation**
  - File: `get-shit-done/references/auto-mode.md` (extend from Phase 84)
  - Document hard safety invariants (no code change — pre-met):
    - `human-action` checkpoints always block: execute-phase.md `checkpoint_handling`, line 266.
    - `gaps_found` stops chain: discuss-phase.md lines 698–701, plan-phase.md lines 575–582.
    - `is_last_phase: true` clears chain flag: transition.md line 467.
  - Document configurable safety rail: `auto_chain_max_phases` enforcement (Phase 87-01).
  - Write verification test scenarios (as numbered checklists, not code tests — these are workflow files, not compiled code):
    - Scenario A: `human-action` checkpoint blocks regardless of `auto_advance: true`
    - Scenario B: `gaps_found` stops chain at discuss-phase return routing
    - Scenario C: `is_last_phase: true` clears chain flag at milestone boundary
    - Scenario D: `auto_chain_max_phases=2` pauses after 2 phases
    - Scenario E: `/gsd:auto --stop` clears chain immediately without running any phase
    - Scenario F: CONTEXT.md already exists — headless path skips synthesis
    - Scenario G: No CONTEXT.md — headless path synthesizes and planner accepts output

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

Three config keys govern auto mode:

| Key | Type | Scope | Description |
|-----|------|-------|-------------|
| `workflow.auto_advance` | boolean | Persistent preference | User's standing preference. Survives sessions. Set via /gsd:settings or new-project --auto. |
| `workflow._auto_chain_active` | boolean | Ephemeral (disk-backed) | Chain is currently running. Cleared on manual invocations, milestone boundaries, --stop, gaps found. |
| `workflow.auto_chain_max_phases` | integer | Persistent preference | Safety cap. 0 = unlimited. Set via /gsd:settings or /gsd:auto --phases N (one-time). |
| `workflow._auto_chain_phase_count` | integer | Ephemeral (session) | Counter for phases advanced in current chain run. Reset when `_auto_chain_active` is cleared. |

The two-key design (persistent preference + ephemeral chain flag) is intentional:
- User can set `auto_advance=true` without triggering a chain (chain only starts when `--auto` is passed or `/gsd:auto` is invoked).
- Manual invocation of any workflow clears `_auto_chain_active` without touching `auto_advance` preference.
- Interrupted chains do not re-trigger on next session start.

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

### Milestone vs Phase Boundary

`/gsd:auto` operates within a single milestone. It starts at the current position in STATE.md and runs until `is_last_phase` triggers the chain flag clear in transition.md (line 467). To chain across milestones, the user runs `/gsd:auto` again after `/gsd:complete-milestone`. This is intentional: milestone boundaries are natural human checkpoints. Crossing milestone boundaries automatically would remove a meaningful review opportunity.

### Settings Backward Compatibility

`auto_advance` is already wired in settings.md (lines 81–88, 136, 187). Phase 86-01 adds `auto_chain_max_phases` alongside it but does NOT change the existing `auto_advance` option's position, label, or behavior. Settings are additive.

---

## Estimated Effort

| Phase | Plans | Complexity | Primary Files |
|-------|-------|------------|---------------|
| 84 | 2 | Low | `project-claude/commands/gsd/auto.md` (new), `get-shit-done/references/auto-mode.md` (new) |
| 85 | 2 | Medium | `get-shit-done/workflows/discuss-phase.md` (modify) |
| 86 | 2 | Medium-High | `get-shit-done/workflows/settings.md` (modify), `src/mcp/tools/auto-chain-status.ts` (new), `src/dashboard/collectors/auto-chain-collector.ts` (new), `src/components/panels/auto-chain/AutoChainPanel.tsx` (new) |
| 87 | 2 | Medium | `get-shit-done/workflows/discuss-phase.md` + `plan-phase.md` (modify), `get-shit-done/references/auto-mode.md` (extend) |

Total: 8 plans across 4 phases — comparable to v13.0 Unified Observability.

---

## What This Enables

Once v16.0 ships, a user mid-project can type:

```
/gsd:auto
```

And gsdup will:
1. Find the current incomplete phase in STATE.md
2. If no CONTEXT.md: synthesize it from the phase goal in ROADMAP.md (headless path)
3. If CONTEXT.md exists: use it directly
4. Plan the phase with research and verification
5. Execute all plans, auto-approving `human-verify` and `decision` checkpoints
6. Transition to the next phase
7. Repeat until milestone boundary (`is_last_phase: true`) or a blocking condition

The only times the user must intervene:
- `human-action` checkpoint (auth gates, destructive operations — hard invariant, cannot be automated)
- Verification `gaps_found` (quality issues need human judgment — hard invariant)
- `auto_chain_max_phases` cap reached (configurable safety check-in)
- Milestone boundary (natural stopping point — run `/gsd:auto` again to continue next milestone)

---

## Open Questions

1. **discuss-phase headless quality**: Will plans generated from auto-synthesized CONTEXT.md be as good as plans from interactive discussion? The synthesized stub gives Claude full discretion on implementation — this is probably fine for well-specified phases with detailed ROADMAP goals, but may produce weaker plans for phases with vague goals. A potential mitigation: add a `--discuss` flag to `/gsd:auto` that forces interactive discuss-phase even in auto mode, for phases where the user wants to provide direction before the chain runs. This flag would override the headless path for that specific phase only.

2. **Phase count tracking across context compaction**: `_auto_chain_phase_count` is described as ephemeral-but-disk-backed. If the context compacts mid-chain, the counter persists in config.json and can be read on the next invocation. But "phases in this chain run" semantics become ambiguous if the user manually runs a phase between two auto-chain segments. Consider whether `_auto_chain_phase_count` should reset whenever `_auto_chain_active` is cleared (current proposal), or persist across multiple chain runs for accurate total tracking. The current proposal (reset on clear) is simpler and matches the SF-01 use case (per-run cap).

3. **multi-milestone auto**: Is there a use case for `/gsd:auto --all-milestones` that chains across milestone boundaries? Probably not — milestone boundaries exist for good reason, and crossing them automatically removes a natural human checkpoint. Deferred from v16.0. If requested in the future, the mechanism would be: on milestone boundary, instead of displaying "complete milestone" prompt, auto-invoke `/gsd:complete-milestone` and then `/gsd:auto` on the next milestone. The safety implications of unattended milestone completion (archiving, state writes) warrant a separate design discussion.

4. **PRD-driven auto per-phase**: `/gsd:auto --prd prd.md` would use the PRD express path for CONTEXT.md in every phase. This is interesting but complex — the PRD covers the whole product, individual phases need per-phase extraction from the PRD rather than using it wholesale. This would require a "PRD chunking" step that extracts the relevant section for each phase. Deferred to a Phase 85 follow-on or v17.0.

5. **Auto-mode quality gate interaction**: When `quality.level` is `"strict"`, gates block on issues. In auto mode, a gate block stops execution and presents the issue to the user. This is correct behavior — strict gates should never be bypassed by auto mode. However, the current codebase does not explicitly document this interaction. Phase 87-02 should add a Scenario H: "auto mode + strict quality level — gate block stops chain" to the invariants documentation.
