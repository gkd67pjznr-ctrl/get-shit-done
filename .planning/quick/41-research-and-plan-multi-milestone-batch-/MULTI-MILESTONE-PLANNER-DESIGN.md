# Multi-Milestone Batch Planning: Design Document

*Quick Task 41 — Research Output*
*Date: 2026-04-04*
*Status: Design complete, pending user decisions (Section 5)*

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

## Section 2 — Proposed Workflow: `/gsd:multi-plan`

### Stage 0 — Feature Intake (The Big Dump)

The command accepts freeform feature lists and organizes them into candidate milestone themes before any workspace is created.

**Input parsing:**

```
/gsd:multi-plan "Feature A, Feature B, Feature C..."
/gsd:multi-plan --from-file .planning/quick/34-brainstorm/FEATURE-IDEAS.md
```

If `$ARGUMENTS` starts with `--from-file`, read the file. Otherwise treat all arguments as the freeform list.

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

Write `BATCH-INTAKE.md` to `.planning/quick/NN-multi-plan-[YYYY-MM-DD]/BATCH-INTAKE.md`:

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

### Stage 2 — Parallel Requirements Research (Per Milestone)

**Spawn N×4 researchers concurrently:**

For each milestone, spawn 4 `gsd-project-researcher` agents simultaneously (Stack, Features, Architecture, Pitfalls). Each agent writes to its milestone-scoped workspace:

```
Task(gsd-project-researcher, milestone=v16.0, dimension=Stack,
     output=.planning/milestones/v16.0/research/STACK.md)
Task(gsd-project-researcher, milestone=v16.0, dimension=Features,
     output=.planning/milestones/v16.0/research/FEATURES.md)
... × 4 dimensions × N milestones = N×4 concurrent agents
```

After all 4 researchers for a given milestone complete, spawn that milestone's synthesizer. Synthesizers across milestones can also run in parallel.

**Failure handling:**

If one researcher returns an error (not `## RESEARCH COMPLETE`):
- Log warning to `BATCH-SESSION.md`: `v16.0 Stack research: PARTIAL (error: ...)`
- Mark that milestone's workspace as `research_status: partial`
- Continue with remaining researchers — do not pause the batch
- Synthesizer runs with whatever research files exist; notes missing dimensions

**Progress display:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING (N×4 agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v16.0 Observable Runtime:
  Stack [done] | Features [done] | Architecture [running] | Pitfalls [running]

v17.0 Auth Layer:
  Stack [done] | Features [running] | Architecture [queued] | Pitfalls [queued]

v18.0 Test Maturity:
  Stack [running] | Features [queued] | Architecture [queued] | Pitfalls [queued]
```

**Token cost note:** N×4 researchers + N synthesizers = N×5 subagent context windows. For N=5: 25 subagent spawns. At ~40k tokens each (research content + project context), this is ~1M tokens of subagent work. With a 1M context window, the orchestrator itself has headroom. Budget for ~30 minutes of wall-clock time for large batches.

---

### Stage 3 — Requirements Definition (RECOMMENDED: Option C — Quick-Scope Mode)

**Recommendation: Option C (Quick-Scope Mode)**

**Rationale:** Option A (one milestone at a time) defeats the purpose of the batch command — it's just serial `new-milestone` invocations with extra steps. Option B (simultaneous table) is cognitively overwhelming at N=4+ milestones and risks the very scope bleed it tries to prevent by presenting all milestones' features side-by-side.

Option C is the right design for a batch planner because:

1. **The batch session is about breadth, not depth.** Detailed scoping belongs in `/gsd:discuss-phase` where the user has full attention on one phase at a time.
2. **Most milestone-level scoping decisions are binary.** "Is auth in scope for v17.0?" is a yes/no, not a discussion. Option C's Y/N interface matches this.
3. **Quick-scope produces good-enough REQUIREMENTS.md files** for the roadmapper. Roadmappers don't need exhaustive requirements — they need scope boundaries.
4. **Deferred scoping via `/gsd:discuss-phase` is the natural next step** in the GSD workflow anyway. Quick-scope doesn't skip that step — it just doesn't duplicate it at the milestone level.

**Option C UX design:**

For each milestone, sequentially present a quick-scope screen:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QUICK-SCOPE: v16.0 Observable Runtime
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Derived from research. Select what's in scope for v16.0:

Complexity ratings: L = low (1 phase), M = medium (1-2 phases), H = high (2-3 phases)

[Category: Metrics]
  [ ] METR-01: Real-time CPU/memory metrics collection (M)
  [ ] METR-02: Structured log output with severity levels (L)
  [ ] METR-03: Metric storage and retention policy (H)

[Category: Dashboard]
  [ ] DASH-01: Live metrics dashboard panel (M)
  [ ] DASH-02: Alert threshold configuration (M)

None for this milestone →
```

AskUserQuestion (multiSelect: true) with the above items.

After user selects, display brief confirmation:
```
v16.0 scope confirmed: 4 requirements, estimated 3-5 phases
```

Then immediately move to the next milestone's quick-scope screen.

**After all N milestones scoped:** Write `REQUIREMENTS.md` files to each workspace, commit each:

```bash
node gsd-tools.cjs commit "docs: define v16.0 requirements (N items)" \
  --files .planning/milestones/v16.0/REQUIREMENTS.md

node gsd-tools.cjs commit "docs: define v17.0 requirements (N items)" \
  --files .planning/milestones/v17.0/REQUIREMENTS.md
```

---

### Stage 4 — Parallel Roadmapping

**Phase slot pre-assignment (see Section 3.4 for the full algorithm):**

Before spawning any roadmapper, the orchestrator assigns non-overlapping phase slots. The assignment is based on requirement count heuristic and written to `BATCH-SESSION.md` for transparency.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PHASE SLOT ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v16.0 Observable Runtime   → Phases 87–96  (slot: 10, 4 reqs × 1.5 ≈ 6 + 4 buffer)
v17.0 Auth Layer           → Phases 97–104 (slot: 8, 3 reqs × 1.5 ≈ 5 + 3 buffer)
v18.0 Test Maturity        → Phases 105–116 (slot: 12, 5 reqs × 1.5 ≈ 8 + 4 buffer)

Roadmappers will be told their starting phase. They must not exceed their slot.
```

**Spawn N roadmappers in parallel:**

```
Task(gsd-roadmapper, milestone=v16.0, starting_phase=87, slot_end=96,
     requirements=.planning/milestones/v16.0/REQUIREMENTS.md)

Task(gsd-roadmapper, milestone=v17.0, starting_phase=97, slot_end=104,
     requirements=.planning/milestones/v17.0/REQUIREMENTS.md)

Task(gsd-roadmapper, milestone=v18.0, starting_phase=105, slot_end=116,
     requirements=.planning/milestones/v18.0/REQUIREMENTS.md)
```

**After all N roadmappers complete:**

1. Read all N `ROADMAP.md` files
2. Verify no phase number overlaps (scan for duplicate phase numbers across all roadmaps)
3. Update root `.planning/ROADMAP.md` with all N milestone entries
4. Update root `STATE.md` active milestones table
5. Display consolidated phase overview (Stage 5)

---

### Stage 5 — Review and Commit

**Consolidated plan display:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MULTI-MILESTONE PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v16.0 Observable Runtime (Phases 87-92, 6 phases)
  Phase 87: Metric Collection Core
  Phase 88: Log Structured Output
  Phase 89: Retention Policy Engine
  Phase 90: Dashboard Integration
  Phase 91: Alert Configuration
  Phase 92: End-to-End Smoke Tests

v17.0 Auth Layer (Phases 97-100, 4 phases)
  Phase 97: Token Management
  Phase 98: Login/Logout Flow
  Phase 99: Session Persistence
  Phase 100: Auth Middleware

v18.0 Test Maturity (Phases 105-111, 7 phases)
  Phase 105: Coverage Gates
  ...

Total: 3 milestones | 17 phases | 11 requirements
```

AskUserQuestion:
- "Approve all — commit everything"
- "Adjust one milestone — tell me which"
- "Re-roadmap one milestone — re-spawn roadmapper with notes"

**On approval, commit all artifacts atomically per milestone:**

```bash
# Root files
node gsd-tools.cjs commit "docs: add v16.0/v17.0/v18.0 to root roadmap (batch multi-plan)" \
  --files .planning/ROADMAP.md .planning/STATE.md .planning/MILESTONES.md

# Per-milestone (3 commits)
node gsd-tools.cjs commit "docs: initialize v16.0 Observable Runtime (6 phases)" \
  --files .planning/milestones/v16.0/ROADMAP.md \
          .planning/milestones/v16.0/STATE.md \
          .planning/milestones/v16.0/REQUIREMENTS.md

# ... repeat for v17.0, v18.0

# Session artifact
node gsd-tools.cjs commit "docs: record batch session artifacts" \
  --files .planning/quick/NN-multi-plan-[date]/BATCH-INTAKE.md \
          .planning/quick/NN-multi-plan-[date]/BATCH-SESSION.md
```

---

## Section 3 — Implementation Requirements

### 3.1 New Slash Command

**File:** `~/.claude/commands/gsd/multi-plan.md`

```yaml
---
name: multi-plan
description: Plan multiple milestones in one batch session — intake ideas, cluster into themes, research, scope requirements, and roadmap all in parallel
argument-hint: "[ideas...] | --from-file <path>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
  - Glob
---
```

The command file reads `~/.claude/get-shit-done/workflows/multi-plan.md` via `execution_context` (same pattern as all other GSD commands).

### 3.2 New Workflow File

**File:** `~/.claude/get-shit-done/workflows/multi-plan.md`

This is the primary new file. Estimated 450-600 lines. Key sections:

```
## 0. Parse Input
  - Detect --from-file vs inline arguments
  - Read file or normalize inline list

## 1. Load Project Context
  - Read PROJECT.md, MILESTONES.md, STATE.md
  - Run: node gsd-tools.cjs init new-milestone --raw
    (for highest_phase, researcher_model, roadmapper_model, etc.)

## 2. Cluster Ideas
  - Perform affinity grouping (orchestrator, no subagent)
  - Present clusters with candidate milestone names
  - Run refinement loop until user approves clusters
  - Write BATCH-INTAKE.md

## 3. Version Assignment and Workspace Creation
  - Parse last version from MILESTONES.md
  - Auto-assign vX+1.0, vX+2.0, ... per cluster
  - Confirm with user
  - Create all N workspaces in parallel
  - Run manifest-check
  - Write initial BATCH-SESSION.md

## 4. Parallel Research
  - Spawn N×4 gsd-project-researcher agents concurrently
  - Spawn N synthesizers after their milestone's researchers complete
  - Handle partial research failures gracefully

## 5. Quick-Scope Requirements
  - For each milestone (sequential, interactive):
    - Present top features with complexity ratings
    - User Y/N selects in scope items
    - Generate and commit REQUIREMENTS.md

## 6. Phase Slot Pre-Assignment
  - Compute slots using requirement-count heuristic (see 3.4)
  - Display slot table for user visibility
  - Write slot assignments to BATCH-SESSION.md

## 7. Parallel Roadmapping
  - Spawn N gsd-roadmapper agents with explicit starting_phase and slot_end
  - Wait for all to complete
  - Detect phase number collisions
  - Update root ROADMAP.md

## 8. Review and Commit
  - Display consolidated plan
  - User approves / adjusts / re-roadmaps
  - Atomic per-milestone commits
  - Update BATCH-SESSION.md with commit SHAs
```

### 3.3 gsd-tools.cjs Extensions

**Analysis:** The existing `milestone new-workspace` command is already idempotent and takes one version at a time. The workflow can call it N times in parallel (N separate Bash tool calls in the same message). No new `batch-init` subcommand is strictly needed.

However, two new subcommands would improve the workflow:

**Candidate 1: `milestone batch-init <version1> <version2> ...`**

Creates N workspaces in one call, returns an array:

```json
[
  {"version": "v16.0", "planning_root": ".planning/milestones/v16.0", "created": true},
  {"version": "v17.0", "planning_root": ".planning/milestones/v17.0", "created": true}
]
```

**Verdict: Optional.** The workflow can achieve the same by calling `milestone new-workspace` N times. The batch subcommand would be useful for error aggregation (know which workspaces succeeded vs failed in one response) and for future CLI users. Recommend implementing as a follow-on, not a blocker.

**Candidate 2: `milestone phase-slots <current_highest> <req_counts...>`**

Computes non-overlapping phase slots given current highest phase and per-milestone requirement counts:

```bash
node gsd-tools.cjs milestone phase-slots 86 4 3 5
# Returns: {"slots": [{"start": 87, "end": 96}, {"start": 97, "end": 104}, {"start": 105, "end": 116}]}
```

**Verdict: Recommended.** The slot algorithm (Section 3.4) is deterministic arithmetic. Implementing it in gsd-tools.cjs makes it testable, shareable with future tools, and avoids reimplementing it in workflow prose. This is a ~50-line addition to `milestone.cjs`.

### 3.4 Phase Number Coordination Algorithm

This is the hardest correctness problem. Full algorithm:

**Step 1: Determine current highest phase**

```bash
INIT=$(node gsd-tools.cjs init new-milestone --raw)
HIGHEST=$(echo "$INIT" | jq -r '.highest_phase')
NEXT=$(echo "$INIT" | jq -r '.next_starting_phase')
```

This reads from all three sources (`getHighestPhaseNumber`): milestone phase dirs, root ROADMAP.md ranges, root STATE.md table.

**Step 2: Estimate slot size per milestone**

For each milestone `i` with `req_count[i]` scoped requirements:

```
phases_estimate[i] = ceil(req_count[i] * 1.5)
buffer[i] = max(3, ceil(phases_estimate[i] * 0.5))
slot_size[i] = phases_estimate[i] + buffer[i]
```

Rationale: 1.5× requirement count is a conservative estimate (most milestones average 1.2 phases per requirement in this project's history). The 50% buffer absorbs roadmapper decisions to split phases. Minimum buffer of 3 prevents gaps too small to be useful.

Example: 4 requirements → `ceil(4 × 1.5) = 6 phases estimate`, `buffer = max(3, 3) = 3`, `slot_size = 9`

**Step 3: Assign slots sequentially**

```
cursor = next_starting_phase  // e.g., 87
for each milestone i:
  slot_start[i] = cursor
  slot_end[i] = cursor + slot_size[i] - 1
  cursor = slot_end[i] + 1
```

Example (starting at 87, requirements: [4, 3, 5]):
- v16.0: start=87, estimate=6, buffer=3, slot=9 → phases 87-95
- v17.0: start=96, estimate=5, buffer=3, slot=8 → phases 96-103
- v18.0: start=104, estimate=8, buffer=4, slot=12 → phases 104-115

**Step 4: Pass slot bounds to each roadmapper**

The roadmapper prompt must include:
```
Start phase numbering from {slot_start}.
Do NOT use phases beyond {slot_end} — this is your allocated slot.
If you need more phases than your slot allows, return ROADMAP BLOCKED with a larger estimate.
```

**Step 5: Post-roadmap validation**

After all N roadmappers return, scan each `ROADMAP.md` for the actual phase numbers used. Extract all phase numbers across all N roadmaps. Check for:
- Phases outside assigned slot → SLOT VIOLATION
- Duplicate phase numbers across roadmaps → COLLISION

If collision detected:
```
Phase collision detected: Phase 97 used by both v16.0 and v17.0.
v16.0 roadmapper used phases 87-97 (overran slot 87-95 by 2)
v17.0 roadmapper started at 96 as assigned.

Options:
1. Re-slot v17.0 to start at 98 and re-run its roadmapper
2. Re-run v16.0 roadmapper with tighter slot (87-95)
```

**Step 6: Root ROADMAP.md update (after validation passes)**

Add entries in order, using actual phase ranges from roadmaps:
```markdown
- 🔨 **v16.0 Observable Runtime** — Phases 87-92
- 🔨 **v17.0 Auth Layer** — Phases 96-99
- 🔨 **v18.0 Test Maturity** — Phases 104-110
```

This ensures future `getHighestPhaseNumber()` calls return 110 (the actual highest), not 115 (the last allocated slot), preventing artificial gaps.

### 3.5 Failure Modes and Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| One research subagent fails | Returns error instead of `## RESEARCH COMPLETE` | Log warning to `BATCH-SESSION.md`, mark workspace `research_status: partial`. Continue batch. Synthesizer runs with available files, notes gaps. |
| One roadmapper returns `## ROADMAP BLOCKED` | Roadmapper return value starts with BLOCKED signal | Pause batch for that milestone. Present blocker to user with inline prompt. Re-spawn with clarification notes. Other milestones' roadmaps may already be complete — do not discard them. |
| Phase slot collision (roadmapper overruns slot) | Post-roadmap phase scan detects overlapping phase numbers | Display diff showing which roadmapper overran. Offer: re-slot later milestones (shift starts), re-run offending roadmapper with tighter constraint, or manual re-numbering. |
| User abandons mid-session | Workspaces exist but REQUIREMENTS.md is empty or ROADMAP.md is scaffold-only | On next `/gsd:multi-plan`, detect `BATCH-SESSION.md` files in `.planning/quick/` with `status: incomplete`. Offer: "Resume session from [date] (milestones: v16.0, v17.0, v18.0)" or "Start fresh (discard incomplete workspaces)". |
| Concurrent `gsd-roadmapper` writes to same root ROADMAP.md | Two roadmappers both try to update root ROADMAP.md simultaneously | **Prevention:** Root ROADMAP.md is updated ONLY by the orchestrator, AFTER all roadmappers complete. Roadmappers write ONLY to their milestone-scoped ROADMAP.md. The orchestrator aggregates. This is the correct architectural boundary. |
| Research opt-in config mismatch | `workflow.research` is `false` in config but user wants research for this batch | Add `--research` flag to override: `/gsd:multi-plan --research "ideas..."`. Batch research always writes to milestone-scoped `research/` dirs, never to legacy `.planning/research/`. |

### 3.6 Session Continuity File

**File:** `.planning/quick/NN-multi-plan-[YYYY-MM-DD]/BATCH-SESSION.md`

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

To resume this session: `/gsd:multi-plan --resume NN`
Last completed stage: Roadmapping
```

**Resume protocol:** `/gsd:multi-plan --resume NN` reads `BATCH-SESSION.md`, determines the last completed stage per milestone, and re-enters the workflow at the correct stage. Completed stages are idempotent (workspaces already exist, requirements already written) — the orchestrator skips them.

---

## Section 4 — Milestone Estimate

### Scope Assessment

| Dimension | Size | Notes |
|-----------|------|-------|
| New files | 3 required | `multi-plan.md` workflow, `multi-plan.md` command, `milestone.cjs` addition for `phase-slots` |
| Workflow complexity | High | ~500 lines; more complex than `new-milestone.md` (~400 lines) due to N-milestone fan-out, parallel agent management, slot algorithm, and resume logic |
| Interactive stages | 4 | Cluster approval, version confirmation, N×quick-scope, final review — each requires conversation-aware state |
| gsd-tools.cjs additions | Small | `milestone phase-slots` subcommand (~50 lines + tests) |
| Testing surface | Medium | Slot algorithm unit tests in `milestone.cjs`; workflow integration testing via manual run |
| Risk | High — novel | Parallel roadmapping with slot pre-assignment has no existing precedent in the workflow system |

### Recommendation: Multi-Phase Milestone (v16.0)

This is too large for a quick task (estimated 3-5 hours of execution work, 500+ lines of new workflow logic) and too complex to execute correctly in a single phase without iteration.

**Proposed Milestone: v16.0 Multi-Milestone Batch Planner**

Three phases:

**Phase NN: Core Infrastructure**
- `milestone phase-slots` subcommand with tests
- Slot assignment algorithm implementation
- `BATCH-SESSION.md` write/read helpers
- Unit tests for slot algorithm and session continuity

**Phase NN+1: Workflow File — Stages 0-3**
- `multi-plan.md` workflow: intake, clustering, workspace creation, parallel research
- Command file: `~/.claude/commands/gsd/multi-plan.md`
- Integration test: run intake through workspace creation with 2 milestones

**Phase NN+2: Workflow File — Stages 4-5 + Resume**
- `multi-plan.md` workflow: quick-scope, slot assignment, parallel roadmapping, review and commit
- Resume protocol: `--resume NN` flag handling
- Integration test: end-to-end with 2 test milestones

The resume protocol and slot algorithm are the highest-risk components. Separating them into dedicated phases allows iteration without re-running the entire workflow.

**Milestone brief (ready for `/gsd:new-milestone` input):**

```
Milestone: v16.0 Multi-Milestone Batch Planner
Goal: A /gsd:multi-plan command that clusters feature ideas into milestone themes,
creates N workspaces in parallel, runs N×4 research agents concurrently,
quick-scopes requirements for each milestone interactively, assigns non-overlapping
phase slots, runs N roadmappers in parallel, and commits all artifacts in one session.

Key capabilities:
- Freeform or file-based feature intake with inline affinity clustering
- Parallel workspace creation (N milestones at once)
- N×4 concurrent research agents writing to milestone-scoped workspaces
- Quick-scope requirements UX (binary Y/N per feature, not full discussion)
- Phase slot pre-assignment algorithm (requirement-count heuristic + buffer)
- Parallel roadmapping with slot bounds passed to each agent
- Post-roadmap collision detection
- Session continuity via BATCH-SESSION.md and --resume flag
```

---

## Section 5 — Open Questions

### Q1 — Requirements UX Option

The design recommends **Option C (Quick-Scope)**. Is this acceptable?

The tradeoff: Option C produces lighter REQUIREMENTS.md files (binary include/exclude) vs Option A (full conversational scoping per milestone). The user gets faster batch planning but may find that per-milestone `/gsd:discuss-phase` sessions are needed to add nuance before execution.

Alternative: keep Option A but add a `--quick` flag to the command so users can choose which mode per session.

### Q2 — Research Opt-In

Should research be mandatory for all milestones in a batch, or should the user be able to:
- Skip globally with `--skip-research`
- Skip per-milestone during the intake clustering stage
- Use a project config toggle (`workflow.research = false` already exists)

The current design respects the existing `workflow.research` config flag. If false, research is skipped for the entire batch. Should the batch command allow overriding per-milestone?

### Q3 — Phase Slot Strategy

The design uses a **pre-assignment with buffers** approach. Two open decisions:

1. **Buffer size:** The current algorithm uses `max(3, 50% of estimate)`. Is this too generous (wastes phase numbers) or too tight (roadmappers still overrun)?
2. **On overrun:** If a roadmapper exceeds its slot, the design recommends re-slotting subsequent milestones. Is this acceptable, or should the design enforce hard stops and require re-running the roadmapper with a tighter constraint?

### Q4 — Command Name

Working title: `gsd:multi-plan`. Alternatives:
- `gsd:batch-milestone` — more explicit about what it does
- `gsd:plan-milestones` — grammatically parallel to `plan-phase`
- `gsd:roadmap-all` — emphasizes the output artifact
- `gsd:intake` — emphasizes the input (brainstorm → milestones pipeline)

Note: `gsd:multi-plan` is consistent with the verb pattern (plan) used in `plan-phase`. `plan-milestones` (plural) is the most self-explanatory.

### Q5 — Max Batch Size

The design implicitly supports any N, but N > 5 creates practical problems:
- N×4 concurrent researcher subagents = 20+ agents running simultaneously
- Quick-scope for N=7+ milestones approaches the cognitive load of Option B
- `BATCH-SESSION.md` and the consolidated review display become unwieldy

**Recommendation:** Hard-limit N ≤ 5 and surface an error if the user approves more than 5 clusters. Is N ≤ 5 acceptable?

### Q6 — Relationship to `gsd:new-milestone`

The design assumes `gsd:multi-plan` is the N≥2 path and `gsd:new-milestone` remains the single-milestone path. Two concerns:

1. Should `gsd:new-milestone` warn users who are creating their 3rd+ active milestone that `gsd:multi-plan` exists as a better tool for batch planning?
2. Should `gsd:multi-plan N=1` be valid (single milestone via the batch UX)? The intake/clustering stage would be degenerate (one cluster = one milestone), but the rest of the pipeline is identical.

### Q7 — Brainstorm Integration

The `/gsd:brainstorm` command (v11.0) produces `FEATURE-IDEAS.md` files with clustered, scored ideas. The multi-plan command already accepts `--from-file`. Should `/gsd:multi-plan` explicitly advertise this integration?

Proposed: `/gsd:multi-plan --from-brainstorm NN` reads from the brainstorm session directory `.planning/quick/NN-brainstorm-*/FEATURE-IDEAS.md` and pre-populates clusters from the brainstorm's already-clustered output, bypassing the affinity-grouping step.

This is not in scope for the initial implementation but should be in the milestone's REQUIREMENTS.md as a future requirement.

---

*End of design document.*
*Total: 7 open questions, 3 implementation phases recommended.*
*Next action: user reviews Section 5 questions, then `/gsd:new-milestone` to start v16.0.*
