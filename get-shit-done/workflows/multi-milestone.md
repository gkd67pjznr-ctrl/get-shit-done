<purpose>
Accept a freeform feature dump from the user, cluster ideas into milestone themes,
and produce committed REQUIREMENTS.md files for every milestone before roadmapping.
Single-session command that handles: intake → clustering → workspace creation →
per-milestone research (optional) → requirements scoping → parallel roadmapping → synthesis.

This workflow covers Stages 0-3 only. Stage 4 (roadmapping + synthesis) is handled
by the synthesizer and continues in Phase 89.
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
  - Display: "Resume coming in Phase 89 — this capability is not yet implemented."
  - Exit gracefully (do not continue to further steps).
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
</process>
