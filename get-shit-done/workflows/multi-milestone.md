<purpose>
Accept a freeform feature dump from the user, cluster ideas into milestone themes,
and produce committed REQUIREMENTS.md files for every milestone before roadmapping.
Single-session command that handles: intake → clustering → workspace creation →
per-milestone research (optional) → requirements scoping → parallel roadmapping → synthesis.

Single-session command that handles intake → clustering → workspace creation →
per-milestone research (optional) → requirements scoping → parallel roadmapping → synthesis.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## Stage 0 — Feature Intake

### Step 0.1 — Parse `$ARGUMENTS` for flags

Before doing anything else, inspect `$ARGUMENTS`:

- If `$ARGUMENTS` contains `--from-brainstorm NN` (where NN is a number):
  - Set `$INPUT_MODE=brainstorm`
  - Set `$BRAINSTORM_ID=NN`
- Else if `$ARGUMENTS` contains `--from-file <path>`:
  - Set `$INPUT_MODE=file`
  - Set `$INPUT_FILE=<path>`
- Else if `$ARGUMENTS` contains `--resume NN`:
  - Set `$INPUT_MODE=resume`
  - Set `$RESUME_ID=NN`
  - Locate the task directory:
    ```bash
    TASK_DIR=$(find .planning/quick -maxdepth 1 -type d -name "${RESUME_ID}-multi-milestone-*" | head -1)
    ```
  - If no directory found, display: "No batch session found with task ID NN. Check .planning/quick/ for available sessions." and exit.
  - Read `$TASK_DIR/BATCH-SESSION.md`.
  - Read `$TASK_DIR/BATCH-INTAKE.md` to restore `$MILESTONE_VERSIONS` (version, name, workspace path for each milestone).
  - Parse the Stage Status table from BATCH-SESSION.md to determine `$LAST_COMPLETED_STAGE`:
    - Scan each row; the highest stage with Status "Complete" is the last completed stage.
    - Valid stages: 0 (Intake), 1 (Workspace Creation), 2/3 (Research + Scoping), 4 (Roadmapping + Synthesis), 5 (Review + Commit).
  - Display:
    ```
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     GSD ► RESUMING BATCH SESSION [NN]
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Last completed stage: [LAST_COMPLETED_STAGE]
    Milestones in this batch:
      [VERSION] — [Name] (workspace: [path])
      ...
    Resuming from [next stage name]...
    ```
  - Jump to the appropriate stage based on `$LAST_COMPLETED_STAGE`:
    - Stage 0 complete → jump to Stage 1 (Milestone Shell Creation)
    - Stage 1 complete → jump to Stage 2/3 (Per-Milestone Research and Scoping)
    - Stage 2/3 complete → jump to Stage 4 (Parallel Roadmapping and Synthesis)
    - Stage 4 complete → jump to Stage 5 (Review and Commit)
    - Stage 5 complete → display "This batch session is already complete." and exit.
    - No stages complete → restart from Stage 0 (re-display clusters from BATCH-INTAKE.md, skip affinity grouping)
  - When resuming Stage 2/3: check each milestone's Scoping column in the Milestones table. Milestones with a timestamp are already scoped — skip them. Only run Steps A-D for milestones with Scoping = "Pending".
  - When resuming Stage 4: all PROPOSAL.md files may or may not exist. Validate each — if valid, skip re-spawning that roadmapper. Only re-spawn roadmappers whose PROPOSAL.md is missing or invalid. Then spawn synthesizer for all N milestones regardless.
  - When resuming Stage 5: the synthesizer has already written files — skip to Step 5.1 (display consolidated review).
- Otherwise:
  - Set `$INPUT_MODE=inline`
  - Treat the full `$ARGUMENTS` value as raw idea text.

### Step 0.2 — Resolve quick-task directory

```bash
TASK_DIR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" quick task-dir --prefix "multi-milestone" --raw 2>/dev/null)
mkdir -p "$TASK_DIR"
```

If the command fails, fall back to creating the directory manually:

```bash
DATE=$(date +%Y-%m-%d)
TASK_NUM=$(ls .planning/quick/ 2>/dev/null | grep -E '^[0-9]+' | tail -1 | grep -oE '^[0-9]+' || echo "01")
TASK_DIR=".planning/quick/${TASK_NUM}-multi-milestone-${DATE}"
mkdir -p "$TASK_DIR"
```

### Step 0.3 — Load project context

```bash
cat .planning/PROJECT.md
cat .planning/MILESTONES.md
```

Read both files to inform affinity clustering in Step 0.6. Note the project's core value, current milestone focus, and existing feature categories.

### Step 0.4 — Parse input based on `$INPUT_MODE`

**inline:**
- The raw text is already in `$ARGUMENTS`.
- Count top-level items by splitting on newlines, commas, or numbered entries.
- Store as `$RAW_IDEAS`.
- Set `$CLUSTERS_PREBUILT=false`.

**file:**
- Read `$INPUT_FILE`:
  ```bash
  cat "$INPUT_FILE"
  ```
- Count items, store as `$RAW_IDEAS`.
- Set `$CLUSTERS_PREBUILT=false`.

**brainstorm:**
- Locate the brainstorm directory:
  ```bash
  BRAINSTORM_DIR=$(find .planning/quick -maxdepth 1 -type d -name "${BRAINSTORM_ID}-*" | head -1)
  cat "$BRAINSTORM_DIR/FEATURE-IDEAS.md"
  ```
- Store content as `$RAW_IDEAS`.
- Set `$CLUSTERS_PREBUILT=true`.

### Step 0.5 — Display intake header

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MULTI-PLAN — INTAKE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found [N] ideas. [Grouping into milestone themes... | Loading brainstorm clusters...]
```

Replace `[N]` with the count of items parsed from `$RAW_IDEAS`. Use "Grouping into milestone themes..." when `$CLUSTERS_PREBUILT=false`; use "Loading brainstorm clusters..." when `$CLUSTERS_PREBUILT=true`.

### Step 0.6 — Affinity grouping

**When `$CLUSTERS_PREBUILT=false` (inline or file input):**

The orchestrator itself (no subagent) performs clustering using PROJECT.md domain knowledge. Using the project's core value, current milestone focus, and existing feature categories identified in Step 0.3, group ideas by thematic affinity.

Produce 3-6 clusters. Each cluster must have:
- A letter label: A, B, C, ... (sequential)
- A candidate name: short, 2-4 words
- An idea count
- The list of ideas assigned to it

Clustering heuristics:
- Ideas that address the same user problem or workflow belong together
- Ideas that share a technical subsystem belong together
- Do not force small clusters (< 2 ideas) unless no better home exists
- Do not create more than 6 clusters — merge weaker groupings
- Prefer names that describe user value over technical implementation

**When `$CLUSTERS_PREBUILT=true` (brainstorm input):**

Parse the existing cluster structure from FEATURE-IDEAS.md — sections, headers, or top-level groupings become clusters. Map each group to a lettered label (A, B, C, ...) preserving the existing grouping. Skip affinity grouping logic entirely.

### Step 0.7 — Present clusters

Display each cluster using this format:

```
Cluster A ([N] ideas): [Domain] → candidate: "[Name]"
  - [Idea 1]
  - [Idea 2]
  ... ([N-2] more)

Cluster B ([N] ideas): [Domain] → candidate: "[Name]"
  ...
```

Show up to 3 ideas per cluster inline. If a cluster has more than 3 ideas, show the first 3 then append "... ([N-3] more)".

### Step 0.8 — AskUserQuestion: cluster promotion

Use AskUserQuestion with multiSelect:

**Question:** "Which clusters should become milestones in this session?"

**Options:**
- One option per cluster: "[Label]: [Name] ([N] ideas)"
- Final option: "None yet — let me refine clusters first"

### Step 0.9 — Refinement loop

If the user selected "None yet — let me refine clusters first":

Display plain-text instructions:

```
Refine your clusters before promoting:
  • Rename: "rename A to [new name]"
  • Merge: "merge A and B"
  • Split: "split C into C1 and C2"
  • Move idea: "move idea [N] from A to B"
  • Out of scope: "out of scope: [idea text]"

When ready, say "promote clusters" to continue.
```

Wait for user input. Parse each instruction:
- **rename A to [name]**: Update cluster A's candidate name.
- **merge A and B**: Combine all ideas from B into A. Remove cluster B. Re-letter remaining clusters to maintain sequential labels.
- **split C into C1 and C2**: Prompt user to specify which ideas go into each half, then create two sub-clusters. Re-letter.
- **move idea [N] from A to B**: Remove idea [N] from cluster A, add to cluster B.
- **out of scope: [idea text]**: Remove the idea from its cluster and add to a deferred list.

After each instruction is applied, re-display the updated clusters using the format from Step 0.7.

Loop until the user says "promote clusters" or provides a non-refinement response.

After the loop exits, re-present the AskUserQuestion from Step 0.8 with the updated cluster list.

### Step 0.10 — Write BATCH-INTAKE.md

Write to `$TASK_DIR/BATCH-INTAKE.md`:

```markdown
# Batch Intake — [YYYY-MM-DD]

## Raw Ideas ([N] total)

[original $RAW_IDEAS verbatim]

## Approved Clusters

### Cluster A → [Name]
[ideas assigned to this cluster]

### Cluster B → [Name]
[ideas assigned]

## Deferred Ideas

[out-of-scope items with the reason "marked out of scope during cluster review"]
```

Do not commit this file — it is a session artifact, written but not committed until Stage 1.

---

## Stage 1 — Milestone Shell Creation

### 1. Version Auto-Assignment

Parse `MILESTONES.md` to find the highest existing version number. For each approved cluster (in cluster label order A, B, C...), assign the next version: `vX+1.0`, `vX+2.0`, etc.

Present for confirmation before creating anything:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERSION ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Proposed milestone versions:
  Cluster A → v[X+1.0] [Cluster A Name]
  Cluster B → v[X+2.0] [Cluster B Name]
  Cluster C → v[X+3.0] [Cluster C Name]
```

AskUserQuestion: "Proceed with these versions?"
Options:
- "Yes, create these workspaces" — Continue to workspace creation
- "Adjust milestone names" — Prompt for each name individually via plain text, then re-display
- "Adjust version numbers" — Prompt for each version individually via plain text, then re-display

Store confirmed versions as `$MILESTONE_VERSIONS` (array of {cluster, version, name}).

### 2. Parallel Workspace Creation

Once confirmed, issue all N workspace creation calls in parallel. Use N concurrent Task() calls (one per milestone) or N concurrent Bash calls:

```
For each milestone in $MILESTONE_VERSIONS:
  Task(prompt="
    Run: node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs milestone new-workspace [VERSION] --raw
    Write the raw JSON output to $TASK_DIR/workspace-[VERSION].json
    Report success or failure.
  ", description="Create workspace [VERSION]")
```

Wait for all N Tasks to complete. If any workspace creation fails, log the failure with the error message but continue creating the remaining workspaces.

Display progress as tasks complete:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CREATING WORKSPACES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [VERSION] [Name] ... created ✓
  [VERSION] [Name] ... created ✓
  [VERSION] [Name] ... created ✓
```

### 3. Consolidated Conflict Check

After ALL workspaces exist, run a single manifest check:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" milestone manifest-check --raw
```

Parse the JSON result. If `has_conflicts` is true, display:

```
Advisory: File conflicts detected across batch milestones.
  [VERSION1] and [VERSION2] both touch: [file list]
  This is informational only — execution will proceed normally.
```

If no conflicts, display:
```
No cross-milestone file conflicts detected.
```

### 4. Display Summary Table

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MILESTONE WORKSPACES CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone                    | Version   | Workspace
[Cluster A Name]             | v[X+1.0]  | .planning/milestones/v[X+1.0]/
[Cluster B Name]             | v[X+2.0]  | .planning/milestones/v[X+2.0]/
[Cluster C Name]             | v[X+3.0]  | .planning/milestones/v[X+3.0]/

Phase slots will be assigned before roadmapping (Stage 4).
```

### 5. Write and Commit BATCH-SESSION.md

Write `$TASK_DIR/BATCH-SESSION.md`:

```markdown
# Batch Session — [YYYY-MM-DD HH:MM]

## Session Overview

| Field | Value |
|-------|-------|
| Started | [ISO timestamp] |
| Input mode | [inline / file / brainstorm] |
| Ideas count | [N] |
| Milestones | [N] |

## Stage Status

| Stage | Status | Completed At |
|-------|--------|-------------|
| 0 — Feature Intake | Complete | [ISO timestamp] |
| 1 — Workspace Creation | Complete | [ISO timestamp] |
| 2/3 — Research + Scoping | Pending | — |
| 4 — Roadmapping + Synthesis | Pending | — |

## Milestones

| Version | Name | Workspace Created | Scoping | Roadmap |
|---------|------|-------------------|---------|---------|
| v[X+1.0] | [Name] | [timestamp] | Pending | Pending |
| v[X+2.0] | [Name] | [timestamp] | Pending | Pending |

## Failure Log

(none)
```

Commit the file:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "docs: create batch session for [N] milestones" \
  --files "$TASK_DIR/BATCH-SESSION.md" "$TASK_DIR/BATCH-INTAKE.md"
```

After commit, append a comment placeholder: `## Stage 2/3 — Research and Scoping` (filled by Plan 88-03).

---

## Stage 2/3 — Per-Milestone Research and Requirements Scoping

Process each milestone in `$MILESTONE_VERSIONS` sequentially. For each milestone:

### Per-Milestone Loop

Display progress header:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SCOPING: [VERSION] [Milestone Name] ([N] of [TOTAL])
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ideas assigned to this milestone:
  - [Idea 1 from this cluster]
  - [Idea 2 from this cluster]
  - [Idea 3 from this cluster]
```

#### Step A — Research Decision (SCOP-01)

AskUserQuestion: "Research [VERSION] [Milestone Name] before scoping?"
Options:
- "Research first" — Spawn 4 researchers for this milestone, synthesize, then scope
- "Skip research" — Scope from cluster ideas directly

**If "Research first" (SCOP-02):**

```bash
mkdir -p .planning/milestones/[VERSION]/research
```

Display:
```
◆ Spawning 4 researchers for [VERSION] in parallel...
  → Stack, Features, Architecture, Pitfalls
```

Spawn 4 parallel gsd-project-researcher agents. Use the same dimension-specific fields as `new-milestone.md` Step 8 but with milestone-scoped output paths:

**Common Task() template for all 4 researchers:**
```
Task(prompt="
<research_type>Project Research — {DIMENSION} for [VERSION] [Milestone Name].</research_type>

<milestone_context>
SUBSEQUENT MILESTONE — Adding the following features to the existing app:
[cluster ideas for this milestone]

{EXISTING_CONTEXT}
Focus ONLY on what's needed for these features.
</milestone_context>

<question>{QUESTION}</question>

<files_to_read>
- .planning/PROJECT.md (Project context)
- .planning/MILESTONES.md (What has shipped)
</files_to_read>

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .planning/milestones/[VERSION]/research/{FILE}
Use template: ~/.claude/get-shit-done/templates/research-project/{FILE}
</output>
", subagent_type="gsd-project-researcher", description="{DIMENSION} research for [VERSION]")
```

**Dimension-specific fields (copy from new-milestone.md Step 8):**

| Field | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [milestone features]? | How do [milestone features] typically work? Expected behavior? | How do [milestone features] integrate with existing architecture? | Common mistakes when adding [milestone features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

After all 4 researchers complete, spawn synthesizer:

```
Task(prompt="
Synthesize research outputs into SUMMARY.md.

<files_to_read>
- .planning/milestones/[VERSION]/research/STACK.md
- .planning/milestones/[VERSION]/research/FEATURES.md
- .planning/milestones/[VERSION]/research/ARCHITECTURE.md
- .planning/milestones/[VERSION]/research/PITFALLS.md
</files_to_read>

Write to: .planning/milestones/[VERSION]/research/SUMMARY.md
Use template: ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="gsd-research-synthesizer", description="Synthesize research for [VERSION]")
```

Display key findings from SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RESEARCH COMPLETE: [VERSION] ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
```

**If "Skip research":** Continue directly to Step B.

#### Step B — Requirements Scoping (SCOP-03)

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS: [VERSION]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If research exists for this milestone:** Read `.planning/milestones/[VERSION]/research/FEATURES.md`, extract feature categories and table stakes/differentiators.

Present features by category:
```
## [Category 1]
**Table stakes:** Feature A, Feature B
**Differentiators:** Feature C, Feature D
**Research notes:** [any relevant notes]
```

**If no research:** Derive categories from the cluster's ideas. Ask in plain text: "What are the main things users need to do with [milestone features]?" Clarify and group into categories before presenting multiSelect.

**Scope each category** via AskUserQuestion (multiSelect: true, header max 12 chars):
- "[Feature 1]" — [brief description]
- "[Feature 2]" — [brief description]
- "None for this milestone" — Defer entire category

Track: Selected → this milestone's requirements. Unselected table stakes → future. Unselected differentiators → out of scope.

**Identify gaps** via AskUserQuestion:
- "No, research covered it" — Proceed
- "Yes, let me add some" — Capture additions as plain text, then continue

**Generate REQUIREMENTS.md content:**
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- Future Requirements section (deferred items)
- Out of Scope section (explicit exclusions)
- Traceability section (empty table — filled by roadmapper)

**REQ-ID format:** `[CATEGORY-ABBREVIATION]-[NUMBER]` (e.g., AUTH-01, NOTIF-02). Start numbering from 01 for each milestone.

**Quality criteria for each requirement:**
- Specific and testable: "User can X" not "System does Y"
- Atomic: one capability per requirement
- Independent: minimal dependencies on other requirements

Present full requirements list for confirmation:

```
## [VERSION] [Milestone Name] Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

...

Does this capture what you're building? (yes / adjust)
```

If user says "adjust", accept plain-text corrections and re-present the list. Loop until confirmed.

#### Step C — Commit REQUIREMENTS.md (SCOP-04)

Write `.planning/milestones/[VERSION]/REQUIREMENTS.md` with the confirmed requirements.

Commit:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "docs: define [VERSION] requirements ([N] items)" \
  --files .planning/milestones/[VERSION]/REQUIREMENTS.md
```

#### Step D — Update BATCH-SESSION.md

Read `$TASK_DIR/BATCH-SESSION.md`. Update the row for `[VERSION]` in the Milestones table:
- Set Scoping column to "[ISO timestamp]"

Commit the updated BATCH-SESSION.md:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "docs: batch session — [VERSION] scoping complete" \
  --files "$TASK_DIR/BATCH-SESSION.md"
```

---

After all N milestones have completed Steps A-D, display completion summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ALL MILESTONES SCOPED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[N] milestone REQUIREMENTS.md files committed.
Ready for roadmapping (Stage 4).

Milestones scoped:
  v[X+1.0] — [Name] ([N] requirements)
  v[X+2.0] — [Name] ([N] requirements)
  v[X+3.0] — [Name] ([N] requirements)

## > Next Up
Run `/gsd:multi-milestone --resume` to continue to Stage 4 (roadmapping + synthesis).
(Stage 4 implementation: Phase 89)
```

## Stage 4 — Parallel Roadmapping and Synthesis

### Step 4.1 — Determine next_starting_phase

Before spawning any roadmapper, call:

```bash
INIT_JSON=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init new-milestone --raw 2>/dev/null)
```

Parse the JSON output to extract `next_starting_phase`. If the call fails or returns no valid integer, display an error and abort Stage 4.

Store as `$NEXT_STARTING_PHASE`.

### Step 4.2 — Display Stage 4 header

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ROADMAPPING [N] MILESTONES IN PARALLEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next starting phase: [NEXT_STARTING_PHASE]
Spawning [N] roadmapper agents in proposal mode...
```

### Step 4.3 — Spawn N roadmapper agents in parallel (proposal mode)

For each milestone in `$MILESTONE_VERSIONS`, issue a Task() call concurrently:

```
Task(
  prompt="
<execution_context>
~/.claude/agents/gsd-roadmapper.md
</execution_context>

<mode>proposal</mode>

<milestone_workspace>[MILESTONE_WORKSPACE_PATH]</milestone_workspace>

<files_to_read>
- [MILESTONE_WORKSPACE_PATH]/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/MILESTONES.md
</files_to_read>

<instructions>
Produce an unnumbered phase proposal for [VERSION] [Milestone Name].
Do NOT assign phase numbers. Use PHASE-A, PHASE-B, PHASE-C placeholder labels.
Do NOT write ROADMAP.md. Write ONLY to [MILESTONE_WORKSPACE_PATH]/PROPOSAL.md.
</instructions>
  ",
  subagent_type="gsd-roadmapper",
  description="Proposal roadmap for [VERSION] [Milestone Name]"
)
```

Wait for ALL N tasks to complete before proceeding to Step 4.4.

Display progress as each roadmapper completes:
```
  [VERSION] [Name] ... proposal complete ✓
```

### Step 4.4 — Validate proposals

For each milestone, check that `[MILESTONE_WORKSPACE_PATH]/PROPOSAL.md` exists and contains at least one `PHASE-A` entry.

If a roadmapper returned `## ROADMAP BLOCKED` or produced an empty/invalid PROPOSAL.md:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ROADMAP BLOCKED: [VERSION] [Milestone Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blocker: [message from roadmapper]
```

Ask via plain text for clarification notes, then re-spawn that roadmapper with the clarification appended to its prompt. Only the blocked milestone needs re-spawning — do not discard valid proposals from other milestones.

Re-validate after re-spawn. If still blocked after one retry, log to BATCH-SESSION.md Failure Log and ask the user: "Skip this milestone or abort batch?"

### Step 4.5 — Spawn gsd-roadmap-synthesizer

Once ALL N PROPOSAL.md files are valid, spawn the synthesizer:

```
Task(
  prompt="
<execution_context>
~/.claude/agents/gsd-roadmap-synthesizer.md
</execution_context>

<files_to_read>
[For each milestone in $MILESTONE_VERSIONS:]
- [MILESTONE_WORKSPACE_PATH]/PROPOSAL.md
- [MILESTONE_WORKSPACE_PATH]/REQUIREMENTS.md
[End loop]
- .planning/ROADMAP.md
- .planning/STATE.md
</files_to_read>

<context>
next_starting_phase: [NEXT_STARTING_PHASE]
milestones_in_order: [[VERSION1], [VERSION2], ...]
</context>
  ",
  subagent_type="gsd-roadmap-synthesizer",
  description="Synthesize [N] milestone roadmaps into numbered phases"
)
```

Wait for the synthesizer to return a `## SYNTHESIS COMPLETE` block.

If the synthesizer returns `## SYNTHESIS BLOCKED`, display the block content and abort with instructions for the user to resolve the issue before re-running Stage 4.

### Step 4.6 — Update BATCH-SESSION.md (Roadmapping stage)

Read `$TASK_DIR/BATCH-SESSION.md`. Update the Stage Status table:

- Set "4 — Roadmapping + Synthesis" row Status to "Complete" and Completed At to "[ISO timestamp]"

For each milestone in `$MILESTONE_VERSIONS`, update the Milestones table:
- Set Roadmap column to "[ISO timestamp]"

Append an entry to the Stage Log:
```
| [ISO timestamp] | Roadmapping | all | Synthesizer complete — phases [start]–[end] assigned |
```

Commit the updated BATCH-SESSION.md:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "docs: batch session — roadmapping complete (phases [start]-[end])" \
  --files "$TASK_DIR/BATCH-SESSION.md"
```

### Step 4.7 — Display synthesis summary

Display the structured summary returned by the synthesizer:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MULTI-MILESTONE PLAN (synthesized)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[paste the Phase Allocation Summary from SYNTHESIS COMPLETE block here]

Total: [N] milestones | [X] phases | [Y] requirements
No phase gaps — sequential assignment by synthesizer.
```

Then proceed to Stage 5 (Plan 89-02).

## Stage 5 — Review and Commit

### Step 5.1 — Present consolidated review

Display the full synthesized plan by reading each milestone's ROADMAP.md from its workspace:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MULTI-MILESTONE PLAN (ready for commit)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[For each milestone in $MILESTONE_VERSIONS, display:]

[VERSION] [Milestone Name] (Phases [start]–[end], [N] phases)
[For each phase in this milestone's ROADMAP.md:]
  Phase [N]: [Phase Name] — [one-line goal]

[End loop]

Total: [N] milestones | [X] phases | [Y] requirements
```

### Step 5.2 — AskUserQuestion: approval

```
AskUserQuestion: "How do you want to proceed?"
Options:
- "Approve all — commit everything"
- "Adjust one milestone — tell me which"
- "Re-roadmap one milestone — re-spawn roadmapper with notes, then re-synthesize"
```

### Step 5.3 — Handle: Approve all

On "Approve all — commit everything":

Issue commits in this order:

**Per-milestone commits (one per milestone):**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "docs: initialize [VERSION] [Milestone Name] ([N] phases, [start]–[end])" \
  --files "[MILESTONE_WORKSPACE_PATH]/ROADMAP.md" \
          "[MILESTONE_WORKSPACE_PATH]/STATE.md" \
          "[MILESTONE_WORKSPACE_PATH]/REQUIREMENTS.md"
```

Repeat for each milestone. Record each commit SHA.

**Root commit (after all per-milestone commits succeed):**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "docs: add [N] milestones to root roadmap (multi-milestone batch, phases [start]–[end])" \
  --files ".planning/ROADMAP.md" \
          ".planning/STATE.md" \
          ".planning/MILESTONES.md"
```

Record root commit SHA.

Then go to Step 5.5 (finalize BATCH-SESSION.md).

### Step 5.4a — Handle: Adjust one milestone

On "Adjust one milestone — tell me which":

Ask via plain text: "Which milestone do you want to adjust? (e.g. v16.0)"

Read the specified milestone's ROADMAP.md from its workspace and display it in full.

Ask via plain text: "Describe the adjustments you want to make."

Apply the user's requested adjustments to the milestone's ROADMAP.md in the workspace using the Write tool. Re-read and redisplay the updated ROADMAP.md to confirm.

Re-display the full consolidated plan summary (Step 5.1 format) with the updated milestone.

Return to AskUserQuestion in Step 5.2.

### Step 5.4b — Handle: Re-roadmap one milestone

On "Re-roadmap one milestone — re-spawn roadmapper with notes, then re-synthesize":

Ask via plain text: "Which milestone do you want to re-roadmap? (e.g. v16.0)"

Ask via plain text: "What notes or changes should the roadmapper incorporate?"

Re-spawn only the affected roadmapper in proposal mode with the notes:

```
Task(
  prompt="
<execution_context>
~/.claude/agents/gsd-roadmapper.md
</execution_context>

<mode>proposal</mode>

<milestone_workspace>[AFFECTED_MILESTONE_WORKSPACE_PATH]</milestone_workspace>

<files_to_read>
- [AFFECTED_MILESTONE_WORKSPACE_PATH]/REQUIREMENTS.md
- .planning/PROJECT.md
- .planning/MILESTONES.md
</files_to_read>

<revision_notes>
[User's notes from plain-text input above]
</revision_notes>

<instructions>
Re-produce an unnumbered phase proposal for [VERSION] [Milestone Name].
Incorporate the revision notes above. The previous PROPOSAL.md will be overwritten.
Do NOT assign phase numbers. Use PHASE-A, PHASE-B, PHASE-C placeholder labels.
Write ONLY to [AFFECTED_MILESTONE_WORKSPACE_PATH]/PROPOSAL.md.
</instructions>
  ",
  subagent_type="gsd-roadmapper",
  description="Revised proposal for [VERSION] [Milestone Name]"
)
```

Wait for the re-roadmapper to complete. Validate PROPOSAL.md has PHASE-X entries.

Re-spawn gsd-roadmap-synthesizer with all N PROPOSAL.md files (unchanged milestones AND the re-roadmapped one) — the synthesizer re-numbers everything from scratch:

```
Task(
  prompt="
<execution_context>
~/.claude/agents/gsd-roadmap-synthesizer.md
</execution_context>

<files_to_read>
[For each milestone in $MILESTONE_VERSIONS:]
- [MILESTONE_WORKSPACE_PATH]/PROPOSAL.md
- [MILESTONE_WORKSPACE_PATH]/REQUIREMENTS.md
[End loop]
- .planning/ROADMAP.md
- .planning/STATE.md
</files_to_read>

<context>
next_starting_phase: [NEXT_STARTING_PHASE]
milestones_in_order: [[VERSION1], [VERSION2], ...]
</context>
  ",
  subagent_type="gsd-roadmap-synthesizer",
  description="Re-synthesize after re-roadmap of [VERSION]"
)
```

Re-display the full consolidated plan summary (Step 5.1 format) with updated phase numbers.

Return to AskUserQuestion in Step 5.2.

### Step 5.5 — Finalize BATCH-SESSION.md

Read `$TASK_DIR/BATCH-SESSION.md`. Update:

- Stage Status table: Set "5 — Review + Commit" Status to "Complete" and Completed At to "[ISO timestamp]"
- Add a top-level `status: complete` field to the Session Overview table
- Append commit SHAs to each milestone's row in the Milestones table

Append to Stage Log:
```
| [ISO timestamp] | Commits | all | [N] per-milestone + 1 root commit issued |
```

Commit the final BATCH-SESSION.md:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "docs: record batch session complete ([N] milestones, phases [start]-[end])" \
  --files "$TASK_DIR/BATCH-SESSION.md"
```

### Step 5.6 — Display completion banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MULTI-MILESTONE BATCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[N] milestones committed:
  [VERSION] — [Name] (Phases [start]–[end])
  [VERSION] — [Name] (Phases [start]–[end])

To start executing the first phase of any milestone:
  /gsd:plan-phase [first-phase-number]

Session artifacts: $TASK_DIR/
```

</process>
