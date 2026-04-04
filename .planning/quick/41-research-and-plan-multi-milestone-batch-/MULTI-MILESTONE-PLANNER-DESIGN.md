# Multi-Milestone Batch Planning: Design Document

*Quick Task 41 — Research Output*
*Date: 2026-04-04*
*Status: Design complete — all decisions locked (Section 5 resolved)*
*Updated: 2026-04-04 — Synthesizer architecture, /gsd:multi-milestone command, per-milestone scoping*

---

## Section 1 — Current Workflow Analysis

### 1.1 Session Boundary Problem

The existing `new-milestone.md` workflow is a single-session, single-milestone pipeline. One `/gsd:new-milestone` invocation:

1. Loads project context from `PROJECT.md`, `MILESTONES.md`, `STATE.md`
2. Gathers milestone goals (from `MILESTONE-CONTEXT.md` or inline conversation)
3. Creates one milestone workspace via `milestone new-workspace <version>`
4. Runs 4+1 parallel research agents (Stack, Features, Architecture, Pitfalls + synthesizer)
5. Interactively scopes requirements via `AskUserQuestion`
6. Spawns one `gsd-roadmapper` agent
7. Updates root `ROADMAP.md` and commits

The hard session boundary is architectural: each interactive `AskUserQuestion` call round-trips through the user's conversation window. After two full milestones of research + requirements discussion + roadmapping, the context window is deep into overhead from conversation history. Milestone 3 starts with degraded context quality; milestone 5 is typically incoherent or stalled.

There is no built-in checkpoint, resume, or batch concept. The user must `/clear` between milestones, losing continuity. If they forget to update root `ROADMAP.md` before clearing, `getHighestPhaseNumber()` may produce wrong results on the next invocation.

### 1.2 Milestone Workspace Anatomy

**Global files (all milestones share):**

| File | Location | Purpose |
|------|----------|---------|
| `PROJECT.md` | `.planning/PROJECT.md` | Core value, principles, non-negotiables |
| `MILESTONES.md` | `.planning/MILESTONES.md` | Live dashboard — all milestone status |
| `ROADMAP.md` | `.planning/ROADMAP.md` | Global phase registry with "Phases X-Y" ranges |
| `config.json` | `.planning/config.json` | `concurrent: true`, model assignments, workflow flags |

**Per-milestone files (each workspace is isolated):**

| File/Dir | Location | Purpose |
|----------|----------|---------|
| `STATE.md` | `.planning/milestones/vX.Y/STATE.md` | Milestone-specific progress, blockers |
| `ROADMAP.md` | `.planning/milestones/vX.Y/ROADMAP.md` | Phase details for this milestone only |
| `REQUIREMENTS.md` | `.planning/milestones/vX.Y/REQUIREMENTS.md` | Scoped requirements with REQ-IDs |
| `conflict.json` | `.planning/milestones/vX.Y/conflict.json` | File-overlap advisory manifest |
| `phases/` | `.planning/milestones/vX.Y/phases/` | Plan files, phase directories |
| `research/` | `.planning/milestones/vX.Y/research/` | Research output (STACK.md, FEATURES.md, etc.) |

**Phase numbering:** Global sequence. `getHighestPhaseNumber(cwd)` scans all three sources:
1. Phase directory names under `.planning/milestones/*/phases/` — extracts integer base
2. "Phases X-Y" ranges in root `ROADMAP.md`
3. Phase range columns in root `STATE.md` completed milestones table

`next_starting_phase = highestPhase + 1`. This value is returned by `init new-milestone` and must be fed to the roadmapper explicitly. The roadmapper does not recompute it independently.

### 1.3 Existing Parallelism

**`new-milestone.md` parallel pattern:**
```
Step 8: 4 gsd-project-researcher agents in parallel (Stack, Features, Architecture, Pitfalls)
Step 8: 1 gsd-research-synthesizer after all 4 complete
Step 10: 1 gsd-roadmapper (sequential, after user confirms requirements)
```

**`plan-phase.md` sequential pattern:**
```
Step 5: 1 gsd-phase-researcher
Step 8: 1 gsd-planner (after research)
Step 10: 1 gsd-plan-checker (after planner, max 3 iterations)
```

The batch planner can leverage both patterns: run research agents N×4 concurrently across milestones, then serialize roadmappers only for phase-slot assignment, then run all N roadmappers in parallel once slots are pre-assigned.

### 1.4 Conflict Detection

`milestone manifest-check` reads all active `conflict.json` files and cross-references `files_touched` arrays. If two milestones list the same file, it reports an advisory warning. It is purely informational — it does not block execution.

The batch planner should call `manifest-check` once after all N workspaces exist, not once per workspace creation. This produces a single consolidated conflict report covering all batch milestones at once.

### 1.5 What Breaks at Scale (5 Milestones Serially)

| Failure Mode | Root Cause | When It Manifests |
|---|---|---|
| **Context window exhaustion** | Each AskUserQuestion + agent spawn adds ~2-8k tokens of history. After 2 full milestones, the working context is ~60% consumed by conversation history. | Milestone 3-4 requirements scoping, where the user needs to make choices but Claude is summarizing instead of presenting clean options. |
| **Phase number drift** | If the user `/clear`s mid-session after creating workspace but before roadmapper writes, `getHighestPhaseNumber()` may scan an incomplete state. If they run a second `/gsd:new-milestone` without clearing, the init call returns stale highest_phase from before milestone 1's roadmap was committed. | Any serial workflow where root `ROADMAP.md` updates happen after the next init call. |
| **Requirements bleed** | No structural isolation between milestones' requirements discussions in a single conversation window. User accidentally confirms a feature for milestone 2 that they mentally scoped to milestone 3. | Requirements scoping step (interactive AskUserQuestion), especially when themes overlap (e.g., "auth" and "user management" both involve users). |
| **No cross-milestone overview** | The current workflow commits each milestone before the user can see how all milestones relate. Roadmap for milestone 3 cannot reference milestone 2's features as dependencies. | After milestone 1 commits and context clears — user cannot go back to adjust milestone 1's scope based on what they learned planning milestone 2. |
| **Workspace creation order** | `milestone new-workspace` is called inside the `new-milestone` workflow at step 7.5. If the user aborts after workspace creation but before roadmapper, a half-initialized workspace exists with no `ROADMAP.md` content. | Re-running `/gsd:new-milestone` on the same version hits idempotency guards in `cmdMilestoneNewWorkspace` (files only written if not present), so the stale files persist. |

---

## Section 2 — Proposed Workflow: `/gsd:multi-milestone`

### Stage 0 — Feature Intake (The Big Dump)

The command accepts freeform feature lists and organizes them into candidate milestone themes before any workspace is created.

**Input parsing:**

```
/gsd:multi-milestone "Feature A, Feature B, Feature C..."
/gsd:multi-milestone --from-brainstorm 34
/gsd:multi-milestone --from-file .planning/quick/34-brainstorm/FEATURE-IDEAS.md
/gsd:multi-milestone --resume 43
```

Input modes:
- **`--from-brainstorm NN`**: Reads `.planning/quick/NN-brainstorm-*/FEATURE-IDEAS.md`, pre-populates clusters from brainstorm's already-clustered output. Bypasses affinity grouping entirely — clusters are already done.
- **`--from-file <path>`**: Reads file as raw idea list, runs affinity grouping.
- **`--resume NN`**: Loads `BATCH-SESSION.md` from task NN, resumes from last completed stage.
- **Inline**: All arguments treated as freeform idea list, runs affinity grouping.

**Counting and display:**

The orchestrator counts top-level items (lines, comma-separated entries, or numbered items). Displays:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MULTI-PLAN — INTAKE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 23 ideas. Grouping into milestone themes...
```

**Clustering (no subagent):** The orchestrator itself performs affinity grouping using domain knowledge from `PROJECT.md`. Clusters are grouped by: feature domain similarity, likely implementation overlap, natural dependency ordering. The orchestrator produces 3-6 candidate clusters.

**Cluster presentation:**

```
Cluster A (7 ideas): Performance & Observability → candidate: "Observable Runtime"
  - Real-time metrics collection
  - Structured log output
  - ... (5 more)

Cluster B (4 ideas): Auth & User Management → candidate: "Auth Layer"
  - Login/logout flow
  - ... (3 more)

[etc.]
```

**AskUserQuestion (multiSelect):** "Which clusters should become milestones in this session?"
Options: one per cluster + "None yet — let me refine clusters first"

**Refinement loop (if "None yet"):** Offer via plain text:
- "Rename a cluster: say 'rename A to X'"
- "Merge clusters: say 'merge A and B'"
- "Split a cluster: say 'split C into C1 and C2'"
- "Move an idea: say 'move idea 7 from A to B'"
- "Mark out of scope: say 'out of scope: idea 12'"

Continue until user promotes clusters to milestones.

**Session artifact:**

Write `BATCH-INTAKE.md` to `.planning/quick/NN-multi-milestone-[YYYY-MM-DD]/BATCH-INTAKE.md`:

```markdown
# Batch Intake — [date]

## Raw Ideas (N total)
[original list verbatim]

## Approved Clusters

### Cluster A → v[X.0] [Name]
[ideas assigned to this cluster]

### Cluster B → v[X+1.0] [Name]
[ideas assigned]

## Deferred Ideas
[out of scope items with reason]
```

---

### Stage 1 — Milestone Shell Creation (Parallel)

**Version assignment:**

Parse `MILESTONES.md` to find the last vX.Y. Auto-assign vX+1.0, vX+2.0, etc. for each approved cluster. Present for confirmation before creating anything:

```
Proposed versions:
  Cluster A → v16.0 Observable Runtime
  Cluster B → v17.0 Auth Layer
  Cluster C → v18.0 Test Maturity

Confirm or adjust?
```

AskUserQuestion: "Proceed with these versions?" — Yes / Adjust names / Adjust version numbers

**Parallel workspace creation:**

Once confirmed, create all N workspaces in parallel (one Bash call each, or N sequential calls pipelined):

```bash
node gsd-tools.cjs milestone new-workspace v16.0 --raw
node gsd-tools.cjs milestone new-workspace v17.0 --raw
node gsd-tools.cjs milestone new-workspace v18.0 --raw
```

**Conflict check (once, after all workspaces exist):**

```bash
node gsd-tools.cjs milestone manifest-check --raw
```

Display result as consolidated advisory.

**Summary table:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MILESTONE WORKSPACES CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone                | Version | Workspace
Observable Runtime       | v16.0   | .planning/milestones/v16.0/
Auth Layer               | v17.0   | .planning/milestones/v17.0/
Test Maturity            | v18.0   | .planning/milestones/v18.0/

Phase slots will be assigned before roadmapping.
```

Update `BATCH-SESSION.md` with workspace creation status and timestamps.

---

### Stage 2 — (Merged into Stage 3)

Research is now per-milestone, interleaved with scoping in Stage 3. The user chooses skip/include for each milestone individually before scoping it. This means research results are fresh in context when the user makes scope decisions.

**Per-milestone research flow (when user opts in):**

Spawn 4 `gsd-project-researcher` agents for that milestone:

```
Task(gsd-project-researcher, milestone=v16.0, dimension=Stack,
     output=.planning/milestones/v16.0/research/STACK.md)
Task(gsd-project-researcher, milestone=v16.0, dimension=Features,
     output=.planning/milestones/v16.0/research/FEATURES.md)
Task(gsd-project-researcher, milestone=v16.0, dimension=Architecture,
     output=.planning/milestones/v16.0/research/ARCHITECTURE.md)
Task(gsd-project-researcher, milestone=v16.0, dimension=Pitfalls,
     output=.planning/milestones/v16.0/research/PITFALLS.md)
```

After all 4 complete, spawn research synthesizer for that milestone. Then proceed to scoping.

**Failure handling:** Same as before — partial research doesn't block scoping.

**Token cost note:** Research is now sequential per-milestone (not N×4 all at once), which reduces peak parallelism but keeps research results in-context for scoping. For N=5 with all research: 5×(4+1) = 25 subagent spawns spread across the session.

---

### Stage 3 — Per-Milestone Requirements Scoping (Sequential, Full Ceremony)

**Decision: Full per-milestone scoping** — same UX as `new-milestone` Step 9.

The multi-milestone command owns the entire funnel: raw feature dump → clustering → milestone splitting → **per-milestone requirements scoping** → parallel research → parallel roadmapping → synthesizer. This is not "run N `new-milestone` in parallel" — it's a single session that handles everything.

**Per-milestone scoping UX:**

For each milestone sequentially, the orchestrator runs the same requirements flow as `new-milestone.md` Step 9:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SCOPING: v16.0 Observable Runtime (1 of 3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ideas assigned to this milestone:
  - Real-time metrics collection
  - Structured log output
  - Metric storage and retention policy
  - Live metrics dashboard panel
  - Alert threshold configuration
```

If research exists for this milestone, read FEATURES.md and present by category. Otherwise, derive categories from the cluster's ideas.

**Scope each category** via AskUserQuestion (multiSelect: true):
- "[Feature 1]" — [brief description]
- "[Feature 2]" — [brief description]
- "None for this milestone" — Defer entire category

**Identify gaps** via AskUserQuestion:
- "No, research covered it" — Proceed
- "Yes, let me add some" — Capture additions

**Generate REQUIREMENTS.md** with REQ-IDs per category (same format as `new-milestone`).

Present full requirements list for confirmation → adjust loop → commit:

```bash
node gsd-tools.cjs commit "docs: define v16.0 requirements (N items)" \
  --files .planning/milestones/v16.0/REQUIREMENTS.md
```

Then move to next milestone. After all N milestones scoped, proceed to Stage 4.

**Research skip/include:** Before each milestone's scoping, ask:

```
AskUserQuestion: "Research v16.0 Observable Runtime before scoping?"
- "Research first" — Spawn 4 researchers for this milestone, synthesize, then scope
- "Skip research" — Scope from cluster ideas directly
```

This replaces the global research toggle from Stage 2. Research happens per-milestone, interleaved with scoping, so the user sees research results before making scope decisions.

---

### Stage 4 — Parallel Roadmapping + Roadmap Synthesizer

**Key architectural decision: Roadmappers produce UNNUMBERED proposals. The synthesizer assigns all numbers.**

This eliminates the phase slot pre-assignment problem entirely. No buffer math, no collision detection, no slot overrun handling.

**Spawn N roadmappers in parallel (unnumbered mode):**

Each roadmapper receives its milestone's REQUIREMENTS.md but is told to produce **unnumbered phase proposals** — phase names, goals, requirement mappings, and success criteria, but NO phase numbers and NO milestone version numbers.

```
Task(gsd-roadmapper, milestone=v16.0, mode="proposal",
     requirements=.planning/milestones/v16.0/REQUIREMENTS.md,
     instructions="Produce unnumbered phase proposals. Use placeholder PHASE-A, PHASE-B, etc.
     Do NOT assign phase numbers. Do NOT write ROADMAP.md directly.
     Return proposals as structured markdown in PROPOSAL.md.")

Task(gsd-roadmapper, milestone=v17.0, mode="proposal", ...)
Task(gsd-roadmapper, milestone=v18.0, mode="proposal", ...)
```

Each roadmapper writes: `.planning/milestones/vX.Y/PROPOSAL.md`

**After all N roadmappers complete — spawn Roadmap Synthesizer:**

New agent: `gsd-roadmap-synthesizer` (modeled on `gsd-research-synthesizer`).

```
Task(gsd-roadmap-synthesizer,
     prompt="
     <files_to_read>
     - .planning/milestones/v16.0/PROPOSAL.md
     - .planning/milestones/v16.0/REQUIREMENTS.md
     - .planning/milestones/v17.0/PROPOSAL.md
     - .planning/milestones/v17.0/REQUIREMENTS.md
     - .planning/milestones/v18.0/PROPOSAL.md
     - .planning/milestones/v18.0/REQUIREMENTS.md
     </files_to_read>

     <context>
     next_starting_phase: ${next_starting_phase}
     milestones_in_order: [v16.0, v17.0, v18.0]
     </context>

     <instructions>
     1. Read all N PROPOSAL.md files
     2. Assign milestone versions in the order provided
     3. Assign phase numbers sequentially starting from next_starting_phase
        - v16.0 gets phases ${next_starting_phase} through ${next_starting_phase + v16_phase_count - 1}
        - v17.0 continues from there, etc.
     4. Write final ROADMAP.md to each milestone workspace
     5. Write final STATE.md to each milestone workspace
     6. Update root ROADMAP.md with all N milestone entries (phase ranges)
     7. Update root STATE.md active milestones table
     8. Update REQUIREMENTS.md traceability sections with actual phase numbers
     9. Return consolidated summary
     </instructions>
     ",
     subagent_type="gsd-roadmap-synthesizer",
     description="Synthesize N roadmaps into numbered phases")
```

**Why this is better than pre-assignment:**

| Dimension | Pre-Assignment (old) | Synthesizer (new) |
|-----------|---------------------|-------------------|
| Phase numbers | Predicted before roadmapping | Assigned after all proposals known |
| Collision risk | Non-zero (buffer overrun) | Zero (sequential assignment) |
| Buffer waste | Gaps in phase numbers | No gaps — tight sequential |
| Complexity | Slot algorithm + collision detection + re-slotting | Simple sequential counter |
| New tooling | `milestone phase-slots` subcommand | `gsd-roadmap-synthesizer` agent |
| Failure mode | Roadmapper overruns slot → re-slot cascade | Roadmapper fails → re-run just that one, re-synthesize |

---

### Stage 5 — Review and Commit

**The synthesizer returns a consolidated view. Display it:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MULTI-MILESTONE PLAN (synthesized)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v16.0 Observable Runtime (Phases 87-92, 6 phases)
  Phase 87: Metric Collection Core
  Phase 88: Log Structured Output
  Phase 89: Retention Policy Engine
  Phase 90: Dashboard Integration
  Phase 91: Alert Configuration
  Phase 92: End-to-End Smoke Tests

v17.0 Auth Layer (Phases 93-96, 4 phases)
  Phase 93: Token Management
  Phase 94: Login/Logout Flow
  Phase 95: Session Persistence
  Phase 96: Auth Middleware

v18.0 Test Maturity (Phases 97-103, 7 phases)
  Phase 97: Coverage Gates
  ...

Total: 3 milestones | 17 phases | 11 requirements
No phase gaps — sequential assignment by synthesizer.
```

AskUserQuestion:
- "Approve all — commit everything"
- "Adjust one milestone — tell me which"
- "Re-roadmap one milestone — re-spawn roadmapper with notes, then re-synthesize"

**On approval, commit all artifacts (synthesizer already wrote the files):**

```bash
# Root files (updated by synthesizer)
node gsd-tools.cjs commit "docs: add v16.0/v17.0/v18.0 to root roadmap (multi-milestone batch)" \
  --files .planning/ROADMAP.md .planning/STATE.md .planning/MILESTONES.md

# Per-milestone (N commits)
node gsd-tools.cjs commit "docs: initialize v16.0 Observable Runtime (6 phases)" \
  --files .planning/milestones/v16.0/ROADMAP.md \
          .planning/milestones/v16.0/STATE.md \
          .planning/milestones/v16.0/REQUIREMENTS.md

# ... repeat for v17.0, v18.0

# Session artifact
node gsd-tools.cjs commit "docs: record batch session artifacts" \
  --files .planning/quick/NN-multi-milestone-[date]/BATCH-INTAKE.md \
          .planning/quick/NN-multi-milestone-[date]/BATCH-SESSION.md
```

---

## Section 3 — Implementation Requirements

### 3.1 New Slash Command

**File:** `~/.claude/commands/gsd/multi-milestone.md`

```yaml
---
name: multi-milestone
description: Plan multiple milestones in one batch session — intake ideas, cluster into themes, research, scope requirements, and roadmap all at once
argument-hint: "[ideas...] | --from-brainstorm <task#> | --from-file <path> | --resume <task#>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
  - Glob
---
```

The command file reads `~/.claude/get-shit-done/workflows/multi-milestone.md` via `execution_context` (same pattern as all other GSD commands).

**Brainstorm integration (v1):** `--from-brainstorm NN` reads `.planning/quick/NN-brainstorm-*/FEATURE-IDEAS.md` and pre-populates clusters from the brainstorm's already-clustered output, bypassing the affinity-grouping step in Stage 0.

### 3.2 New Workflow File

**File:** `~/.claude/get-shit-done/workflows/multi-milestone.md`

This is the primary new file. Estimated 600-800 lines. Key sections:

```
## 0. Parse Input
  - Detect --from-brainstorm NN / --from-file / --resume NN / inline arguments
  - If --from-brainstorm: read FEATURE-IDEAS.md, pre-populate clusters
  - If --from-file: read file, normalize list
  - If --resume: load BATCH-SESSION.md, skip completed stages

## 1. Load Project Context
  - Read PROJECT.md, MILESTONES.md, STATE.md
  - Run: node gsd-tools.cjs init new-milestone --raw
    (for highest_phase, researcher_model, roadmapper_model, etc.)

## 2. Feature Intake & Clustering (Stage 0)
  - Perform affinity grouping (orchestrator, no subagent)
  - Present clusters with candidate milestone names
  - Run refinement loop until user approves clusters
  - Write BATCH-INTAKE.md

## 3. Version Assignment and Workspace Creation (Stage 1)
  - Parse last version from MILESTONES.md
  - Auto-assign vX+1.0, vX+2.0, ... per cluster
  - Confirm with user
  - Create all N workspaces in parallel
  - Run manifest-check
  - Write initial BATCH-SESSION.md

## 4. Per-Milestone Research + Scoping Loop (Stages 2-3, merged)
  For each milestone sequentially:
    - Ask: research this milestone? (skip/include)
    - If research: spawn 4 researchers → synthesizer → present findings
    - Run full requirements scoping (same UX as new-milestone Step 9)
    - Generate and commit REQUIREMENTS.md

## 5. Parallel Roadmapping (Stage 4)
  - Spawn N gsd-roadmapper agents in PROPOSAL mode (unnumbered)
  - Each writes PROPOSAL.md to its milestone workspace
  - Wait for all to complete

## 6. Roadmap Synthesizer
  - Spawn gsd-roadmap-synthesizer
  - Reads all N PROPOSAL.md + REQUIREMENTS.md files
  - Assigns milestone versions and phase numbers sequentially
  - Writes final ROADMAP.md, STATE.md, REQUIREMENTS.md to each workspace
  - Updates root ROADMAP.md and STATE.md

## 7. Review and Commit (Stage 5)
  - Display consolidated plan from synthesizer
  - User approves / adjusts / re-roadmaps one milestone
  - If re-roadmap: re-spawn that roadmapper, then re-synthesize
  - Atomic per-milestone commits
  - Update BATCH-SESSION.md with commit SHAs
```

### 3.3 gsd-tools.cjs Extensions

**Analysis:** The existing `milestone new-workspace` command is already idempotent and takes one version at a time. The workflow can call it N times in parallel. No new `batch-init` subcommand is strictly needed.

**Optional: `milestone batch-init <version1> <version2> ...`**

Creates N workspaces in one call, returns array. Useful for error aggregation. Recommend as follow-on, not blocker.

**No `phase-slots` subcommand needed.** The synthesizer approach eliminates all slot math from gsd-tools.cjs. Phase numbering is handled entirely by the `gsd-roadmap-synthesizer` agent.

### 3.4 New Agent: `gsd-roadmap-synthesizer`

**File:** `agents/gsd-roadmap-synthesizer.md`

Modeled on the existing `gsd-research-synthesizer`. Core responsibilities:

1. Read all N `PROPOSAL.md` files (unnumbered phase proposals from parallel roadmappers)
2. Read all N `REQUIREMENTS.md` files (for REQ-ID traceability)
3. Receive `next_starting_phase` and milestone ordering from orchestrator
4. Assign phase numbers sequentially: milestone 1 gets phases `next..next+count1-1`, milestone 2 continues from there, etc.
5. Write final `ROADMAP.md` to each milestone workspace (numbered phases, requirement mappings, success criteria)
6. Write final `STATE.md` to each milestone workspace
7. Update `REQUIREMENTS.md` traceability sections with actual phase numbers
8. Update root `ROADMAP.md` with all N milestone entries and phase ranges
9. Update root `STATE.md` active milestones table
10. Return consolidated summary for the review stage

**Algorithm (trivial compared to pre-assignment):**

```
cursor = next_starting_phase
for each milestone in order:
  read PROPOSAL.md → extract phase_count
  assign phases cursor through cursor + phase_count - 1
  rewrite PROPOSAL phase placeholders (PHASE-A → cursor, PHASE-B → cursor+1, etc.)
  write numbered ROADMAP.md to milestone workspace
  cursor += phase_count
```

Zero collision risk. No buffers. No gaps. If a roadmapper needs to be re-run, re-run just that one and call the synthesizer again — it re-numbers everything from scratch.

**Structured return:**

```markdown
## SYNTHESIS COMPLETE

**Milestones synthesized:** N
**Total phases:** X (phases {start}-{end})

| Milestone | Version | Phases | Requirements |
|-----------|---------|--------|-------------|
| Observable Runtime | v16.0 | 87-92 (6) | 4 |
| Auth Layer | v17.0 | 93-96 (4) | 3 |
| Test Maturity | v18.0 | 97-103 (7) | 5 |

**Files written:**
- .planning/milestones/v16.0/ROADMAP.md, STATE.md, REQUIREMENTS.md
- .planning/milestones/v17.0/ROADMAP.md, STATE.md, REQUIREMENTS.md
- .planning/milestones/v18.0/ROADMAP.md, STATE.md, REQUIREMENTS.md
- .planning/ROADMAP.md (root, updated)
- .planning/STATE.md (root, updated)
```

### 3.5 Failure Modes and Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| One research subagent fails | Returns error instead of `## RESEARCH COMPLETE` | Log warning to `BATCH-SESSION.md`, mark workspace `research_status: partial`. Continue batch. Synthesizer runs with available files, notes gaps. |
| One roadmapper returns `## ROADMAP BLOCKED` | Roadmapper return value starts with BLOCKED signal | Pause batch for that milestone. Present blocker to user with inline prompt. Re-spawn with clarification notes. Other milestones' roadmaps may already be complete — do not discard them. |
| Roadmapper returns invalid PROPOSAL.md | Missing required sections or empty | Re-spawn that roadmapper. Synthesizer only runs when all N proposals are valid. |
| User abandons mid-session | Workspaces exist but REQUIREMENTS.md is empty or ROADMAP.md is scaffold-only | On next `/gsd:multi-milestone`, detect `BATCH-SESSION.md` files in `.planning/quick/` with `status: incomplete`. Offer: "Resume session from [date] (milestones: v16.0, v17.0, v18.0)" or "Start fresh (discard incomplete workspaces)". |
| Concurrent `gsd-roadmapper` writes to same root ROADMAP.md | Two roadmappers both try to update root ROADMAP.md simultaneously | **Prevention:** Roadmappers write ONLY PROPOSAL.md (no ROADMAP.md at all). The synthesizer is the single writer for all ROADMAP.md files. No concurrent write risk. |
| Research opt-in config mismatch | `workflow.research` is `false` in config but user wants research for this batch | Add `--research` flag to override: `/gsd:multi-milestone --research "ideas..."`. Batch research always writes to milestone-scoped `research/` dirs, never to legacy `.planning/research/`. |

### 3.6 Session Continuity File

**File:** `.planning/quick/NN-multi-milestone-[YYYY-MM-DD]/BATCH-SESSION.md`

Written incrementally as stages complete. Final state:

```markdown
# Batch Session — [date]

## Milestones in This Batch

| Milestone | Version | Status | Phase Slot | Commit SHA |
|-----------|---------|--------|------------|------------|
| Observable Runtime | v16.0 | Complete | 87-92 | abc123 |
| Auth Layer | v17.0 | Complete | 96-99 | def456 |
| Test Maturity | v18.0 | In Progress | 104-110 | — |

## Stage Log

| Time | Stage | Milestone | Result |
|------|-------|-----------|--------|
| 14:02 | Workspace Created | v16.0 | OK |
| 14:02 | Workspace Created | v17.0 | OK |
| 14:02 | Workspace Created | v18.0 | OK |
| 14:08 | Research | v16.0 | Complete (4/4 agents) |
| 14:09 | Research | v17.0 | Partial (3/4 agents, Architecture failed) |
| 14:09 | Research | v18.0 | Complete (4/4 agents) |
| 14:11 | Requirements | v16.0 | 4 items scoped |
| 14:12 | Requirements | v17.0 | 3 items scoped |
| 14:12 | Requirements | v18.0 | 5 items scoped |
| 14:13 | Phase Slots | all | Assigned: v16.0=87-95, v17.0=96-103, v18.0=104-115 |
| 14:18 | Roadmap | v16.0 | Complete (phases 87-92) |
| 14:18 | Roadmap | v17.0 | Complete (phases 96-99) |
| 14:19 | Roadmap | v18.0 | In Progress |

## Failures

| Milestone | Stage | Error | Resolution |
|-----------|-------|-------|------------|
| v17.0 | Research/Architecture | Agent timeout | Partial — continued without |

## Resume Instructions

To resume this session: `/gsd:multi-milestone --resume NN`
Last completed stage: Roadmapping
```

**Resume protocol:** `/gsd:multi-milestone --resume NN` reads `BATCH-SESSION.md`, determines the last completed stage per milestone, and re-enters the workflow at the correct stage. Completed stages are idempotent (workspaces already exist, requirements already written) — the orchestrator skips them.

---

## Section 4 — Milestone Estimate

### Scope Assessment

| Dimension | Size | Notes |
|-----------|------|-------|
| New files | 3 required | `multi-milestone.md` workflow, `multi-milestone.md` command, `gsd-roadmap-synthesizer.md` agent |
| Workflow complexity | High | ~600-800 lines; more complex than `new-milestone.md` (~400 lines) due to N-milestone fan-out, per-milestone research/scoping loop, parallel roadmapping, and synthesizer coordination |
| Interactive stages | 3+N | Cluster approval, version confirmation, N×(research choice + full scoping), final review |
| gsd-tools.cjs additions | None required | Synthesizer handles all numbering; existing `milestone new-workspace` + `manifest-check` suffice |
| Testing surface | Medium | Roadmap synthesizer agent can be tested with mock PROPOSAL.md files; workflow integration via manual run |
| Risk | Medium | Synthesizer pattern proven by `gsd-research-synthesizer`; main novelty is the unnumbered-proposal roadmapper mode |

### Recommendation: Multi-Phase Milestone (v16.0)

This is too large for a quick task (estimated 3-5 hours of execution work, 500+ lines of new workflow logic) and too complex to execute correctly in a single phase without iteration.

**Proposed Milestone: v16.0 Multi-Milestone Batch Planner**

Three phases:

**Phase NN: Roadmap Synthesizer Agent + Proposal Mode**
- `gsd-roadmap-synthesizer.md` agent definition
- Roadmapper "proposal mode" — teach existing roadmapper to produce unnumbered PROPOSAL.md
- `BATCH-SESSION.md` write/read helpers
- Test: synthesizer with 2 mock PROPOSAL.md files produces correct numbered output

**Phase NN+1: Workflow File — Stages 0-3 (Intake through Scoping)**
- `multi-milestone.md` workflow: input parsing, clustering, workspace creation, per-milestone research/scoping loop
- Command file: `~/.claude/commands/gsd/multi-milestone.md`
- `--from-brainstorm NN` flag reads FEATURE-IDEAS.md and pre-populates clusters
- Integration test: run intake through requirements scoping with 2 milestones

**Phase NN+2: Workflow File — Stages 4-5 + Resume**
- `multi-milestone.md` workflow: parallel roadmapping (proposal mode), synthesizer spawn, review and commit
- Resume protocol: `--resume NN` flag handling
- Integration test: end-to-end with 2 test milestones

The synthesizer agent and proposal mode are the highest-risk components. Separating them into phase 1 allows testing the numbering logic before wiring it into the full workflow.

**Milestone brief (ready for `/gsd:new-milestone` input):**

```
Milestone: v16.0 Multi-Milestone Batch Planner
Goal: A /gsd:multi-milestone command that takes a huge dump of feature ideas,
clusters them into milestone themes, creates N workspaces, runs per-milestone
research + full requirements scoping, spawns N parallel roadmappers producing
unnumbered proposals, then a roadmap synthesizer assigns all version and phase
numbers and writes every artifact — all in one session.

Key capabilities:
- Freeform, file-based, or brainstorm-sourced feature intake with affinity clustering
- --from-brainstorm NN flag to consume /gsd:brainstorm output directly
- Parallel workspace creation (N milestones, cap N≤20)
- Per-milestone research (skip/include choice per milestone)
- Full per-milestone requirements scoping (same UX as new-milestone)
- Parallel roadmapping in PROPOSAL mode (unnumbered phases)
- gsd-roadmap-synthesizer agent: assigns all milestone versions and phase numbers
- Session continuity via BATCH-SESSION.md and --resume flag
```

---

## Section 5 — Decisions (All Resolved)

All 7 questions resolved in session on 2026-04-04.

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | Requirements UX | **Full per-milestone scoping** (same UX as `new-milestone`) | The multi-milestone command owns the entire funnel — features in, milestones out. No shortcuts on scoping. |
| Q2 | Research opt-in | **Per-milestone skip/include** | User chooses before each milestone's scoping. Research results inform scope decisions. |
| Q3 | Phase numbering | **Synthesizer assigns all numbers** | Milestone ordering is Claude's discretion — milestones run concurrently in different sessions anyway. Eliminates all slot math. |
| Q4 | Command name | **`/gsd:multi-milestone`** | Standalone command, clear name. |
| Q5 | Max batch size | **N ≤ 20** | Let it rip. |
| Q6 | Relationship to `new-milestone` | **Fully separate workflow** | `multi-milestone.md` is its own thing. `new-milestone` stays the single-milestone path. |
| Q7 | Brainstorm integration | **In v1 — `--from-brainstorm NN`** | Primary use case. Reads FEATURE-IDEAS.md, pre-populates clusters, bypasses affinity grouping. |

### Additional Architectural Decision: Synthesizer Pattern

The original design used phase slot pre-assignment (predict phase counts, allocate ranges, detect collisions). This was replaced with a **roadmap synthesizer** pattern:

- Parallel roadmappers produce **unnumbered PROPOSAL.md** files
- A new `gsd-roadmap-synthesizer` agent reads all proposals and assigns milestone versions + phase numbers sequentially
- Zero collision risk, no buffer math, no gaps
- Pattern proven by existing `gsd-research-synthesizer`

This is the single biggest architectural improvement from the review session.

---

*End of design document.*
*All decisions locked. 3 implementation phases recommended.*
*Next action: `/gsd:new-milestone` to start v16.0 Multi-Milestone Batch Planner.*
