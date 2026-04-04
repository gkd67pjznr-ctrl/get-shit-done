---
phase: quick-41
plan: "01"
type: research
autonomous: false
wave: 1
depends_on: []
requirements: []
files_modified: []
must_haves:
  truths:
    - "This is a research and design output only — no code is executed"
    - "The proposed workflow must be milestone-scoped from the ground up"
    - "The design must integrate with existing gsd-tools.cjs milestone workspace infrastructure"
    - "Phase numbering is global (not reset per milestone) — the multi-milestone planner must respect next_starting_phase"
  artifacts:
    - ".planning/quick/41-research-and-plan-multi-milestone-batch-/MULTI-MILESTONE-PLANNER-DESIGN.md"
  key_links:
    - "/Users/tmac/.claude/get-shit-done/workflows/new-milestone.md"
    - "/Users/tmac/.claude/get-shit-done/workflows/plan-phase.md"
    - "/Users/tmac/.claude/get-shit-done/references/path-variables.md"
    - "/Users/tmac/Projects/gsdup/.planning/ROADMAP.md"
    - "/Users/tmac/Projects/gsdup/.planning/STATE.md"
---

# Quick Task 41 — Research: Multi-Milestone Batch Planning Workflow

## Task 1: Deep Analysis and Design Document

**Files:**
- Read: `/Users/tmac/.claude/get-shit-done/workflows/new-milestone.md`
- Read: `/Users/tmac/.claude/get-shit-done/workflows/plan-phase.md`
- Read: `/Users/tmac/.claude/get-shit-done/workflows/discuss-phase.md`
- Read: `/Users/tmac/.claude/get-shit-done/references/path-variables.md`
- Read: `/Users/tmac/Projects/gsdup/.planning/ROADMAP.md`
- Read: `/Users/tmac/Projects/gsdup/.planning/STATE.md`
- Read: `/Users/tmac/Projects/gsdup/.planning/milestones/v11.0/ROADMAP.md`
- Read: `/Users/tmac/Projects/gsdup/.planning/milestones/v12.0/ROADMAP.md`
- Create: `/Users/tmac/Projects/gsdup/.planning/quick/41-research-and-plan-multi-milestone-batch-/MULTI-MILESTONE-PLANNER-DESIGN.md`

**Action:**

Produce a comprehensive design document for a new `/gsd:multi-plan` command (working title). The document must cover every section below.

---

### Section 1 — Current Workflow Analysis

Describe the existing single-milestone planning pipeline in detail:

1. **Session boundary problem.** Today's workflow: one `/gsd:new-milestone` call = one milestone. The user must `/clear` between milestones. This hard session boundary makes it impossible to plan 3–5 milestones consecutively without losing context and restarting the conversation repeatedly.

2. **Milestone workspace anatomy.** Enumerate exactly what lives where:
   - Global: `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `.planning/ROADMAP.md`, `.planning/config.json`
   - Per-milestone: `.planning/milestones/vX.Y/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `phases/`, `research/`
   - Phase numbering: Global sequence tracked in root `ROADMAP.md`; `next_starting_phase` derived from `getHighestPhaseNumber()` scanning all milestone directories

3. **Existing parallelism.** The `new-milestone` workflow already spawns 4 parallel researchers (Stack, Features, Architecture, Pitfalls) + synthesizer. The `plan-phase` workflow spawns gsd-phase-researcher → gsd-planner → gsd-plan-checker in sequence. The batch planner can leverage this.

4. **Conflict detection.** `milestone manifest-check` does advisory file-overlap detection between concurrently active milestones. The batch planner must call this after all workspaces are created.

5. **What breaks at scale.** Identify the specific failure points when trying to plan 5 milestones serially today:
   - Context window exhaustion after milestone 2
   - Phase number drift (if tool fails to read highest phase between calls)
   - Requirements bleed (ideas from milestone 3 contaminating milestone 2's scope)
   - No way to see all 5 milestones' outlines before committing to any one roadmap

---

### Section 2 — Proposed Workflow: `/gsd:multi-plan`

Design a new slash command `gsd:multi-plan` with the following pipeline:

#### Stage 0 — Feature Intake (The Big Dump)

The user pastes a freeform list of every feature, fix, and change idea they have. This is the "brainstorm output" stage — raw, unorganized, no commitments. The command:

1. Accepts freeform text as `$ARGUMENTS` OR reads from a file with `--from-file <path>` flag
2. Displays the raw list back with a count: "I see N distinct ideas. Let me group these."
3. Runs inline clustering (no subagent needed at this stage — the orchestrator itself does grouping using domain knowledge)
4. Presents grouped clusters as candidate milestone themes

Example output:
```
Cluster A (7 ideas): Performance & Observability → "v16.0 Observable Runtime"
Cluster B (4 ideas): Auth & User Management → "v17.0 Auth Layer"
Cluster C (5 ideas): Test Infrastructure → "v18.0 Test Maturity"
Cluster D (3 ideas): Docs & Onboarding → "v19.0 Dev Experience"
```

5. Asks the user via `AskUserQuestion` (multiSelect):
   - Which clusters to promote to milestones in this session
   - "None yet — let me refine the clusters first"

6. Allows the user to: rename a cluster, merge two clusters, split a cluster, add orphaned ideas to a cluster, mark ideas as "out of scope / never"

This stage produces a `BATCH-INTAKE.md` file in a session directory: `.planning/quick/NN-multi-plan-[date]/BATCH-INTAKE.md`

#### Stage 1 — Milestone Shell Creation (Parallel)

For each approved cluster (let's say N clusters = N milestones):

1. Compute version numbers: Parse MILESTONES.md to find the last vX.Y, then auto-assign vX+1.0, vX+2.0, etc. Confirm with user.
2. Create all N milestone workspaces in parallel using `milestone new-workspace <version>` for each.
3. Run `milestone manifest-check` once all workspaces exist.
4. Display a summary table:

```
Milestone | Version | Phase Start | Workspace
v16.0 Observable Runtime | ✓ Created | Phase 87 | .planning/milestones/v16.0/
v17.0 Auth Layer         | ✓ Created | Phase 93 | .planning/milestones/v17.0/
v18.0 Test Maturity      | ✓ Created | Phase 97 | .planning/milestones/v18.0/
```

Note: Phase start numbers must be non-overlapping. The planner computes them sequentially — milestone 1 gets phases 87–92, milestone 2 gets 93–96, etc. The roadmapper for each milestone must be told its `starting_phase` explicitly.

#### Stage 2 — Parallel Requirements (Per Milestone)

For each milestone, spawn the requirements + research pipeline concurrently:

```
Milestone v16.0 → spawn gsd-project-researcher × 4 (Stack, Features, Architecture, Pitfalls)
Milestone v17.0 → spawn gsd-project-researcher × 4
Milestone v18.0 → spawn gsd-project-researcher × 4
```

Each researcher writes to its milestone-scoped workspace: `.planning/milestones/vX.Y/research/`.

After all researchers complete per milestone, synthesizers run (also in parallel across milestones).

This is N×5 subagents running concurrently. The design must address:
- Token cost: each researcher is a full subagent with its own context window
- Failure handling: if one researcher fails, the milestone continues with partial research
- Progress display: show a live grid as agents complete

#### Stage 3 — Requirements Definition (Sequential, Per Milestone)

This stage is INTERACTIVE — the user must scope each milestone's requirements. The design options:

**Option A: One milestone at a time (current behavior, just chained)**
- Process v16.0 requirements fully, then v17.0, etc.
- Pro: Familiar UX, user can focus
- Con: Takes a long time, user fatigue

**Option B: Present all milestones' draft requirements simultaneously**
- Show a table: Milestone × Category × Candidate features
- User checks/unchecks features across all milestones in one multi-select pass
- Pro: One session, can see tradeoffs across milestones
- Con: Cognitively dense, risk of scope bleed

**Option C: Quick-scope mode**
- For each milestone, show the top 5 candidate features with complexity ratings
- User approves/rejects with Y/N
- Detailed scoping deferred to per-milestone `/gsd:discuss-phase`
- Pro: Fast, keeps the batch session short
- Con: Requirements may be under-specified

The design document MUST recommend one of these options with rationale and describe the UX for it in detail.

#### Stage 4 — Parallel Roadmapping

After all milestones have requirements, spawn N roadmapper agents in parallel:

```
Task(gsd-roadmapper, milestone=v16.0, starting_phase=87, requirements=v16.0/REQUIREMENTS.md)
Task(gsd-roadmapper, milestone=v17.0, starting_phase=93, requirements=v17.0/REQUIREMENTS.md)
Task(gsd-roadmapper, milestone=v18.0, starting_phase=97, requirements=v18.0/REQUIREMENTS.md)
```

Each roadmapper writes its own `ROADMAP.md` to the milestone workspace.

After all complete, the orchestrator:
1. Reads all N roadmaps
2. Updates the root `.planning/ROADMAP.md` with all N milestone entries
3. Presents a consolidated phase overview across all milestones

#### Stage 5 — Review and Commit

Display the full plan:

```
MULTI-MILESTONE PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v16.0 Observable Runtime (Phases 87–92, 6 phases)
  Phase 87: Metric Collection Core
  Phase 88: Dashboard Integration
  ...

v17.0 Auth Layer (Phases 93–96, 4 phases)
  Phase 93: Token Management
  ...

v18.0 Test Maturity (Phases 97–102, 6 phases)
  Phase 97: Coverage Gates
  ...

Total: 3 milestones | 16 phases | 38 requirements
```

Offer: "Approve all", "Adjust one", "Re-roadmap one milestone"

On approval, commit all artifacts:
- Root ROADMAP.md update
- All N milestone workspaces (STATE.md, ROADMAP.md, REQUIREMENTS.md)
- BATCH-INTAKE.md in quick task directory

---

### Section 3 — Implementation Requirements

List the concrete changes needed to implement `/gsd:multi-plan`:

#### 3.1 New Slash Command

File: `~/.claude/commands/gsd/multi-plan.md`

Frontmatter fields: name, description, argument-hint, allowed-tools (Read, Write, Bash, Task, AskUserQuestion, Glob)

The command reads `~/.claude/get-shit-done/workflows/multi-plan.md` via `@` execution_context.

#### 3.2 New Workflow File

File: `~/.claude/get-shit-done/workflows/multi-plan.md`

This is the primary new file. It orchestrates all 5 stages described above. Key sections:
- `## 1. Parse Input` — freeform text OR --from-file
- `## 2. Cluster Ideas` — grouping algorithm (affinity mapping)
- `## 3. Milestone Shell Creation` — parallel workspace creation
- `## 4. Research Phase` — parallel research per milestone
- `## 5. Requirements Definition` — chosen UX option (interactive)
- `## 6. Parallel Roadmapping` — N concurrent gsd-roadmapper spawns
- `## 7. Review and Commit` — consolidated view + commit

#### 3.3 gsd-tools.cjs Extensions (if any)

Identify whether any new `gsd-tools.cjs` subcommands are needed. Likely candidates:
- `milestone batch-init <versions...>` — create N workspaces in one call, returning an array of `{version, planning_root, next_starting_phase}` objects
- `milestone phase-slots <count> <phase-sizes...>` — compute non-overlapping phase ranges given estimated phase counts per milestone

Analyze whether existing `milestone new-workspace` + `init new-milestone` can be called N times in parallel from the workflow, or if a dedicated batch subcommand is necessary.

#### 3.4 Phase Number Coordination

This is the hardest problem. Roadmappers run in parallel but each needs to know its starting phase number. Since roadmappers write to their own scoped workspaces, the root ROADMAP.md is only updated at the end. This means:

- Phase slot assignment must happen BEFORE roadmappers are spawned
- The orchestrator must estimate how many phases each milestone will have (based on requirement count) and assign non-overlapping slots
- Recommended approach: assign generous slots (e.g., requirements × 1.5 rounded up) and leave gaps between milestones as buffers
- After all roadmappers return, the orchestrator reads actual phase counts and may need to re-slot if a roadmapper used more phases than estimated

Design the exact algorithm for slot pre-assignment and post-adjustment.

#### 3.5 Failure Modes and Recovery

Document each failure mode:

| Failure | Detection | Recovery |
|---------|-----------|----------|
| One research subagent fails | Returns error instead of RESEARCH COMPLETE | Log warning, continue with partial research, mark workspace as "partial research" |
| One roadmapper fails | Returns ROADMAP BLOCKED | Pause the batch, show user only the failing milestone, re-spawn with clarification |
| Phase slot collision | Two roadmappers use same phase number | Detect after all complete by scanning all N ROADMAPs; show diff and ask user to re-slot |
| User abandons mid-session | Workspaces exist but requirements/roadmaps are incomplete | On next `/gsd:multi-plan`, detect existing incomplete workspaces and offer to resume or discard |

#### 3.6 Session Continuity File

The batch session writes a `BATCH-SESSION.md` to `.planning/quick/NN-multi-plan-[date]/` that records:
- Which milestones are in this batch
- Stage each milestone reached
- Any failures encountered
- Commit SHAs for each milestone's artifacts

This enables resume: `gsd:multi-plan --resume NN` picks up where the session left off.

---

### Section 4 — Milestone Estimate

Determine whether this is a quick task (implementation fits in 1–2 plan files) or a full milestone. Provide the estimate based on:

- New file count: 2–3 new files (command, workflow, possibly a gsd-tools subcommand)
- Lines of workflow logic: The `multi-plan.md` workflow will be the largest single workflow file in the system (~400–600 lines). For comparison, `new-milestone.md` is ~400 lines and orchestrates 11 steps.
- Testing surface: The workflow is orchestration-only (no new CJS modules), so unit tests are minimal. Integration testing requires creating N milestone workspaces, which is already tested.
- Risk: The parallel roadmapping with phase-slot pre-assignment is novel. No existing workflow does this. This is the highest-risk component.

**Recommendation:** State whether this should be:
- A single GSD phase (1 plan file)
- A multi-phase milestone (v16.0 Multi-Milestone Planner, 2–3 phases)
- A quick task (not enough scope)

Base the recommendation on the implementation section analysis.

---

### Section 5 — Open Questions

List any decisions that require user input before implementation can begin:

1. **Requirements UX option.** Which of Option A (sequential), Option B (simultaneous table), or Option C (quick-scope) does the user prefer? This fundamentally shapes the workflow length and UX.

2. **Research opt-in.** Should research be mandatory for all milestones in a batch, or can the user skip it globally (one config toggle) or per-milestone?

3. **Phase slot strategy.** Should phase slots be pre-assigned with buffers, or should the batch planner accept some manual re-numbering after roadmappers complete?

4. **Command name.** `gsd:multi-plan` is a working title. Other options: `gsd:batch-milestone`, `gsd:plan-milestones`, `gsd:roadmap-all`. User preference?

5. **Max batch size.** Should there be a hard limit on how many milestones can be planned in one batch? Recommend N ≤ 5 to keep the session tractable. Is this acceptable?

6. **Does this supersede `gsd:new-milestone`?** Or should `gsd:new-milestone` remain the single-milestone path and `gsd:multi-plan` handle 2+? The design assumes the latter.

---

**Verify:**

```bash
ls /Users/tmac/Projects/gsdup/.planning/quick/41-research-and-plan-multi-milestone-batch-/
# Should show MULTI-MILESTONE-PLANNER-DESIGN.md
wc -l /Users/tmac/Projects/gsdup/.planning/quick/41-research-and-plan-multi-milestone-batch-/MULTI-MILESTONE-PLANNER-DESIGN.md
# Should be > 200 lines
```

**Done:**
- `MULTI-MILESTONE-PLANNER-DESIGN.md` exists at the path above
- The document contains all 5 sections
- Section 2 contains a specific recommendation for the Requirements UX option with rationale
- Section 3 contains a specific algorithm for phase slot pre-assignment
- Section 4 contains a clear recommendation on milestone vs quick-task scope
- Section 5 contains at least 5 open questions

---

## Summary

This plan produces a single research artifact: `MULTI-MILESTONE-PLANNER-DESIGN.md`. The executor's job is to analyze the existing GSD workflows deeply (new-milestone.md, plan-phase.md, discuss-phase.md, path-variables.md) and the existing milestone-scoped infrastructure (gsd-tools.cjs milestone commands, planningRoot(), concurrent layout) to produce a design that fits the existing architecture rather than adding parallel infrastructure.

The key design challenge is phase number coordination across concurrently running roadmapper agents. The document must solve this problem concretely, not vaguely.

If the analysis concludes this is milestone-sized work (likely), the document should also include a proposed milestone brief — the same format used by `MILESTONE-CONTEXT.md` — so the user can feed it directly into `/gsd:new-milestone` to kick off implementation.
